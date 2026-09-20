import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ExportDataButton from "./components/ExportDataButton";
import DeleteAccountButton from "./components/DeleteAccountButton";
import SignOutButton from "../components/SignOutButton";

export default async function AccountSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: planRow } = await supabase
    .from("credit_balances")
    .select("plans(key)")
    .eq("user_id", user.id)
    .single<{ plans: { key: string } | { key: string }[] }>();
  const planKey = planRow ? (Array.isArray(planRow.plans) ? planRow.plans[0]?.key : planRow.plans?.key) : "free";

  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <Link href="/dashboard" className="account-back-link">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to dashboard
      </Link>

      <h1>Account settings</h1>
      <p className="muted">Manage your account and your data.</p>

      <div className="card account-card">
        <div className="account-row">
          <div className="account-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="account-row-text">
            <h3>Your account</h3>
            <p className="muted" style={{ margin: "2px 0 0" }}>{user.email}</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
              Account created <strong>{new Date(user.created_at).toLocaleDateString()}</strong>
            </p>
          </div>
          <SignOutButton className="account-btn account-btn-outline" icon />
        </div>
      </div>

      <div className="card account-card">
        <div className="account-row">
          <div className="account-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 4v11" strokeLinecap="round" />
              <path d="M7 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 19h16" strokeLinecap="round" />
            </svg>
          </div>
          <div className="account-row-text">
            <h3>Export your data</h3>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Download all your checks, including your text, results, and timestamps, in a single
              JSON file.
            </p>
          </div>
          <ExportDataButton />
        </div>
      </div>

      <div className="card account-card account-card-danger">
        <div className="account-row">
          <div className="account-icon account-icon-danger">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 7l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 11v6M14 11v6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="account-row-text">
            <h3>Delete account</h3>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Permanently delete your account, check history, remaining credits, settings, and
              billing link.
            </p>
            <p style={{ margin: "10px 0 0" }}>
              <strong>This can&apos;t be undone.</strong>{" "}
              <span className="muted">Signing up again with the same email starts with 0 credits.</span>
            </p>
          </div>
        </div>

        <div className="account-danger-footer">
          <p className="muted account-billing-note">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="2.5" y="5" width="19" height="14" rx="2" />
              <path d="M2.5 10h19" />
            </svg>
            {planKey !== "free" ? (
              <>
                Have a paid plan? Cancel it in <Link href="/dashboard">Manage billing</Link> before
                deleting your account.
              </>
            ) : (
              "Deleting your account also removes any billing history tied to it."
            )}
          </p>
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  );
}
