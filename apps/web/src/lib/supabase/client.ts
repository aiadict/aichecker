"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-only client using the public publishable/anon key — safe to ship
 * in the web bundle (it's meant to be public; RLS is what actually protects
 * data). Used by /login for Supabase Auth. Not used by apps/extension —
 * the extension only ever calls apps/web's own API routes (see
 * docs/architecture.md), it doesn't talk to Supabase directly.
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — see .env.example."
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
