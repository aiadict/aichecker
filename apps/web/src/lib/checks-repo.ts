import { randomUUID } from "node:crypto";
import type { CheckResult, CheckWindow, Prediction } from "@ai-checker/shared-types";
import { getSupabaseAdmin } from "./supabase/admin";

interface CheckRow {
  id: string;
  text_snippet: string;
  word_count: number;
  credits_used: number;
  prediction: string | null;
  prediction_short: string | null;
  fraction_ai: number | null;
  fraction_human: number | null;
  fraction_ai_assisted: number | null;
  source_url: string | null;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
}

function mapCheck(row: CheckRow, windows: CheckWindow[]): CheckResult {
  return {
    id: row.id,
    textSnippet: row.text_snippet,
    wordCount: row.word_count,
    creditsUsed: row.credits_used,
    prediction: row.prediction ?? "",
    predictionShort: (row.prediction_short as Prediction) ?? "mixed",
    fractionAi: row.fraction_ai ?? 0,
    fractionHuman: row.fraction_human ?? 0,
    fractionAiAssisted: row.fraction_ai_assisted ?? 0,
    sourceUrl: row.source_url,
    isPublic: row.is_public,
    shareSlug: row.share_slug,
    windows,
    createdAt: row.created_at,
  };
}

export interface InsertCheckParams {
  userId: string;
  textSnippet: string;
  wordCount: number;
  creditsUsed: number;
  prediction: string;
  predictionShort: Prediction;
  fractionAi: number;
  fractionHuman: number;
  fractionAiAssisted: number;
  sourceUrl: string | null;
  windows: CheckWindow[];
}

export async function insertCheck(params: InsertCheckParams): Promise<CheckResult> {
  const admin = getSupabaseAdmin();
  const shareSlug = randomUUID();

  const { data: checkRow, error } = await admin
    .from("checks")
    .insert({
      user_id: params.userId,
      text_snippet: params.textSnippet,
      word_count: params.wordCount,
      credits_used: params.creditsUsed,
      prediction: params.prediction,
      prediction_short: params.predictionShort,
      fraction_ai: params.fractionAi,
      fraction_human: params.fractionHuman,
      fraction_ai_assisted: params.fractionAiAssisted,
      source_url: params.sourceUrl,
      is_public: false,
      share_slug: shareSlug,
    })
    .select()
    .single();

  if (error || !checkRow) {
    throw new Error(`Failed to insert check: ${error?.message ?? "unknown error"}`);
  }

  if (params.windows.length > 0) {
    const { error: windowsError } = await admin.from("check_windows").insert(
      params.windows.map((w) => ({
        check_id: checkRow.id,
        label: w.label,
        ai_assistance_score: w.aiAssistanceScore,
        confidence: w.confidence,
        start_char: w.startChar,
        end_char: w.endChar,
        word_count: w.wordCount,
      }))
    );
    if (windowsError) {
      throw new Error(`Failed to insert check windows: ${windowsError.message}`);
    }
  }

  return mapCheck(checkRow as CheckRow, params.windows);
}

export async function listChecksForUser(userId: string, limit: number): Promise<CheckResult[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("checks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list checks: ${error.message}`);
  // Windows aren't fetched for list views (only needed for the full-detail
  // result page) — keeps the common "last N checks" query cheap.
  return (data as CheckRow[]).map((row) => mapCheck(row, []));
}

export async function findCheckByShareSlug(slug: string): Promise<CheckResult | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("checks").select("*").eq("share_slug", slug).single();

  if (error || !data) return null;
  return mapCheck(data as CheckRow, []);
}
