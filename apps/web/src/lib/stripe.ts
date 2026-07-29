import Stripe from "stripe";

/**
 * SERVER-ONLY. STRIPE_SECRET_KEY is a restricted key (rk_test_...), scoped
 * to only Checkout Sessions (write), Customers (write), Subscriptions
 * (read), Customer Portal (write), Products/Prices (read) — see
 * docs/architecture.md for why a restricted key over a full secret key,
 * and exactly which permissions were granted.
 */
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set — see .env.example.");
  }

  stripeClient = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return stripeClient;
}
