/**
 * SERVER-ONLY. Import this package exclusively from apps/web's API routes
 * (or any future server context) — never from apps/extension. The Pangram
 * API key must not exist anywhere a browser extension bundle can be
 * inspected (chrome://extensions -> Inspect exposes all extension code).
 *
 * Talks to Pangram's REST "Inference API" (https://docs.pangram.com), which
 * is submit-then-poll rather than a single synchronous call:
 *   POST /task            -> { task_id }
 *   GET  /task/{task_id}  -> { stage: STAGE_SUCCESS | STAGE_FAILED | ..., ... }
 * Auth is a single `x-api-key` header. Base URL is the text-detection host,
 * distinct from Pangram's file-upload and plagiarism hosts (not used here).
 *
 * Falls back to a deterministic MOCK response when PANGRAM_API_KEY is unset
 * (e.g. CI, or local dev without the key) so the rest of the product stays
 * testable without hitting the real, billed API.
 */

import type { CheckWindow, Prediction } from "@ai-checker/shared-types";

export interface PangramPredictResult {
  prediction: string;
  predictionShort: Prediction;
  fractionAi: number;
  fractionHuman: number;
  fractionAiAssisted: number;
  windows: CheckWindow[];
  wordCount: number;
  isMocked: boolean;
  dashboardLink?: string;
}

export interface PangramClientOptions {
  apiKey?: string;
  /** "realtime" ($0.05/1k words) or "bulk" ($0.04/1k words) — see docs/product-spec.md §3 */
  mode?: "realtime" | "bulk";
}

const WORDS_PER_CREDIT = 1000;
const API_BASE_URL = "https://text.external-api.pangram.com";
const POLL_INTERVAL_MS = 700;
const MAX_POLL_ATTEMPTS = 40; // ~28s ceiling before giving up

/**
 * Thrown for any non-2xx response from Pangram. `status` lets callers
 * distinguish e.g. 402 (Pangram account itself is out of prepaid credits —
 * top up at pangram.com, unrelated to OUR users' plan credits) from other
 * failures without string-matching error messages.
 */
export class PangramApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "PangramApiError";
    this.status = status;
    this.body = body;
  }
}

export class PangramClient {
  private readonly apiKey: string | undefined;
  private readonly mode: "realtime" | "bulk";

  constructor(options: PangramClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.PANGRAM_API_KEY;
    this.mode = options.mode ?? "realtime";
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** $/1,000-word credit for the currently configured mode. Used by scripts/estimate-margin.ts. */
  get costPerCredit(): number {
    return this.mode === "bulk" ? 0.04 : 0.05;
  }

  async predict(text: string): Promise<PangramPredictResult> {
    const wordCount = countWords(text);

    if (!this.isConfigured) {
      return mockPredict(text, wordCount);
    }

    const taskId = await this.submitTask(text);
    const result = await this.pollTask(taskId);
    return mapPangramResponse(result, wordCount);
  }

  creditsForWordCount(wordCount: number): number {
    return Math.max(1, Math.ceil(wordCount / WORDS_PER_CREDIT));
  }

  private async submitTask(text: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey!,
      },
      body: JSON.stringify({ text, public_dashboard_link: false }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new PangramApiError(`Pangram /task submit failed (${res.status})`, res.status, body);
    }
    const data = (await res.json()) as { task_id: string };
    return data.task_id;
  }

  private async pollTask(taskId: string): Promise<PangramTaskSuccess> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const res = await fetch(`${API_BASE_URL}/task/${taskId}`, {
        headers: { "x-api-key": this.apiKey! },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new PangramApiError(`Pangram /task poll failed (${res.status})`, res.status, body);
      }
      const data = (await res.json()) as PangramTaskResponse;
      if (data.stage === "STAGE_SUCCESS") return data as PangramTaskSuccess;
      if (data.stage === "STAGE_FAILED") {
        throw new Error(`Pangram task ${taskId} failed during processing`);
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`Pangram task ${taskId} timed out after ${MAX_POLL_ATTEMPTS} polls`);
  }
}

