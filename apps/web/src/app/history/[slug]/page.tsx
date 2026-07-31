import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DeleteCheckButton from "./components/DeleteCheckButton";

interface CheckRow {
  id: string;
  user_id: string;
  full_text: string;
  word_count: number;
  prediction: string;
  prediction_short: string;
  fraction_ai: number;
  fraction_human: number;
  fraction_ai_assisted: number;
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

  const [{ data: check }, { data: userData }] = await Promise.all([
    supabase
      .from("checks")
      .select(
        "id, user_id, full_text, word_count, prediction, prediction_short, fraction_ai, fraction_human, fraction_ai_assisted, is_public"
      )
      .eq("share_slug", slug)
      .single<CheckRow>(),
    supabase.auth.getUser(),
  ]);

  if (!check) notFound();

  const isOwner = userData.user?.id === check.user_id;
  const aiInvolvement = Math.round((check.fraction_ai + check.fraction_ai_assisted) * 100);

  return (
    <div className="container">
      <h1>Check result</h1>
      <div className="card">
        <p className={`pill ${check.prediction_short}`}>{check.prediction}</p>

        <div style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 0" }}>{aiInvolvement}%</div>
        <p className="muted" style={{ margin: 0 }}>
          of this text shows AI involvement
        </p>

        <div className="breakdown-bar">
          <div className="seg ai" style={{ width: `${check.fraction_ai * 100}%` }} />
          <div className="seg assisted" style={{ width: `${check.fraction_ai_assisted * 100}%` }} />
          <div className="seg human" style={{ width: `${check.fraction_human * 100}%` }} />
        </div>
        <div className="breakdown-legend">
          <span>
            <i className="dot ai" />
            AI {Math.round(check.fraction_ai * 100)}%
          </span>
          <span>
            <i className="dot assisted" />
            Assisted {Math.round(check.fraction_ai_assisted * 100)}%
          </span>
          <span>
            <i className="dot human" />
            Human {Math.round(check.fraction_human * 100)}%
          </span>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          {check.word_count} words
        </p>
        <div className="checked-text">{check.full_text}</div>

        {!check.is_public && (
          <p className="muted" style={{ marginTop: 12 }}>
            This result is private — only you can see this link.
          </p>
        )}
      </div>

      {isOwner && (
        <p>
          <DeleteCheckButton checkId={check.id} />
        </p>
      )}
    </div>
  );
}
