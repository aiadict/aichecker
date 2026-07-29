import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY. Uses the service_role/secret key, which bypasses Row Level
 * Security entirely. Never import this from a client component or anything
 * that ships to the browser/extension bundle — same rule as
 * packages/pangram-client's API key. All access control for calls that use
 * this client must be enforced explicitly in application code (see
 * src/lib/auth.ts's getAuthenticatedUser, and the RPC functions in
 * supabase/migrations which double-check ownership/limits server-side).
 */
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — see .env.example."
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
