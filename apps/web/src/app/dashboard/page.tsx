import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "./components/SignOutButton";
import ManageBillingButton from "./components/ManageBillingButton";

interface CreditBalanceWithPlanRow {
  credits_remaining: number;
  checks_today: number;
  plans: {
    name: string;
    monthly_credits: number;
    daily_cap: number | null;
  };
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts already redirects unauthenticated requests away from
  // /dashboard — this is a defensive second check, not the primary guard.
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("credit_balances")
    .select("credits_remaining, checks_today, plans(name, monthly_credits, daily_cap)")
    .eq("user_id", user.id)
    .single<CreditBalanceWithPlanRow>();

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", user.id)
    .single<{ status: string; cancel_at_period_end: boolean; current_period_end: string | null }>();

  const plan = data ? (Array.isArray(data.plans) ? data.plans[0] : data.plans) : null;
  const paymentIssue = subscriptionRow?.status === "past_due" || subscriptionRow?.status === "unpaid";
  const endingSoon = subscriptionRow?.status === "active" && subscriptionRow.cancel_at_period_end;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <SignOutButton />
      </div>
      <p className="muted">{user.email}</p>

      {paymentIssue && (
        <div className="card" style={{ borderColor: "#b91c1c", background: "#fef2f2" }}>
          <p style={{ margin: 0 }}>
            <strong>Your last payment didn&apos;t go through.</strong> Your remaining credits still
            work, but you won&apos;t get a new batch until this is fixed.
          </p>
          <ManageBillingButton />
        </div>
      )}

      {endingSoon && (
        <div className="card" style={{ borderColor: "#b45309", background: "#fffbeb" }}>
          <p style={{ margin: 0 }}>
            <strong>Your subscription is set to end</strong>
            {subscriptionRow?.current_period_end
              ? ` on ${new Date(subscriptionRow.current_period_end).toLocaleDateString()}`
              : ""}
            . You&apos;ll keep your plan and credits until then, after which you&apos;ll move to
            the Free plan. Changed your mind? You can resume from Manage billing.
          </p>
          <ManageBillingButton />
        </div>
      )}

      {plan && data ? (
        <div className="card">
          <p>
            You are on the <strong>{plan.name}</strong> plan. {plan.monthly_credits} credits per
            month{plan.daily_cap ? `, ${plan.daily_cap} checks/day` : ""}.
          </p>
          <p className="muted">
            Credits remaining: <strong>{data.credits_remaining}</strong> / {plan.monthly_credits}
            {" · "}
            {data.checks_today} checked today
          </p>
          <Link className="cta-button" href="/pricing">
            Upgrade
          </Link>
          <ManageBillingButton />
        </div>
      ) : (
        <p className="muted">Could not load your plan — try refreshing.</p>
      )}

      <p>
        <Link href="/dashboard/history">View check history →</Link>
      </p>
      <p>
        <Link href="/dashboard/account">Account settings →</Link>
      </p>
    </div>
  );
}
