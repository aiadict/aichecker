const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    credits: "10 credits / month",
    note: "up to 4 checks / day",
    features: ["Check for AI (paste, right-click, floating icon)", "Check history", "Shareable result links"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$49/mo",
    credits: "500 credits / month",
    note: "≈ 500,000 words / month",
    features: ["Everything in Free", "Priority support"],
  },
  {
    key: "business",
    name: "Business",
    price: "$199/mo",
    credits: "2,000 credits / month",
    note: "3 seats included",
    features: ["Everything in Pro", "Seat pooling", "Admin controls"],
  },
];

export default function PricingPage() {
  return (
    <div className="container">
      <h1>Pricing</h1>
      <p className="muted">
        Numbers below match <code>supabase/seed.sql</code> — the database is the source of
        truth, this page just renders it. See <code>docs/product-spec.md</code> §3 for the
        margin rationale against Pangram&apos;s API cost.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {PLANS.map((plan) => (
          <div className="card" key={plan.key}>
            <h3>{plan.name}</h3>
            <p style={{ fontSize: 28, fontWeight: 800, margin: "8px 0" }}>{plan.price}</p>
            <p>{plan.credits}</p>
            <p className="muted">{plan.note}</p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
