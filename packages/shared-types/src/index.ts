// Shared types used by both apps/web and apps/extension.
// Keep this the single source of truth for the shapes crossing that boundary.

/**
 * Single source of truth for "how many words is this text" — used for the
 * minimum-length gate (extension button + backend validation must agree on
 * exactly the same count, or the UI could show the button enabled while the
 * backend still rejects it) and for Pangram credit billing
 * (packages/pangram-client), so both mean the same thing everywhere.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const WORDS_PER_CREDIT = 1000;

/**
 * Same reasoning as countWords: the extension's live "N Words, M Credits"
 * counter and pangram-client's actual billing (packages/pangram-client)
 * need to agree exactly, or the number shown before a check wouldn't match
 * what actually gets deducted. Returns 0 for empty text — a real check
 * always costs at least 1 credit once there's any word count at all, but
 * "0 words costs 1 credit" would be a misleading thing to show someone
 * looking at an empty box.
 */
export function creditsForWordCount(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_CREDIT));
}

export type PlanKey = "free" | "pro" | "business";

export interface Plan {
  id: string;
  key: PlanKey;
  name: string;
  monthlyCredits: number;
  dailyCap: number | null;
  priceCents: number; // the monthly price
  priceCentsAnnual: number | null; // the full yearly charge, not priceCents * 12
  billingInterval: "month" | "year";
  seatsIncluded: number;
  isFeatured: boolean;
  features: {
    history: boolean;
    shareableLinks: boolean;
    floatingIcon: boolean;
    googleDocsWidget: boolean; // Phase 2
    feedScanning: boolean; // Phase 2
    prioritySupport?: boolean;
    seatPooling?: boolean;
    adminControls?: boolean;
  };
}

export interface CreditBalance {
  planId: string;
  creditsRemaining: number;
  periodEnd: string; // ISO date
  checksToday: number;
  dayResetAt: string; // ISO date
}

export type Prediction = "ai" | "human" | "mixed";

export interface CheckWindow {
  label: Prediction;
  aiAssistanceScore: number;
  confidence: number;
  startChar: number;
  endChar: number;
  wordCount: number;
}

export interface CheckResult {
  id: string;
  fullText: string;
  wordCount: number;
  creditsUsed: number;
  prediction: string; // human-readable, e.g. "AI Generated"
  predictionShort: Prediction;
  fractionAi: number;
  fractionHuman: number;
  fractionAiAssisted: number;
  sourceUrl: string | null;
  isPublic: boolean;
  shareSlug: string | null;
  windows: CheckWindow[];
  createdAt: string; // ISO date
}

// --- API contracts between apps/extension and apps/web -----------------

export interface CreateCheckRequest {
  text: string;
  sourceUrl?: string;
}

export type CreateCheckResponse =
  | { ok: true; result: CheckResult; creditsRemaining: number }
  | { ok: false; error: "insufficient_credits"; creditsRemaining: number }
  | { ok: false; error: "daily_cap_reached" }
  | {
      ok: false;
      error: "unauthorized";
      // Populated only by /api/checks' anonymous-trial branch — distinguishes
      // otherwise-identical 401s (missing device id, trial kill-switch off,
      // trial/cap exhausted, RPC failure) that used to collapse into the same
      // response, indistinguishable from "not signed in" client-side.
      reason?: "no_device_id" | "trial_disabled" | "trial_exhausted" | "anon_daily_cap_reached" | "rpc_failed";
    }
  | { ok: false; error: "text_too_short" | "text_too_long" }
  | { ok: false; error: "upstream_error"; message: string };

export type ShareCheckResponse =
  | { ok: true; shareSlug: string }
  | { ok: false; error: "unauthorized" | "not_found" };

/**
 * Backs the Check tab's "Upload file" button / drag-and-drop (see
 * apps/web/src/app/api/parse-file/route.ts and
 * apps/extension/src/lib/api.ts's parseFile). Deliberately returns the
 * full extracted text with no server-side length rejection — the existing
 * 50-word/50,000-char rules on the check itself (already enforced both
 * client- and server-side) apply identically whether the text came from
 * typing, pasting, or a parsed file, so this endpoint's only job is text
 * extraction, not re-implementing those rules a second time.
 */
export type ParseFileResponse =
  | { ok: true; text: string }
  | { ok: false; error: "unrecognized_text" }
  | { ok: false; error: "unsupported_type" }
  | { ok: false; error: "legacy_doc_unsupported" }
  | { ok: false; error: "file_too_large" }
  | { ok: false; error: "unauthorized" }
  | { ok: false; error: "upstream_error"; message: string };

// Anonymous, pre-signup trial credits — see api/trial and api/checks'
// unauthenticated branch. Keyed on a client-generated device ID, not a
// user; 0 once exhausted or once the anonymous_trial_enabled app_config
// flag is off.
export interface TrialStatusResponse {
  trialCreditsRemaining: number;
}

// Backs the extension's "Rate us" tab — see apps/extension/src/panel/tabs/
// RateUsTab.tsx and apps/web/src/app/api/feedback/rating/route.ts. `id` is
// generated client-side (crypto.randomUUID()) at the moment of the star
// click, not returned from the server — window.open() has to run
// synchronously inside the click handler to avoid the popup blocker, so
// there's no round-trip to wait on first. The same id is reused if the
// user later writes a comment on apps/web's /feedback page, so the API
// route upserts onto one row per rating instead of inserting a second one.
export interface LogRatingRequest {
  id: string;
  rating: number;
  appVersion?: string;
}

const NON_HUMAN_LABELS: Prediction[] = ["ai", "mixed"];

