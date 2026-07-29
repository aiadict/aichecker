import { NextRequest, NextResponse } from "next/server";
import { PangramApiError, PangramClient } from "@ai-checker/pangram-client";
import type { CreateCheckRequest, CreateCheckResponse } from "@ai-checker/shared-types";
import { randomUUID } from "node:crypto";
import {
  addCheck,
  deductMockCredits,
  getMockCreditsRemaining,
  listChecks,
  MOCK_FREE_PLAN,
} from "@/lib/mock-store";

// TODO: once Supabase exists, replace the mock-store calls here with:
//   1. Verify the Authorization bearer token against Supabase Auth.
//   2. Look up the user's `plans` + `credit_balances` row.
//   3. Enforce daily_cap / credits_remaining from THAT row, not the mock.
//   4. Insert into `checks` + `check_windows`, decrement `credit_balances`,
//      and insert into `api_usage_log` for cost tracking (service-role only).
// See docs/architecture.md for the full data flow this stubs out.

const pangram = new PangramClient();

const MIN_CHARS = 20;
const MAX_CHARS = 50_000;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateCheckRequest;
  const text = body.text?.trim() ?? "";

  if (text.length < MIN_CHARS) {
    return NextResponse.json<CreateCheckResponse>({ ok: false, error: "text_too_short" });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json<CreateCheckResponse>({ ok: false, error: "text_too_long" });
  }

  const remaining = getMockCreditsRemaining();
  if (remaining <= 0) {
    return NextResponse.json<CreateCheckResponse>({
      ok: false,
      error: "insufficient_credits",
      creditsRemaining: remaining,
    });
  }

  let prediction;
  try {
    prediction = await pangram.predict(text);
  } catch (err) {
    // Distinguish "our Pangram account itself is out of prepaid credits"
    // (402 — top up at pangram.com, nothing to do with THIS user's plan)
    // from any other upstream failure, so ops can tell them apart in logs.
    if (err instanceof PangramApiError && err.status === 402) {
      console.error("Pangram account is out of prepaid API credits — top up at pangram.com.", err.body);
      return NextResponse.json<CreateCheckResponse>({
        ok: false,
        error: "upstream_error",
        message: "AI Checker is temporarily unable to process checks. Please try again shortly.",
      });
    }
    console.error("Pangram request failed", err);
    return NextResponse.json<CreateCheckResponse>({
      ok: false,
      error: "upstream_error",
      message: "Something went wrong while checking this text. Please try again.",
    });
  }

  const creditsUsed = pangram.creditsForWordCount(prediction.wordCount);
  deductMockCredits(creditsUsed);

  const result = addCheck({
    textSnippet: text.slice(0, 200),
    wordCount: prediction.wordCount,
    creditsUsed,
    prediction: prediction.prediction,
    predictionShort: prediction.predictionShort,
    fractionAi: prediction.fractionAi,
    fractionHuman: prediction.fractionHuman,
    fractionAiAssisted: prediction.fractionAiAssisted,
    sourceUrl: body.sourceUrl ?? null,
    isPublic: false,
    shareSlug: randomUUID(),
    windows: prediction.windows,
  });

  return NextResponse.json<CreateCheckResponse>({
    ok: true,
    result,
    creditsRemaining: getMockCreditsRemaining(),
  });
}

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? MOCK_FREE_PLAN.dailyCap ?? 5);
  return NextResponse.json({ results: listChecks(limit) });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
