import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "./components/SignOutButton";
import ManageBillingButton from "./components/ManageBillingButton";

interface CreditBalanceWithPlanRow {
  credits_remaining: number;
  checks_today: number;
  plans: {
    key: string;
    name: string;
    monthly_credits: number;
    daily_cap: number | null;
  };
}

interface RecentCheckRow {
  id: string;
  full_text: string;
  prediction_short: string;
  share_slug: string | null;
  created_at: string;
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
    .select("credits_remaining, checks_today, plans(key, name, monthly_credits, daily_cap)")
    .eq("user_id", user.id)
    .single<CreditBalanceWithPlanRow>();

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", user.id)
    .single<{ status: string; cancel_at_period_end: boolean; current_period_end: string | null }>();

  // RLS already scopes this to the caller's own rows — the explicit filter
  // here is just defense-in-depth/clarity, matching dashboard/history's
  // equivalent query.
  const { data: recentChecksData } = await supabase
    .from("checks")
    .select("id, full_text, prediction_short, share_slug, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<RecentCheckRow[]>();
  const recentChecks = recentChecksData ?? [];

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
          {/* Only meaningful once a real Stripe customer exists — set the
              first time someone completes checkout (see handleCheckout
              SessionCompleted in api/billing/webhook). A Free-plan user
              has never gone through Checkout, so there's nothing to
              manage yet; showing the button anyway was a guaranteed dead
              click with no visual feedback. */}
          {plan.key !== "free" && <ManageBillingButton />}
        </div>
      ) : (
        <p className="muted">Could not load your plan — try refreshing.</p>
      )}

      <div className="dashboard-links">
        <Link href="/dashboard/history" className="dashboard-link-card">
          <span className="dashboard-link-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <strong>Check history</strong>
            <span className="muted" style={{ display: "block", fontSize: 13 }}>
              Every check you&apos;ve run, with results
            </span>
          </span>
          <span className="dashboard-link-chevron">→</span>
        </Link>
        <Link href="/dashboard/account" className="dashboard-link-card">
          <span className="dashboard-link-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <path d="M4 7h10M17 7h3M4 12h3M9 12h11M4 17h13M20 17h0" strokeLinecap="round" />
              <circle cx="12" cy="7" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="6" cy="12" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="16" cy="17" r="1.8" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span>
            <strong>Account settings</strong>
            <span className="muted" style={{ display: "block", fontSize: 13 }}>
              Export your data or delete your account
            </span>
          </span>
          <span className="dashboard-link-chevron">→</span>
        </Link>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Recent checks</h2>
          {recentChecks.length > 0 && (
            <Link href="/dashboard/history" className="muted" style={{ fontSize: 13 }}>
              View all
            </Link>
          )}
        </div>
        {recentChecks.length === 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="muted" style={{ margin: 0 }}>
              No checks yet. Select text on any page and click the AI Checker icon, or paste text
              into the extension directly.
            </p>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 12, padding: 0 }}>
            {recentChecks.map((c) => (
              <Link key={c.id} href={`/history/${c.share_slug}`} className="dashboard-recent-row">
                <span>{c.full_text.slice(0, 70)}…</span>
                <span className={`pill ${c.prediction_short}`}>{c.prediction_short}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
