/**
 * SERVER-ONLY. Import this package exclusively from apps/web's API routes
 * — never from apps/extension. Same rule as @ai-checker/pangram-client:
 * the API key must never exist anywhere a browser extension bundle can be
 * inspected.
 *
 * Talks to TruthScan's WebSocket sentence-level detection feature
 * (https://truthscan.com/truthscan-ai-text-detection-api-documentation),
 * not its plain REST `/detect` endpoint. That distinction matters and was
 * verified live, not assumed: `/detect` on its own returns a single
 * document-level score with no positional/per-sentence data at all (no
 * character offsets, confirmed both in the docs and empirically), and its
 * three-way label set (Human/AI/Paraphrase) has no "Mixed" category — a
 * genuinely 50/50 mixed document just gets called "AI" outright once the
 * score crosses their threshold. The WebSocket channel streams one
 * `document_chunk` event per SENTENCE with a continuous 0-1 score, which
 * is what this client actually uses to build both the per-window
 * highlighting AND our own word-count-weighted document-level fractions
 * (fractionAi/fractionAiAssisted/fractionHuman) — deliberately not
 * TruthScan's own cruder aggregate.
 *
 * Why this replaced Pangram as the primary provider (see
 * docs/architecture.md for the full comparison): live-tested against
 * Pangram 3.3.2 on identical controlled mixed-authorship text (genuine AI
 * paragraphs + real, verbatim public-domain human text at known
 * boundaries) — Pangram 3 returned a single window covering the entire
 * document, confidently (High confidence) mislabeling a real Jane Austen
 * excerpt as "100% AI-Generated". TruthScan's sentence-level channel
 * correctly localized the exact same boundary, with per-sentence
 * confidence, at roughly HALF Pangram 3's per-word price (TruthScan
 * Professional: $0.02/1,000 words vs Pangram 3's $0.05) and a small
 * fraction of Pangram 4's ($0.50/1,000 words) — without needing Pangram
 * 4's 10x pricing tier at all. Verified live that a Node.js Vercel
 * function can hold this WebSocket connection open long enough to
 * receive all chunks: ~1.3-1.5s total round trip for realistic document
 * lengths, well within any reasonable function timeout.
 *
 * Provisional, not vendor-guaranteed: the per-sentence AI/Mixed/Human
 * label thresholds below (SCORE_AI_THRESHOLD / SCORE_HUMAN_THRESHOLD) are
 * this integration's own choice, tuned against a small hand-built test
 * set — not something TruthScan's API itself returns. Revisit once real
 * production traffic gives a larger sample to calibrate against.
 */

import { countWords, type CheckWindow, type Prediction } from "@ai-checker/shared-types";

export interface TruthScanPredictResult {
  prediction: string;
  predictionShort: Prediction;
  fractionAi: number;
  fractionHuman: number;
  fractionAiAssisted: number;
  windows: CheckWindow[];
  wordCount: number;
  isMocked: boolean;
  /** TruthScan's own model identifier (e.g. "xlm_ud_detector") — our audit trail, mirroring pangram-client's modelVersion. */
  modelVersion?: string;
}

export interface TruthScanClientOptions {
  apiKey?: string;
  orgId?: string;
  /**
   * $/1,000 words for whichever paid tier is actually contracted —
   * TruthScan's per-word rate varies by plan (Starter $0.03, Professional
   * $0.02, Business $0.01), unlike Pangram's single published realtime
   * rate. Defaults to the Professional rate as a working assumption; MUST
   * be corrected to match the real contracted plan before trusting any
   * cost/margin figures derived from this value.
   */
  costPerThousandWords?: number;
}

const WS_BASE_URL = "wss://detect-text.truthscan.com/ws";
const REST_BASE_URL = "https://detect-text.truthscan.com";
const CONNECTION_TIMEOUT_MS = 45_000;

// Provisional thresholds on TruthScan's continuous 0-1 per-sentence score
// (0 = confidently human, 1 = confidently AI) — see class doc comment.
const SCORE_AI_THRESHOLD = 0.7;
const SCORE_HUMAN_THRESHOLD = 0.3;

export class TruthScanApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TruthScanApiError";
  }
}

export class TruthScanClient {
  private readonly apiKey: string | undefined;
  private readonly orgId: string | undefined;
  private readonly costPerThousand: number;

  constructor(options: TruthScanClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.TRUTHSCAN_API_KEY;
    this.orgId = options.orgId ?? process.env.TRUTHSCAN_ORG_ID;
    this.costPerThousand = options.costPerThousandWords ?? 0.02;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.orgId);
  }

  /** $/1,000-word rate for the contracted plan. Used by scripts/estimate-margin.ts. */
  get costPerCredit(): number {
    return this.costPerThousand;
  }

  creditsForWordCount(wordCount: number): number {
    if (wordCount <= 0) return 0;
    return Math.max(1, Math.ceil(wordCount / 1000));
  }

  async predict(text: string): Promise<TruthScanPredictResult> {
    const wordCount = countWords(text);

    if (!this.isConfigured) {
      return mockPredict(text, wordCount);
    }

    const chunks = await this.runDetection(text);
    return mapChunksToResult(text, chunks, wordCount);
  }

  private runDetection(text: string): Promise<TruthScanChunk[]> {
    return new Promise((resolve, reject) => {
      const chunks: TruthScanChunk[] = [];
      const ws = new WebSocket(`${WS_BASE_URL}/${this.orgId}`);

      const timeout = setTimeout(() => {
        try {
          ws.close();
        } catch {
          // already closed/closing — nothing more to do
        }
        reject(new TruthScanApiError(`TruthScan WebSocket timed out after ${CONNECTION_TIMEOUT_MS}ms`));
      }, CONNECTION_TIMEOUT_MS);

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ event_type: "document_watch", api_key: this.apiKey }));
      });

      ws.addEventListener("message", (event) => {
        (async () => {
          const msg = JSON.parse(event.data as string) as TruthScanWsMessage;

          if (msg.event_type === "document_id") {
            const res = await fetch(`${REST_BASE_URL}/detect`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, key: this.apiKey, id: msg.document_id }),
            });
            if (!res.ok) {
              clearTimeout(timeout);
              ws.close();
              reject(new TruthScanApiError(`TruthScan /detect submit failed (${res.status})`));
            }
            return;
          }

          if (msg.event_type === "document_chunk") {
            chunks.push({ text: msg.chunk, score: msg.result });
            return;
          }

          if (msg.event_type === "document_done") {
            clearTimeout(timeout);
            ws.close();
            resolve(chunks);
          }
        })().catch((err) => {
          clearTimeout(timeout);
          reject(err instanceof Error ? err : new TruthScanApiError(String(err)));
        });
      });

      ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new TruthScanApiError("TruthScan WebSocket connection error"));
      });
    });
  }
}