/**
 * Synthesizes a one-line narrative from window position data — e.g. "AI
 * involvement is concentrated in the later part of this text." Returns
 * null when there's nothing positional worth saying: no window data, a
 * single window, or every window sharing one label (nothing to contrast
 * against). Shared by both apps since it's pure and only depends on
 * CheckWindow — see docs/architecture.md for why shared-types carries
 * runtime code, not just types.
 */
export function synthesizeInsight(windows: CheckWindow[]): string | null {
  if (windows.length < 2) return null;
  if (new Set(windows.map((w) => w.label)).size === 1) return null;

  const sorted = [...windows].sort((a, b) => a.startChar - b.startChar);
  const spanStart = sorted[0]!.startChar;
  const spanEnd = sorted[sorted.length - 1]!.endChar;
  const span = spanEnd - spanStart;
  if (span <= 0) return null;

  const nonHuman = sorted.filter((w) => NON_HUMAN_LABELS.includes(w.label));
  if (nonHuman.length === 0) return null;

  const relPositions = nonHuman.map((w) => ((w.startChar + w.endChar) / 2 - spanStart) / span);
  const minPos = Math.min(...relPositions);
  const maxPos = Math.max(...relPositions);

  // Spread across more than 60% of the text's range — nowhere to point to.
  if (maxPos - minPos > 0.6) {
    return "AI involvement appears scattered throughout this text, rather than concentrated in one section.";
  }

  const avgPos = relPositions.reduce((a, b) => a + b, 0) / relPositions.length;
  const region = avgPos < 0.33 ? "earlier part" : avgPos > 0.67 ? "later part" : "middle";
  return `AI involvement is concentrated in the ${region} of this text.`;
}

export interface HighlightSegment {
  text: string;
  label: Prediction | null; // null = not covered by any window, rendered plain
}

/**
 * Splits full_text into ordered segments by window boundaries so the
 * detail page can render colored spans without guessing at gaps — windows
 * don't always cover the entire text contiguously, and uncovered stretches
 * render plain (label: null) rather than being misclassified as human.
 */
export function buildHighlightSegments(fullText: string, windows: CheckWindow[]): HighlightSegment[] {
  const sorted = [...windows].sort((a, b) => a.startChar - b.startChar);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const w of sorted) {
    if (w.startChar > cursor) {
      segments.push({ text: fullText.slice(cursor, w.startChar), label: null });
    }
    if (w.endChar > cursor) {
      segments.push({ text: fullText.slice(Math.max(cursor, w.startChar), w.endChar), label: w.label });
      cursor = w.endChar;
    }
  }
  if (cursor < fullText.length) {
    segments.push({ text: fullText.slice(cursor), label: null });
  }
  return segments;
}

export type ConfidenceLabel = "High" | "Medium" | "Low";

/**
 * Word-count-weighted average of each window's own confidence — same
 * aggregation shape already used for fractionAi/fractionHuman/
 * fractionAiAssisted. Shared by ResultCard.tsx (extension) and
 * /history/[slug] (web) so both surfaces derive it identically rather
 * than duplicating the math.
 */
export function overallConfidence(windows: CheckWindow[]): number {
  const totalWords = windows.reduce((sum, w) => sum + w.wordCount, 0);
  if (totalWords === 0) return 0;
  return windows.reduce((sum, w) => sum + w.confidence * w.wordCount, 0) / totalWords;
}

/**
 * Thresholds are this integration's own choice, not vendor-provided —
 * same "provisional, tune once real traffic gives a bigger sample" caveat
 * as packages/truthscan-client's AI/Human/Mixed score cutoffs. Picked
 * against what's actually been observed live: TruthScan's per-sentence
 * scores cluster heavily at the confident extremes, with genuinely
 * ambiguous sentences (e.g. the Gettysburg Address's stylistically
 * unusual opening line, confirmed across multiple tests) landing near 0.
 */
export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.6) return "High";
  if (confidence >= 0.3) return "Medium";
  return "Low";
}

export interface PositionalBlock {
  label: Prediction;
  startChar: number;
  endChar: number;
  wordCount: number;
  confidence: number;
}

/**
 * Merges adjacent same-label windows into one contiguous block — built
 * for the /history/[slug] positional bar widget. TruthScan's per-sentence
 * windows would otherwise render as a noisy hatch of many thin same-color
 * segments (a 15-sentence human paragraph is 15 windows, not one); this
 * collapses runs of the same label into a single block sized by their
 * combined word count, matching how Pangram's own UI reads as clean
 * colored regions rather than per-sentence stripes. The underlying
 * per-sentence windows (unmerged) still back the highlighted-text view
 * and per-sentence tooltips — no data is discarded, just presented
 * differently for this one widget.
 */
export function buildPositionalBlocks(windows: CheckWindow[]): PositionalBlock[] {
  const sorted = [...windows].sort((a, b) => a.startChar - b.startChar);
  const blocks: PositionalBlock[] = [];

  for (const w of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && last.label === w.label) {
      const mergedWords = last.wordCount + w.wordCount;
      last.confidence =
        mergedWords > 0 ? (last.confidence * last.wordCount + w.confidence * w.wordCount) / mergedWords : 0;
      last.wordCount = mergedWords;
      last.endChar = w.endChar;
    } else {
      blocks.push({ label: w.label, startChar: w.startChar, endChar: w.endChar, wordCount: w.wordCount, confidence: w.confidence });
    }
  }
  return blocks;
}

export interface MeResponse {
  email: string;
  plan: {
    key: PlanKey;
    name: string;
    monthlyCredits: number;
    dailyCap: number | null;
  };
  creditsRemaining: number;
  checksToday: number;
}
