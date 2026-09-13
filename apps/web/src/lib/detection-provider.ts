import type { SupabaseClient } from "@supabase/supabase-js";

export type DetectionProvider = "pangram" | "truthscan";

/**
 * Reads the app_config switch deciding which AI-detection vendor actually
 * serves /api/checks — same flip-without-a-redeploy pattern as
 * isAnonymousTrialEnabled (see anonymous-trial.ts). Lets a real production
 * problem with either vendor be reverted with a single row update instead
 * of a deploy, which is the whole point of keeping both
 * @ai-checker/pangram-client and @ai-checker/truthscan-client fully wired
 * up rather than removing the one not currently active.
 */
export async function getDetectionProvider(admin: SupabaseClient): Promise<DetectionProvider> {
  const { data } = await admin.from("app_config").select("value").eq("key", "detection_provider").maybeSingle();

  // Fail safe to "pangram" (the longer-proven vendor) on a missing/malformed
  // row rather than trusting an unexpected value — an explicit, valid
  // "truthscan" is the only thing that switches away from the default.
  return data?.value === "truthscan" ? "truthscan" : "pangram";
}