// --- Wire types -------------------------------------------------------------

interface TruthScanChunk {
  text: string;
  score: number;
}

type TruthScanWsMessage =
  | { event_type: "document_id"; success: boolean; document_id: string }
  | { event_type: "document_chunk"; document_id: string; model: string; chunk: string; result: number }
  | { event_type: "document_done"; document_id: string; model: string };

// --- Mapping chunks to our internal shape -----------------------------------

function labelForScore(score: number): Prediction {
  if (score >= SCORE_AI_THRESHOLD) return "ai";
  if (score <= SCORE_HUMAN_THRESHOLD) return "human";
  return "mixed";
}

function mapChunksToResult(fullText: string, chunks: TruthScanChunk[], wordCount: number): TruthScanPredictResult {
  const windows: CheckWindow[] = [];
  let cursor = 0;

  for (const c of chunks) {
    // Chunks stream back in document order, so searching forward from the
    // previous match's end (not from 0 each time) correctly disambiguates
    // repeated/duplicate sentences instead of always matching the first
    // occurrence.
    const idx = fullText.indexOf(c.text, cursor);
    const startChar = idx >= 0 ? idx : cursor;
    const endChar = startChar + c.text.length;
    cursor = endChar;

    windows.push({
      label: labelForScore(c.score),
      aiAssistanceScore: c.score,
      // Distance from the 0.5 midpoint, rescaled to 0-1 — a score near 0
      // or 1 (confidently one way or the other) reads as high confidence;
      // a score near 0.5 (genuinely ambiguous, as the Gettysburg Address's
      // opening sentence consistently scored across every test) reads as
      // low. TruthScan doesn't supply a separate confidence field per
      // sentence the way Pangram does, so this is derived, not native.
      confidence: Math.abs(c.score - 0.5) * 2,
      startChar,
      endChar,
      wordCount: countWords(c.text),
    });
  }

  const totalWords = windows.reduce((sum, w) => sum + w.wordCount, 0) || 1;
  const wordsWithLabel = (label: Prediction) =>
    windows.filter((w) => w.label === label).reduce((sum, w) => sum + w.wordCount, 0);

  const fractionAi = wordsWithLabel("ai") / totalWords;
  const fractionAiAssisted = wordsWithLabel("mixed") / totalWords;
  const fractionHuman = wordsWithLabel("human") / totalWords;

  const predictionShort: Prediction =
    fractionHuman >= fractionAi && fractionHuman >= fractionAiAssisted
      ? "human"
      : fractionAi >= fractionAiAssisted
        ? "ai"
        : "mixed";

  const prediction =
    predictionShort === "human"
      ? "We believe that this text is fully human-written."
      : predictionShort === "ai"
        ? "We believe that this text is fully AI-generated."
        : "We believe that this text is a mix of AI and human-written content.";

  return {
    prediction,
    predictionShort,
    fractionAi,
    fractionHuman,
    fractionAiAssisted,
    windows,
    wordCount,
    isMocked: false,
    modelVersion: "xlm_ud_detector",
  };
}

/**
 * Deterministic mock, mirroring pangram-client's mockPredict exactly —
 * active whenever TRUTHSCAN_API_KEY/TRUTHSCAN_ORG_ID are unset (local dev,
 * CI), so the rest of the product stays testable without hitting the real,
 * billed API.
 */
function mockPredict(text: string, wordCount: number): TruthScanPredictResult {
  const hash = simpleHash(text);
  const score = wordCount === 0 ? 0 : (hash % 100) / 100;
  const predictionShort = labelForScore(score);

  const windows: CheckWindow[] =
    wordCount > 0
      ? [
          {
            label: predictionShort,
            aiAssistanceScore: score,
            confidence: Math.abs(score - 0.5) * 2,
            startChar: 0,
            endChar: text.length,
            wordCount,
          },
        ]
      : [];

  return {
    prediction:
      predictionShort === "human"
        ? "We believe that this text is fully human-written."
        : predictionShort === "ai"
          ? "We believe that this text is fully AI-generated."
          : "We believe that this text is a mix of AI and human-written content.",
    predictionShort,
    fractionAi: predictionShort === "ai" ? 1 : 0,
    fractionHuman: predictionShort === "human" ? 1 : 0,
    fractionAiAssisted: predictionShort === "mixed" ? 1 : 0,
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
