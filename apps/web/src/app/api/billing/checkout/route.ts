import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { hasRenewingSubscription } from "@/lib/subscriptions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Creates a Stripe Checkout Session for the given plan and returns its URL
 * for the client to redirect to. AI Checker is the merchant of record the
 * customer sees (not Stripe/Link) — see docs/architecture.md — so every
 * session explicitly disables Managed Payments, which is on by default for
 * new Stripe accounts.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { planKey, billingInterval } = (await req.json()) as {
    planKey?: string;
    billingInterval?: "month" | "year";
  };
  if (planKey !== "pro" && planKey !== "business") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  const interval = billingInterval === "year" ? "year" : "month";

  const admin = getSupabaseAdmin();
  const { data: plan } = await admin
    .from("plans")
    .select("stripe_price_id, stripe_price_id_annual")
    .eq("key", planKey)
    .single<{ stripe_price_id: string | null; stripe_price_id_annual: string | null }>();

  const priceId = interval === "year" ? plan?.stripe_price_id_annual : plan?.stripe_price_id;
  if (!priceId) {
    return NextResponse.json({ error: "plan_not_configured" }, { status: 500 });
  }

  // Reuse the existing Stripe customer if this user already has one (e.g.
  // from a prior subscription) — avoids creating duplicate customers.
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, status, cancel_at_period_end, plans(key)")
    .eq("user_id", user.id)
    .single<{
      stripe_customer_id: string | null;
      status: string;
      cancel_at_period_end: boolean;
      plans: { key: string } | { key: string }[];
    }>();

  // Reusing the customer above avoids a duplicate CUSTOMER, but nothing
  // about that stops a duplicate SUBSCRIPTION — Checkout will happily
  // create a brand new one for an existing customer regardless of what
  // they're already subscribed to. Confirmed live: a customer went
  // through Checkout twice (once via Apple Pay, once with a different
  // card, after being unsure whether the first had actually gone
  // through) and ended up with two separate $19.99/mo subscriptions
  // billing in parallel — nothing here had ever stopped that.
  const existingPlanKey = existingSub
    ? Array.isArray(existingSub.plans)
      ? existingSub.plans[0]?.key
      : existingSub.plans?.key
    : "free";
  if (
    hasRenewingSubscription({
      status: existingSub?.status,
      cancelAtPeriodEnd: existingSub?.cancel_at_period_end,
      planKey: existingPlanKey,
    })
  ) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  const stripe = getStripe();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { supabase_user_id: user.id } },
    success_url: `${APP_URL}/dashboard?checkout=success`,
    cancel_url: `${APP_URL}/pricing?checkout=canceled`,
    // Managed Payments (Stripe/Link as merchant of record) is on by default
    // for new accounts — explicitly disabled so AI Checker stays the seller
    // the customer sees. Not yet in this SDK version's TS types.
    ...({ managed_payments: { enabled: false } } as Record<string, unknown>),
    ...(existingSub?.stripe_customer_id
      ? { customer: existingSub.stripe_customer_id }
      : { customer_email: user.email }),
  };

  const session = await stripe.checkout.sessions.create(params);

  return NextResponse.json({ url: session.url });
}
