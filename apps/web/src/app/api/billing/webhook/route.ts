import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Source of truth for "what plan is a user actually on" after any Stripe
 * event: `invoice.paid`. This single event covers the initial subscription
 * purchase, every renewal, AND plan upgrades/downgrades made through the
 * Customer Portal (Stripe generates a proration invoice for those too) —
 * so one handler keeps subscriptions + credit_balances in sync for all
 * three cases without separately reasoning about customer.subscription.updated.
 *
 * Known gap (acceptable for this stage, not dunning/enforcement): a failed
 * renewal charge fires `invoice.payment_failed`, not `invoice.paid` — we
 * don't currently mark the subscription past_due or restrict access on
 * that. Revisit before relying on this for real revenue at scale.
 */
async function handleInvoicePaid(admin: ReturnType<typeof getSupabaseAdmin>, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const line = invoice.lines?.data?.[0];
  const priceId = line?.pricing?.price_details?.price ?? undefined;
  if (!customerId || !priceId) {
    console.error("invoice.paid missing customer or price id", { customerId, priceId });
    return;
  }

  const { data: plan } = await admin
    .from("plans")
    .select("id, monthly_credits")
    .eq("stripe_price_id", priceId)
    .single<{ id: string; monthly_credits: number }>();
  if (!plan) {
    console.error(`invoice.paid: no plan found for stripe_price_id ${priceId}`);
    return;
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single<{ user_id: string }>();
  if (!sub) {
    console.error(`invoice.paid: no subscription row found for stripe customer ${customerId}`);
    return;
  }

  const periodEndUnix = line?.period?.end;
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from("subscriptions")
    .update({ plan_id: plan.id, status: "active", current_period_end: periodEnd })
    .eq("user_id", sub.user_id);

  await admin
    .from("credit_balances")
    .update({
      plan_id: plan.id,
      credits_remaining: plan.monthly_credits,
      checks_today: 0,
      period_start: new Date().toISOString(),
      period_end: periodEnd,
    })
    .eq("user_id", sub.user_id);
}

async function handleCheckoutSessionCompleted(
  admin: ReturnType<typeof getSupabaseAdmin>,
  session: Stripe.Checkout.Session
) {
  const userId = session.client_reference_id;
  if (!userId || session.mode !== "subscription") return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!customerId || !subscriptionId) return;

  // Links the Stripe customer/subscription to our user. The actual plan
  // assignment + credit top-up happens in handleInvoicePaid, which fires
  // for the same purchase — this just establishes the customer_id -> user_id
  // mapping that handler depends on.
  await admin
    .from("subscriptions")
    .update({ stripe_customer_id: customerId, stripe_subscription_id: subscriptionId })
    .eq("user_id", userId);
}

async function handleSubscriptionDeleted(admin: ReturnType<typeof getSupabaseAdmin>, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const { data: freePlan } = await admin
    .from("plans")
    .select("id, monthly_credits")
    .eq("key", "free")
    .single<{ id: string; monthly_credits: number }>();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single<{ user_id: string }>();
  if (!sub || !freePlan) return;

  await admin.from("subscriptions").update({ plan_id: freePlan.id, status: "canceled" }).eq("user_id", sub.user_id);
  await admin
    .from("credit_balances")
    .update({
      plan_id: freePlan.id,
      credits_remaining: freePlan.monthly_credits,
      checks_today: 0,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("user_id", sub.user_id);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "missing_signature_or_secret" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(admin, event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(admin, event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling Stripe webhook event ${event.type}`, err);
    // Still 200 — a bug on our side shouldn't make Stripe retry forever and
    // pile up duplicate side effects; errors are logged for us to fix.
  }

  return NextResponse.json({ received: true });
}
