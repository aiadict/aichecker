import { NextRequest, NextResponse } from "next/server";
import { PangramApiError, PangramClient } from "@ai-checker/pangram-client";
import { countWords, type CreateCheckRequest, type CreateCheckResponse } from "@ai-checker/shared-types";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { insertCheck, listChecksForUser } from "@/lib/checks-repo";

const pangram = new PangramClient();

// Word-based, not character-based — short of ~50 words, Pangram's own
// results get noticeably less reliable (seen live earlier: even a 256-word
// sample came back "Low confidence"). MAX_CHARS stays character-based —
// that's a payload-size guard, a different concern from detection validity.
const MIN_WORDS = 50;
const MAX_CHARS = 50_000;

interface ConsumeCreditResult {
  allowed: boolean;
  reason: string | null;
  credits_remaining: number;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    // Real 401 (not just ok:false in a 200) so the extension's fetch layer
    // can key off status code alone to trigger a token-refresh-and-retry —
    // see apps/extension/src/lib/api.ts.
    return NextResponse.json<CreateCheckResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateCheckRequest;
  const text = body.text?.trim() ?? "";

  if (countWords(text) < MIN_WORDS) {
    return NextResponse.json<CreateCheckResponse>({ ok: false, error: "text_too_short" });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json<CreateCheckResponse>({ ok: false, error: "text_too_long" });
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
    } else {
      console.error("Pangram request failed", err);
    }
    return NextResponse.json<CreateCheckResponse>({
      ok: false,
      error: "upstream_error",
      message: "Something went wrong while checking this text. Please try again.",
    });
  }

  const creditsUsed = pangram.creditsForWordCount(prediction.wordCount);
  const admin = getSupabaseAdmin();

  // Atomic: locks the user's credit_balances row, resets daily/monthly
  // counters if expired, checks daily_cap + credits_remaining, and
  // decrements — all in one transaction (see supabase/migrations'
  // consume_credit function) so concurrent requests can't double-spend.
  const { data: consumeResult, error: consumeError } = await admin
    .rpc("consume_credit", { p_user_id: user.id, p_credits_needed: creditsUsed })
    .single<ConsumeCreditResult>();

  if (consumeError || !consumeResult) {
    console.error("consume_credit RPC failed", consumeError);
    return NextResponse.json<CreateCheckResponse>({
      ok: false,
      error: "upstream_error",
      message: "Could not verify your credit balance. Please try again.",
    });
  }

  if (!consumeResult.allowed) {
    if (consumeResult.reason === "daily_cap_reached") {
      return NextResponse.json<CreateCheckResponse>({ ok: false, error: "daily_cap_reached" });
    }
    // Covers both "insufficient_credits" and the defensive "no_credit_balance"
    // edge case (shouldn't happen — the signup trigger always creates one).
    return NextResponse.json<CreateCheckResponse>({
      ok: false,
      error: "insufficient_credits",
      creditsRemaining: consumeResult.credits_remaining,
    });
  }

  const result = await insertCheck({
    userId: user.id,
    fullText: text,
    wordCount: prediction.wordCount,
    creditsUsed,
    prediction: prediction.prediction,
    predictionShort: prediction.predictionShort,
    fractionAi: prediction.fractionAi,
    fractionHuman: prediction.fractionHuman,
    fractionAiAssisted: prediction.fractionAiAssisted,
    sourceUrl: body.sourceUrl ?? null,
    windows: prediction.windows,
  });

  // Our own cost tracking against Pangram — independent of what we charge
  // the user, never exposed to any client (service-role only, no RLS policy).
  // pangram_model_version is an audit trail against Pangram's own
  // undocumented (as of this writing) split between "Pangram 3"
  // ($0.05/1,000 words) and "Pangram 4" ($0.05/100 words, 10x costlier) —
  // see docs/product-spec.md §4. Logged loudly here on purpose: a version
  // string we don't expect is the first sign the cost model is wrong.
  console.log(`Pangram model version served this check: ${prediction.modelVersion ?? "(none returned)"}`);
  await admin.from("api_usage_log").insert({
    check_id: result.id,
    pangram_credits_billed: creditsUsed,
    cost_usd_estimate: creditsUsed * pangram.costPerCredit,
    pangram_model_version: prediction.modelVersion ?? null,
  });

  return NextResponse.json<CreateCheckResponse>({
    ok: true,
    result,
    creditsRemaining: consumeResult.credits_remaining,
  });
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 5);
  const results = await listChecksForUser(user.id, limit);
  return NextResponse.json({ results });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
