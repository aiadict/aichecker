import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface CheckRow {
  text_snippet: string;
  word_count: number;
  prediction: string;
  prediction_short: string;
  fraction_ai: number;
  is_public: boolean;
}

// Public, read-only shared result page — mirrors Pangram's
// pangram.com/history/<uuid> pattern. Uses the cookie-scoped SSR client
// (not the admin client), so RLS itself decides visibility: the owner can
// always see their own check here (auth.uid() = user_id), anyone else only
// if is_public = true — see supabase/migrations/..._rls_policies.sql. No
// application-level "is it public" check needed; RLS is the enforcement.
export default async function SharedCheckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: check } = await supabase
    .from("checks")
    .select("text_snippet, word_count, prediction, prediction_short, fraction_ai, is_public")
    .eq("share_slug", slug)
    .single<CheckRow>();

  if (!check) notFound();

  return (
    <div className="container">
      <h1>Check result</h1>
      <div className="card">
        <p>{check.text_snippet}</p>
        <p className={`pill ${check.prediction_short}`}>{check.prediction}</p>
        <p className="muted">
          {check.word_count} words · {Math.round(check.fraction_ai * 100)}% AI
        </p>
        {!check.is_public && <p className="muted">This result is private — only you can see this link.</p>}
      </div>
    </div>
  );
}
