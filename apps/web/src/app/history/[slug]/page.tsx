import { notFound } from "next/navigation";
import { type CheckWindow, type Prediction } from "@ai-checker/shared-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DeleteCheckButton from "./components/DeleteCheckButton";
import ShareResultButton from "./components/ShareResultButton";
import CheckResultView from "./components/CheckResultView";

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

  return (
    <div className="container">
      <h1>Check result</h1>
      <CheckResultView
        fullText={check.full_text}
        wordCount={check.word_count}
        prediction={check.prediction}
        predictionShort={check.prediction_short as Prediction}
        fractionAi={check.fraction_ai}
        fractionHuman={check.fraction_human}
        fractionAiAssisted={check.fraction_ai_assisted}
        windows={windows}
        footerNote={
          !check.is_public && (
            <p className="muted" style={{ marginTop: 12 }}>
              This result is private - only you can see this link.
            </p>
          )
        }
      />

      {isOwner && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <ShareResultButton checkId={check.id} shareSlug={check.share_slug} initialIsPublic={check.is_public} />
          <DeleteCheckButton checkId={check.id} />
        </div>
      )}
    </div>
  );
}
