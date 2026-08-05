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
  priceCents: number;
  billingInterval: "month" | "year";
  seatsIncluded: number;
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
  | { ok: false; error: "unauthorized" }
  | { ok: false; error: "text_too_short" | "text_too_long" }
  | { ok: false; error: "upstream_error"; message: string };

export type ShareCheckResponse =
  | { ok: true; shareSlug: string }
  | { ok: false; error: "unauthorized" | "not_found" };

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
