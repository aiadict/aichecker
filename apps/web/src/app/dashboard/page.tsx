import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ManageBillingButton from "./components/ManageBillingButton";
import ExtensionHelpAccordion from "./components/ExtensionHelpAccordion";

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

const PREDICTION_LABELS: Record<string, string> = { ai: "AI", human: "Human", mixed: "Mixed" };

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
  const creditsPct = data && plan ? Math.max(0, Math.min(100, (data.credits_remaining / plan.monthly_credits) * 100)) : 0;
  const creditsUsed = data && plan ? plan.monthly_credits - data.credits_remaining : 0;

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <p className="muted" style={{ margin: 0 }}>
        Welcome back, {user.email}
      </p>

      <ExtensionHelpAccordion />

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
        <div className="card dashboard-plan-card">
          <div className="dashboard-plan-col">
            <p className="dashboard-plan-label">Current plan</p>
            <p className="dashboard-plan-name">{plan.name}</p>
            <p className="dashboard-plan-sub">{plan.monthly_credits} credits per month</p>
            <div className="dashboard-plan-actions">
              <Link className="account-btn account-btn-outline" href="/pricing">
                Upgrade plan
              </Link>
              {/* Only meaningful once a real Stripe customer exists — set the
                  first time someone completes checkout (see handleCheckout
                  SessionCompleted in api/billing/webhook). A Free-plan user
                  has never gone through Checkout, so there's nothing to
                  manage yet; showing the button anyway was a guaranteed dead
                  click with no visual feedback. */}
              {plan.key !== "free" && <ManageBillingButton />}
            </div>
          </div>

          <div className="dashboard-plan-col">
            <p className="dashboard-plan-label">Credits remaining</p>
            <p style={{ margin: 0 }}>
              <span className="dashboard-credit-value">{data.credits_remaining}</span>
              <span className="dashboard-credit-of">of {plan.monthly_credits} credits</span>
            </p>
            <div className="dashboard-progress-track">
              <div className="dashboard-progress-fill" style={{ width: `${creditsPct}%` }} />
            </div>
            <div className="dashboard-progress-labels">
              <span>{creditsUsed} credits used</span>
              <span>{plan.monthly_credits} included</span>
            </div>
          </div>

          <div className="dashboard-plan-col">
            <p className="dashboard-plan-label">Checks today</p>
            <p className="dashboard-checks-value">{data.checks_today}</p>
            <p className="dashboard-plan-sub">View your results in recent checks.</p>
            {plan.daily_cap && (
              <p className="dashboard-plan-sub" style={{ fontSize: 12 }}>
                {plan.daily_cap} checks/day limit
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="muted">Could not load your plan - try refreshing.</p>
      )}

      <div className="dashboard-links">
        <Link href="/check" className="dashboard-link-card">
          <span className="dashboard-link-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <path d="M4 15h7" strokeLinecap="round" />
              <path d="M4 18.5h4.5" strokeLinecap="round" />
              <circle cx="15" cy="10" r="4.3" />
              <line x1="18" y1="13" x2="20.5" y2="15.5" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <strong>Run a new check</strong>
            <span className="muted" style={{ display: "block", fontSize: 13 }}>
              Paste text and check it right here on the web
            </span>
          </span>
          <span className="dashboard-link-chevron">→</span>
        </Link>
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
            <Link href="/dashboard/history" className="dashboard-view-all">
              View all
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
        {recentChecks.length === 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="muted" style={{ margin: 0 }}>
              No checks yet. Select text on any page and click the AI Checker icon, paste text
              into the extension directly, or <Link href="/check">run a check right here</Link>.
            </p>
          </div>
        ) : (
          <div className="card dashboard-recent-table" style={{ marginTop: 12 }}>
            <div className="dashboard-recent-head">
              <span>Text checked</span>
              <span>Result</span>
            </div>
            {recentChecks.map((c) => (
              <Link key={c.id} href={`/history/${c.share_slug}`} className="dashboard-recent-row">
                <span className="dashboard-recent-preview">
                  <span className="dashboard-recent-icon">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
                      <path d="M14 3v5h5" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="dashboard-recent-text">{c.full_text.slice(0, 70)}…</span>
                </span>
                <span className="dashboard-recent-result">
                  <span className={`pill ${c.prediction_short}`}>
                    {PREDICTION_LABELS[c.prediction_short] ?? c.prediction_short}
                  </span>
                  <span className="dashboard-recent-view">
                    <span className="dashboard-recent-view-label">View result</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17 17 7M8 7h9v9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
