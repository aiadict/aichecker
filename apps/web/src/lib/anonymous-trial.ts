import type { SupabaseClient } from "@supabase/supabase-js";

// ~$10/day worst case at Pangram's $0.05/1,000-word retail rate — bounds
// aggregate exposure from the anonymous trial regardless of how many
// distinct device IDs a script mints, which per-device/per-IP limits alone
// can't do (see docs/architecture.md's anonymous trial section for the
// full threat model this was designed against).
const DAILY_ANON_CREDIT_CAP = 200;

/**
 * Reads the app_config kill switch — lets the anonymous trial be turned off
 * (once the Chrome Web Store listing has enough traction/reviews that it's
 * no longer needed for conversion) with a single row update, no redeploy
 * and no new extension release: both api/checks and api/trial check this on
 * every request, so it takes effect for every already-installed copy of the
 * extension on its very next request.
 */
export async function isAnonymousTrialEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "anonymous_trial_enabled")
    .maybeSingle();

  // Fail open only when the row is genuinely missing (shouldn't happen —
  // the migration seeds it) so a transient query error doesn't silently
  // kill the trial; an explicit `false` always wins.
  return data ? data.value === true : true;
}

/**
 * Sums today's anonymous (check_id is null) Pangram spend from
 * api_usage_log — the one mitigation that isn't defeated by rotating IPs or
 * minting fresh device IDs, since it bounds total spend directly rather
 * than trying to police identity.
 */
export async function anonymousDailySpendCapReached(admin: SupabaseClient): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data } = await admin
    .from("api_usage_log")
    .select("pangram_credits_billed")
    .is("check_id", null)
    .gte("created_at", startOfDay.toISOString());

  const usedToday = (data ?? []).reduce((sum, row) => sum + Number(row.pangram_credits_billed), 0);
  return usedToday >= DAILY_ANON_CREDIT_CAP;
}
