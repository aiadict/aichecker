import Link from "next/link";
import { getMockCreditsRemaining, MOCK_FREE_PLAN } from "@/lib/mock-store";

// TODO: replace mock-store reads with a real authenticated Supabase query
// (subscriptions + credit_balances joined to the user's session).
export default function DashboardPage() {
  const remaining = getMockCreditsRemaining();

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <div className="card">
        <p>
          You are on the <strong>Free</strong> plan. {MOCK_FREE_PLAN.monthlyCredits} credits per
          month.
        </p>
        <p className="muted">
          Credits remaining: <strong>{remaining}</strong> / {MOCK_FREE_PLAN.monthlyCredits}
        </p>
        <Link className="cta-button" href="/pricing">
          Upgrade
        </Link>
      </div>
      <p>
        <Link href="/dashboard/history">View check history →</Link>
      </p>
    </div>
  );
}
