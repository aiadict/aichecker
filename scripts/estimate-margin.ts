/**
 * Run: npm run estimate-margin
 *
 * Prints gross margin for each plan against TruthScan's real per-credit
 * cost (our primary detection provider since 2026-09-13 — see
 * docs/architecture.md's "AI-detection provider" section). Re-run this
 * any time the provider's real rate changes, or before changing a price,
 * to sanity-check margin before touching supabase's plans table or Stripe.
 *
 * 1 credit = 1 "scan" = up to ~1,000 words (TruthScan's own observed
 * consumption is ~1 credit per word checked; our own credit definition
 * already assumes the same ~1,000-word unit).
 */

// TruthScan's real committed-tier rate, as relayed by the user
// (2026-09-19): $399/mo covers 40,000 scans, additional scans $0.01
// each. 399 / 40,000 = $0.009975/scan — essentially identical to the
// $0.01 marginal rate, so (unlike Pangram's old tiered pricing) there's
// no meaningful volume discount to model separately: cost per credit is
// ~$0.01 whether inside or outside the 40k bundle.
//
// Caveat this cost assumption rests on (don't delete this note): as of
// 2026-09-19, actual TruthScan usage was ~525 credits/month total across
// all users — about 1.3% of the 40k-scan tier this rate assumes. We were
// almost certainly NOT actually paying the committed $399/mo rate at
// that volume. This $0.01/credit figure is the TARGET rate once volume
// justifies committing to that tier, not necessarily what's being billed
// today — re-verify against the real TruthScan invoice before leaning on
// this number for a future pricing decision.
const COST_PER_CREDIT_USD = 0.01;

// Keep in sync with the REAL production supabase `plans` table (verified
// live via the Management API — NOT necessarily the same as whatever's
// checked into supabase/seed.sql; that file's stripe_price_id values are
// deliberately test-mode IDs for local dev, not production's real ones).
// Last updated 2026-09-20: Premium/Professional prices cut roughly in
// half+ following the Pangram -> TruthScan cost reduction, per the
// business-analyst pass in docs/architecture.md's pricing section.
const PLANS = [
  { key: "free", monthlyCredits: 25, priceCents: 0 },
  { key: "pro", monthlyCredits: 300, priceCents: 748 },
  { key: "pro (annual, effective monthly)", monthlyCredits: 300, priceCents: 598 }, // 7176/12
  { key: "business", monthlyCredits: 500, priceCents: 978 },
  { key: "business (annual, effective monthly)", monthlyCredits: 500, priceCents: 782 }, // 9384/12
];

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

console.log("Plan margin estimate (worst case = every credit used every month)\n");
console.log(
  ["plan", "credits/mo", "price", "cost", "margin $", "margin %"]
    .map((h) => h.padEnd(38))
    .join("")
);

for (const plan of PLANS) {
  const price = plan.priceCents / 100;
  const cost = plan.monthlyCredits * COST_PER_CREDIT_USD;
  const margin = price - cost;
  const marginPct = price === 0 ? -Infinity : (margin / price) * 100;
  console.log(
    [
      plan.key,
      String(plan.monthlyCredits),
      formatUsd(price),
      formatUsd(cost),
      formatUsd(margin),
      price === 0 ? "n/a (CAC)" : `${marginPct.toFixed(1)}%`,
    ]
      .map((c) => c.padEnd(38))
      .join("")
  );
}

console.log(
  "\nFree plan margin is intentionally negative (customer acquisition cost) — " +
    "capped further by daily_cap in supabase/seed.sql to bound worst-case spend."
);
console.log(
  "Worst-case only: real margins will typically run higher, since most subscribers " +
    "don't use 100% of their monthly credit allotment every month. Figures above are " +
    "pre-Stripe-fee; see docs/architecture.md's pricing section for post-fee margins."
);
