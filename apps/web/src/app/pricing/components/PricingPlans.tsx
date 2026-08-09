"use client";

import { useState } from "react";
import Link from "next/link";
import UpgradeButton from "./UpgradeButton";

export interface PlanRow {
  key: "free" | "pro" | "business";
  name: string;
  monthly_credits: number;
  price_cents: number;
  price_cents_annual: number | null;
  is_featured: boolean;
}

// Marketing bullet copy — pure display text, no correctness risk the way
// price/credit numbers have, so it stays hardcoded here rather than in the
// database (see docs/architecture.md's 2026-08-09 pricing overhaul entry
// for why the numeric fields DO come from the DB now).
const FEATURES: Record<PlanRow["key"], string[]> = {
  free: ["Check for AI (paste, right-click, floating icon)", "Check history", "Shareable result links"],
  pro: ["Everything in Free", "12× the free plan's monthly words", "Priority support"],
  business: ["Everything in Premium", "Seat pooling", "Admin controls"],
};

const NOTES: Partial<Record<PlanRow["key"], string>> = {
  business: "3 seats included",
};

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PricingPlans({ plans }: { plans: PlanRow[] }) {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  return (
    <>
      <div className="billing-toggle" role="tablist" aria-label="Billing interval">
        <button
          type="button"
          role="tab"
          aria-selected={billingInterval === "month"}
          className={billingInterval === "month" ? "active" : ""}
          onClick={() => setBillingInterval("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billingInterval === "year"}
          className={billingInterval === "year" ? "active" : ""}
          onClick={() => setBillingInterval("year")}
        >
          Annual <span className="save-badge">Save 10%</span>
        </button>
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => {
          const words = (plan.monthly_credits * 1000).toLocaleString();
          const isFree = plan.price_cents === 0;
          const showAnnual = billingInterval === "year" && plan.price_cents_annual != null;
          const displayCents = showAnnual ? Math.round(plan.price_cents_annual! / 12) : plan.price_cents;

          return (
            <div className={`card pricing-card${plan.is_featured ? " featured" : ""}`} key={plan.key}>
              {plan.is_featured && <span className="pricing-badge">Most popular</span>}
              <h3>{plan.name}</h3>

              {isFree ? (
                <p style={{ fontSize: 28, fontWeight: 800, margin: "8px 0" }}>$0</p>
              ) : (
                <>
                  <p style={{ fontSize: 28, fontWeight: 800, margin: "8px 0" }}>
                    ${formatDollars(displayCents)}
                    <span style={{ fontSize: 15, fontWeight: 600 }}>/mo</span>
                  </p>
                  {showAnnual && (
                    <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>
                      billed ${formatDollars(plan.price_cents_annual!)}/year
                    </p>
                  )}
                </>
              )}

              <p>{words} words / month</p>
              {NOTES[plan.key] && <p className="muted">{NOTES[plan.key]}</p>}

              <ul>
                {FEATURES[plan.key].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {plan.key === "free" ? (
                <Link className="cta-button-secondary" href="/login">
                  Get started
                </Link>
              ) : (
                <UpgradeButton
                  planKey={plan.key}
                  billingInterval={billingInterval}
                  label={`Upgrade to ${plan.name}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
