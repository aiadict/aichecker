import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface CheckRow {
  id: string;
  full_text: string;
  prediction_short: string;
  share_slug: string | null;
  created_at: string;
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS already scopes this to the caller's own rows — the explicit filter
  // here is just defense-in-depth/clarity, matching lib/checks-repo.ts's
  // admin-client equivalent used by the extension-facing API routes.
  const { data } = await supabase
    .from("checks")
    .select("id, full_text, prediction_short, share_slug, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CheckRow[]>();

  const checks = data ?? [];

  return (
    <div className="container">
      <h1>All Checks</h1>
      {checks.length === 0 ? (
        <p className="muted">
          No checks yet. Run one from the extension, or <code>POST /api/checks</code> locally.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Text</th>
              <th>Date</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <td>{c.full_text.slice(0, 60)}…</td>
                <td className="muted">{new Date(c.created_at).toLocaleString()}</td>
                <td>
                  <Link href={`/history/${c.share_slug}`}>
                    <span className={`pill ${c.prediction_short}`}>{c.prediction_short}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
