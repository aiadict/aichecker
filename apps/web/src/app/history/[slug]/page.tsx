import { notFound } from "next/navigation";
import { buildHighlightSegments, synthesizeInsight, type CheckWindow, type Prediction } from "@ai-checker/shared-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DeleteCheckButton from "./components/DeleteCheckButton";
import ShareResultButton from "./components/ShareResultButton";

interface WindowRow {
  label: string;
  ai_assistance_score: number;
  confidence: number;
  start_char: number;
  end_char: number;
  word_count: number;
}

function mapWindow(row: WindowRow): CheckWindow {
  return {
    label: row.label as Prediction,
    aiAssistanceScore: row.ai_assistance_score,
    confidence: row.confidence,
    startChar: row.start_char,
    endChar: row.end_char,
    wordCount: row.word_count,
  };
}

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
  share_slug: string;
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
        "id, user_id, full_text, word_count, prediction, prediction_short, fraction_ai, fraction_human, fraction_ai_assisted, is_public, share_slug"
      )
      .eq("share_slug", slug)
      .single<CheckRow>(),
    supabase.auth.getUser(),
  ]);

  if (!check) notFound();

  const isOwner = userData.user?.id === check.user_id;
  const aiInvolvement = Math.round((check.fraction_ai + check.fraction_ai_assisted) * 100);

  // Fetched after we have check.id — RLS already covers owner-or-public
  // read here (see "users can read windows of own checks" policy), same
  // rule as the checks row itself.
  const { data: windowRows } = await supabase
    .from("check_windows")
    .select("label, ai_assistance_score, confidence, start_char, end_char, word_count")
    .eq("check_id", check.id)
    .order("start_char")
    .returns<WindowRow[]>();

  const windows = (windowRows ?? []).map(mapWindow);
  const segments = buildHighlightSegments(check.full_text, windows);
  const insight = synthesizeInsight(windows);

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

        {insight && (
          <p className="muted" style={{ marginTop: 12 }}>
            {insight}
          </p>
        )}

        <p className="muted" style={{ marginTop: 16 }}>
          {check.word_count} words
        </p>
        <div className="checked-text">
          {segments.map((seg, i) =>
            seg.label && seg.label !== "human" ? (
              <mark key={i} className={`hl-${seg.label}`}>
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>

        {!check.is_public && (
          <p className="muted" style={{ marginTop: 12 }}>
            This result is private — only you can see this link.
          </p>
        )}
      </div>

      {isOwner && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <ShareResultButton checkId={check.id} shareSlug={check.share_slug} initialIsPublic={check.is_public} />
          <DeleteCheckButton checkId={check.id} />
        </div>
      )}
    </div>
  );
}
