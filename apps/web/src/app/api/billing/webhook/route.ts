import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const KNOWN_SUBSCRIPTION_STATUSES = ["active", "past_due", "canceled", "trialing", "unpaid"] as const;
type KnownSubscriptionStatus = (typeof KNOWN_SUBSCRIPTION_STATUSES)[number];

function isKnownStatus(status: string): status is KnownSubscriptionStatus {
  return (KNOWN_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/**
 * Source of truth for "what plan is a user actually on" after any Stripe
 * event: `invoice.paid`. This single event covers the initial subscription
 * purchase, every renewal, AND plan upgrades/downgrades made through the
 * Customer Portal (Stripe generates a proration invoice for those too) —
 * so one handler keeps subscriptions + credit_balances in sync for all
 * three cases without separately reasoning about customer.subscription.updated
 * for plan changes. Status changes (past_due, unpaid, recovery) are handled
 * separately below by handleInvoicePaymentFailed / handleSubscriptionUpdated
 * — deliberately not folded into this function, since a failed payment
 * should NOT touch plan_id or credits at all (see supabase/migrations/
 * ..._consume_credit_no_paid_autotopup.sql for the other half of this: paid
 * plans are only ever topped up here, never by a time-based fallback, so
 * simply not calling this on failure is what makes dunning enforcement work).
 */
async function handleInvoicePaid(admin: ReturnType<typeof getSupabaseAdmin>, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const line = invoice.lines?.data?.[0];
  const priceId = line?.pricing?.price_details?.price ?? undefined;

  // The reliable way to identify which user this invoice belongs to: set
  // directly on the Checkout Session at creation (subscription_data.metadata
  // in api/billing/checkout/route.ts), carried onto the Subscription and
  // from there onto every invoice for it. Deliberately NOT resolved via a
  // subscriptions.stripe_customer_id lookup — that column is written by
  // handleCheckoutSessionCompleted, a SEPARATE webhook event Stripe does
  // not guarantee arrives (or finishes processing) before this one.
  // Confirmed live during the first real end-to-end test: invoice.paid was
  // delivered and processed one second before checkout.session.completed
  // had committed, so a customer-id lookup here found no row at all and
  // silently dropped the credit grant.
  const userId = invoice.parent?.subscription_details?.metadata?.supabase_user_id;
  const subscriptionId =
    line?.parent?.type === "subscription_item_details"
      ? line.parent.subscription_item_details?.subscription
      : undefined;

  if (!customerId || !priceId || !userId) {
    console.error("invoice.paid missing customer, price id, or user id", { customerId, priceId, userId });
    return;
  }

  // Matches either column — a renewal/purchase can be on the monthly OR
  // the annual price (see the pricing page's billing-interval toggle),
  // and monthly_credits (what actually gets granted) is the same either
  // way, so which column matched doesn't need to be distinguished here.
  const { data: plan } = await admin
    .from("plans")
    .select("id, monthly_credits")
    .or(`stripe_price_id.eq.${priceId},stripe_price_id_annual.eq.${priceId}`)
    .single<{ id: string; monthly_credits: number }>();
  if (!plan) {
    console.error(`invoice.paid: no plan found for stripe_price_id ${priceId}`);
    return;
  }

  const periodEndUnix = line?.period?.end;
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from("subscriptions")
    // A successful invoice always means the subscription is in good
    // standing going forward — clear cancel_at_period_end in case this is a
    // renewal after the user changed their mind and resumed via the Portal.
    // Also (re)writes stripe_customer_id/stripe_subscription_id here rather
    // than trusting handleCheckoutSessionCompleted to have done it first —
    // this handler is now fully self-sufficient regardless of event order.
    .update({
      plan_id: plan.id,
      status: "active",
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      stripe_customer_id: customerId,
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("user_id", userId);

  await admin
    .from("credit_balances")
    .update({
      plan_id: plan.id,
      credits_remaining: plan.monthly_credits,
      checks_today: 0,
      period_start: new Date().toISOString(),
      period_end: periodEnd,
    })
    .eq("user_id", userId);
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

/**
 * A renewal charge failed. Marks the subscription past_due — deliberately
 * does NOT touch plan_id or credit_balances. Whatever credits the user has
 * left keep working (a natural grace period); they simply won't get a
 * fresh batch until invoice.paid fires for a successful retry (Stripe's
 * Smart Retries keep trying automatically over the following days).
 */
async function handleInvoicePaymentFailed(admin: ReturnType<typeof getSupabaseAdmin>, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const { error } = await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(`invoice.payment_failed: failed to mark customer ${customerId} past_due`, error);
  } else {
    console.warn(`Payment failed for Stripe customer ${customerId} — marked past_due.`);
  }
}

/**
 * Keeps subscriptions.status truthful for any status Stripe reports that
 * isn't already covered by a more specific handler — e.g. recovering from
 * past_due back to active (invoice.paid already handles the credit/plan
 * side of that), or reaching unpaid if the account's dunning settings are
 * configured to not auto-cancel after exhausting retries. Unrecognized
 * statuses (e.g. incomplete, paused) are logged and left alone rather than
 * risking a constraint violation on an update we didn't anticipate.
 */
async function handleSubscriptionUpdated(admin: ReturnType<typeof getSupabaseAdmin>, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  if (!isKnownStatus(subscription.status)) {
    console.warn(`customer.subscription.updated: unhandled status "${subscription.status}" for customer ${customerId}`);
    return;
  }

  // Stripe has two independent, mutually-exclusive ways to schedule a
  // future cancellation: cancel_at_period_end (a boolean) and cancel_at
  // (an explicit future timestamp). Confirmed live: cancelling through the
  // Customer Portal's "tell us why you're leaving" flow sets cancel_at,
  // NOT cancel_at_period_end — so this column, which only ever looked at
  // cancel_at_period_end, silently stayed false for a subscription that
  // Stripe's own dashboard correctly showed as "Cancels Sep 9". Every
  // consumer of this column (checkout's and delete-account's
  // hasRenewingSubscription) actually wants to know "will this end on its
  // own", so that's what gets stored here — not a literal passthrough of
  // one specific Stripe field.
  const willEnd = subscription.cancel_at_period_end || subscription.cancel_at != null;

  const { error } = await admin
    .from("subscriptions")
    .update({ status: subscription.status, cancel_at_period_end: willEnd })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(`customer.subscription.updated: failed to sync status for customer ${customerId}`, error);
  }
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

  await admin
    .from("subscriptions")
    .update({ plan_id: freePlan.id, status: "canceled", cancel_at_period_end: false })
    .eq("user_id", sub.user_id);
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
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription);
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
