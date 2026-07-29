/**
 * SERVER-ONLY. Import this package exclusively from apps/web's API routes
 * (or any future server context) — never from apps/extension. The Pangram
 * API key must not exist anywhere a browser extension bundle can be
 * inspected (chrome://extensions -> Inspect exposes all extension code).
 *
 * TODO(pangram-key): PANGRAM_API_KEY is not yet provided (see .env.example
 * and README.md). Until it is set, `predict()` returns a deterministic MOCK
 * response so the rest of the product can be built and tested end to end.
 * Do not remove the mock fallback silently — swap it out deliberately once
 * the real key exists and has been verified against a couple of known
 * human/AI text samples.
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
}

export interface PangramClientOptions {
  apiKey?: string;
  /** "realtime" ($0.05/1k words) or "bulk" ($0.04/1k words) — see docs/product-spec.md §3 */
  mode?: "realtime" | "bulk";
}

const WORDS_PER_CREDIT = 1000;

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

    // TODO(pangram-key): replace with the real Pangram SDK/HTTP call once a
    // key is available, e.g.:
    //
    //   const client = new Pangram({ apiKey: this.apiKey });
    //   const result = await client.predict(text, { publicDashboardLink: false });
    //   return mapPangramResponse(result, wordCount);
    //
    // Response shape observed from Pangram's own docs: prediction,
    // prediction_short, fraction_ai, fraction_human, fraction_ai_assisted,
    // windows[] (label, ai_assistance_score, confidence, char ranges,
    // word_count), stage, version, headline, dashboard_link.
    throw new Error(
      "PANGRAM_API_KEY is set but the real Pangram API call is not yet implemented. " +
        "Wire up the Pangram SDK/HTTP call here (see the TODO above) once ready to go live."
    );
  }

  creditsForWordCount(wordCount: number): number {
    return Math.max(1, Math.ceil(wordCount / WORDS_PER_CREDIT));
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Deterministic mock: classifies based on a simple heuristic so the UI has
 * something believable to render in dev/CI without ever calling out to
 * Pangram. Not for production use.
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
