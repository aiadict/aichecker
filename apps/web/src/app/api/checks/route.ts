import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PangramApiError, PangramClient } from "@ai-checker/pangram-client";
import {
  countWords,
  type CheckResult,
  type CreateCheckRequest,
  type CreateCheckResponse,
} from "@ai-checker/shared-types";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { insertCheck, listChecksForUser } from "@/lib/checks-repo";
import { anonymousDailySpendCapReached, isAnonymousTrialEnabled } from "@/lib/anonymous-trial";

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

interface ConsumeTrialCreditResult {
  allowed: boolean;
  credits_remaining: number;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  const deviceId = req.headers.get("x-device-id");

  // No session AND no device ID — an old extension build predating the
  // anonymous trial, or any non-extension caller. Same 401 as always, no
  // behavior change for them.
  if (!user && !deviceId) {
    return NextResponse.json<CreateCheckResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const isAnonymous = !user;

  // Checked before even parsing the body — an off switch or an exhausted
  // trial should fail as cheaply as possible.
  if (isAnonymous && !(await isAnonymousTrialEnabled(admin))) {
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

  if (isAnonymous) {
    // Pre-flight, before spending a real Pangram call: an already-exhausted
    // device, or the global daily cap, both fail the same way a signed-out
    // user does — sign in is the only way forward either way, since an
    // anonymous trial has no "upgrade," only "sign in."
    const { data: trialRow } = await admin
      .from("anonymous_trials")
      .select("credits_remaining")
      .eq("device_id", deviceId!)
      .maybeSingle();
    const trialRemaining = (trialRow?.credits_remaining as number | undefined) ?? 2;

    if (trialRemaining <= 0 || (await anonymousDailySpendCapReached(admin))) {
      return NextResponse.json<CreateCheckResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
    }
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

  // Our own cost tracking against Pangram — independent of what we charge
  // the user, never exposed to any client (service-role only, no RLS
  // policy). Shared by both the authenticated and anonymous branches below.
  console.log(`Pangram model version served this check: ${prediction.modelVersion ?? "(none returned)"}`);

  if (isAnonymous) {
    // Atomic decrement, same locking pattern as consume_credit but with no
    // monthly/daily reset — trial credits never replenish. Any failure here
    // (a concurrent request beat this one to the last credit) collapses to
    // the same "sign in" response as running out in the first place.
    const { data: consumeResult, error: consumeError } = await admin
      .rpc("consume_trial_credit", { p_device_id: deviceId, p_credits_needed: creditsUsed })
      .single<ConsumeTrialCreditResult>();

    if (consumeError || !consumeResult?.allowed) {
      return NextResponse.json<CreateCheckResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Not persisted to checks/check_windows — anonymous checks aren't tied
    // to an account, and checks.user_id is not null, so there's nowhere to
    // put them. api_usage_log still gets a row (check_id: null, already
    // nullable) so the anonymous flow doesn't create a blind spot in cost
    // monitoring.
    const result: CheckResult = {
      id: randomUUID(),
      fullText: text,
      wordCount: prediction.wordCount,
      creditsUsed,
      prediction: prediction.prediction,
      predictionShort: prediction.predictionShort,
      fractionAi: prediction.fractionAi,
      fractionHuman: prediction.fractionHuman,
      fractionAiAssisted: prediction.fractionAiAssisted,
      sourceUrl: body.sourceUrl ?? null,
      isPublic: false,
      shareSlug: null,
      windows: prediction.windows,
      createdAt: new Date().toISOString(),
    };

    await admin.from("api_usage_log").insert({
      check_id: null,
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

  // --- authenticated flow, unchanged ---

  // Atomic: locks the user's credit_balances row, resets daily/monthly
  // counters if expired, checks daily_cap + credits_remaining, and
  // decrements — all in one transaction (see supabase/migrations'
  // consume_credit function) so concurrent requests can't double-spend.
  const { data: consumeResult, error: consumeError } = await admin
    .rpc("consume_credit", { p_user_id: user!.id, p_credits_needed: creditsUsed })
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
    userId: user!.id,
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
