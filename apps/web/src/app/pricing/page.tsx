import Link from "next/link";
import UpgradeButton from "./components/UpgradeButton";

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
    featured: true,
    features: ["Everything in Free", "50× the free plan's monthly credits", "Priority support"],
  },
  {
    key: "business",
    name: "Business",
    price: "$199/mo",
    credits: "2,000 credits / month",
    note: "3 seats included",
    features: ["Everything in Pro", "Seat pooling", "Admin controls"],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="container">
      <h1>Pricing</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Every plan includes the same detection quality — paste, right-click, or the floating
        icon all work the same way. What changes is how many credits you get each month.
      </p>
      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <div className={`card pricing-card${"featured" in plan && plan.featured ? " featured" : ""}`} key={plan.key}>
            {"featured" in plan && plan.featured && <span className="pricing-badge">Most popular</span>}
            <h3>{plan.name}</h3>
            <p style={{ fontSize: 28, fontWeight: 800, margin: "8px 0" }}>{plan.price}</p>
            <p>{plan.credits}</p>
            <p className="muted">{plan.note}</p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {plan.key === "free" ? (
              <Link className="cta-button-secondary" href="/login">
                Get started
              </Link>
            ) : (
              <UpgradeButton planKey={plan.key} label={`Upgrade to ${plan.name}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
