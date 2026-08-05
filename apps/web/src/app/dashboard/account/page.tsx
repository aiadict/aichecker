import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ExportDataButton from "./components/ExportDataButton";
import DeleteAccountButton from "./components/DeleteAccountButton";

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
    <div className="container">
      <h1>Account Settings</h1>

      <div className="card">
        <h3>Account</h3>
        <p className="muted">{user.email}</p>
        <p className="muted">
          Account created <strong>{new Date(user.created_at).toLocaleDateString()}</strong>
        </p>
      </div>

      <div className="card">
        <h3>Your data</h3>
        <p className="muted">
          Download every check you&apos;ve ever run, as a single JSON file — your text, results,
          and timestamps.
        </p>
        <ExportDataButton />
      </div>

      <div className="card" style={{ borderColor: "#fecaca" }}>
        <h3>Delete account</h3>
        <p className="muted">
          Permanently deletes your account and everything tied to it — check history, settings,
          and billing link. This can&apos;t be undone.
          {planKey !== "free" && " Cancel your paid plan from the dashboard's \"Manage billing\" first."}
        </p>
        <DeleteAccountButton />
      </div>

      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
    </div>
  );
}