// --- Pangram wire types (raw REST response shapes) --------------------------

interface PangramTaskWindow {
  text: string;
  label: string; // e.g. "AI-Generated", "Human-Written", "AI-Assisted"
  ai_assistance_score: number;
  confidence: string; // e.g. "High" | "Medium" | "Low"
  start_index: number;
  end_index: number;
  word_count: number;
  token_length: number;
}

interface PangramTaskSuccess {
  stage: "STAGE_SUCCESS";
  text: string;
  version: string;
  headline: string;
  prediction: string;
  prediction_short: string;
  fraction_ai: number;
  fraction_ai_assisted: number;
  fraction_human: number;
  windows: PangramTaskWindow[];
  dashboard_link?: string;
}

interface PangramTaskInProgress {
  task_id: string;
  stage: string; // e.g. "STAGE_PREPROCESSING", "STAGE_FAILED"
}

type PangramTaskResponse = PangramTaskSuccess | PangramTaskInProgress;

// --- Mapping real Pangram responses to our internal shape -------------------

function mapPangramResponse(data: PangramTaskSuccess, wordCount: number): PangramPredictResult {
  const windows: CheckWindow[] = (data.windows ?? []).map((w) => ({
    label: mapLabelToPrediction(w.label),
    aiAssistanceScore: w.ai_assistance_score,
    confidence: mapConfidenceToScore(w.confidence),
    startChar: w.start_index,
    endChar: w.end_index,
    wordCount: w.word_count,
  }));

  return {
    prediction: data.prediction,
    predictionShort: mapLabelToPrediction(data.prediction_short),
    fractionAi: data.fraction_ai,
    fractionHuman: data.fraction_human,
    fractionAiAssisted: data.fraction_ai_assisted,
    windows,
    wordCount,
    isMocked: false,
    dashboardLink: data.dashboard_link,
  };
}

function mapLabelToPrediction(label: string): Prediction {
  const lower = label.toLowerCase();
  if (lower.includes("human") && !lower.includes("ai")) return "human";
  if (lower.includes("mixed") || lower.includes("assist")) return "mixed";
  if (lower.includes("ai")) return "ai";
  return "mixed";
}

function mapConfidenceToScore(confidence: string): number {
  switch (confidence?.toLowerCase()) {
    case "high":
      return 0.9;
    case "medium":
      return 0.6;
    case "low":
      return 0.3;
    default:
      return 0.5;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Deterministic mock: classifies based on a simple heuristic so the UI has
 * something believable to render in dev/CI without ever calling out to
 * Pangram. Not for production use. Active whenever PANGRAM_API_KEY is unset.
 */
function mockPredict(text: string, wordCount: number): PangramPredictResult {
  const hash = simpleHash(text);
  const fractionAi = wordCount === 0 ? 0 : (hash % 100) / 100;
  const fractionHuman = Math.max(0, 1 - fractionAi - 0.05);
  const fractionAiAssisted = Math.max(0, 1 - fractionAi - fractionHuman);

  const predictionShort: Prediction =
    fractionAi > 0.6 ? "ai" : fractionAi < 0.2 ? "human" : "mixed";
  const prediction =
    predictionShort === "ai"
      ? "AI Generated"
      : predictionShort === "human"
        ? "Human Written"
        : "Mixed / AI-Assisted";

  const windows: CheckWindow[] =
    wordCount > 0
      ? [
          {
            label: predictionShort,
            aiAssistanceScore: fractionAi,
            confidence: 0.5, // mock confidence is deliberately mediocre
            startChar: 0,
            endChar: text.length,
            wordCount,
          },
        ]
      : [];

  return {
    prediction,
    predictionShort,
    fractionAi,
    fractionHuman,
    fractionAiAssisted,
    windows,
    wordCount,
    isMocked: true,
  };
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
