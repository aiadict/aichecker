// Shared types used by both apps/web and apps/extension.
// Keep this the single source of truth for the shapes crossing that boundary.

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
  textSnippet: string;
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
