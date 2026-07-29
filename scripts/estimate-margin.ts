/**
 * Run: npm run estimate-margin
 *
 * Prints gross margin for each plan in supabase/seed.sql against Pangram's
 * per-credit cost. Re-run this the moment a real/negotiated Pangram API
 * rate is known (edit COST_PER_CREDIT_USD below) to sanity-check pricing
 * before changing supabase/seed.sql or Stripe prices.
 */

const COST_PER_CREDIT_USD = {
  realtime: 0.05, // $/1,000 words
  bulk: 0.04, // $/1,000 words
};

// Keep in sync with supabase/seed.sql. Not imported directly so this script
// has zero DB dependency and can run before Supabase is even provisioned.
const PLANS = [
  { key: "free", monthlyCredits: 10, priceCents: 0 },
  { key: "pro", monthlyCredits: 500, priceCents: 4900 },
  { key: "business", monthlyCredits: 2000, priceCents: 19900 },
];

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

console.log("Plan margin estimate (worst case = every credit used every month)\n");
console.log(
  ["plan", "credits/mo", "price", "cost@realtime", "cost@bulk", "margin@realtime", "margin@bulk"]
    .map((h) => h.padEnd(16))
    .join("")
);

for (const plan of PLANS) {
  const price = plan.priceCents / 100;
  const costRealtime = plan.monthlyCredits * COST_PER_CREDIT_USD.realtime;
  const costBulk = plan.monthlyCredits * COST_PER_CREDIT_USD.bulk;
  const marginRealtime = price === 0 ? -costRealtime : price - costRealtime;
  const marginBulk = price === 0 ? -costBulk : price - costBulk;

  console.log(
    [
      plan.key,
      String(plan.monthlyCredits),
      formatUsd(price),
      formatUsd(costRealtime),
      formatUsd(costBulk),
      formatUsd(marginRealtime),
      formatUsd(marginBulk),
    ]
      .map((c) => c.padEnd(16))
      .join("")
  );
}

console.log(
  "\nFree plan margin is intentionally negative (customer acquisition cost) — " +
    "capped further by daily_cap in supabase/seed.sql to bound worst-case spend."
);
