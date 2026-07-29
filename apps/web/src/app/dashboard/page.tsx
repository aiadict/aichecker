import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "./components/SignOutButton";

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

  const plan = data ? (Array.isArray(data.plans) ? data.plans[0] : data.plans) : null;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <SignOutButton />
      </div>
      <p className="muted">{user.email}</p>

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
        </div>
      ) : (
        <p className="muted">Could not load your plan — try refreshing.</p>
      )}

      <p>
        <Link href="/dashboard/history">View check history →</Link>
      </p>
    </div>
  );
}
