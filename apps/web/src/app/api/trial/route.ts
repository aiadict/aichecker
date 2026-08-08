import { NextRequest, NextResponse } from "next/server";
import type { TrialStatusResponse } from "@ai-checker/shared-types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAnonymousTrialEnabled } from "@/lib/anonymous-trial";

// Lets the panel show trial credits remaining before any check has run
// (Header fetches this on mount), not just after one — /api/checks' own
// response covers the "just spent one" refresh.
export async function GET(req: NextRequest) {
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId) {
    return NextResponse.json<TrialStatusResponse>({ trialCreditsRemaining: 0 });
  }

  const admin = getSupabaseAdmin();

  if (!(await isAnonymousTrialEnabled(admin))) {
    return NextResponse.json<TrialStatusResponse>({ trialCreditsRemaining: 0 });
  }

  const { data } = await admin
    .from("anonymous_trials")
    .select("credits_remaining")
    .eq("device_id", deviceId)
    .maybeSingle();

  // No row yet just means this device hasn't run a check before — the full
  // 2 credits are still available (the row is only created on first spend).
  const trialCreditsRemaining = (data?.credits_remaining as number | undefined) ?? 2;
  return NextResponse.json<TrialStatusResponse>({ trialCreditsRemaining });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
