"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser client using the public publishable/anon key — safe to ship in
 * the web bundle (it's meant to be public; RLS is what actually protects
 * data). Uses @supabase/ssr's cookie-based session storage (not
 * localStorage) so the session is visible server-side too — to
 * middleware.ts (session refresh + /dashboard gate) and
 * lib/supabase/server.ts (Server Components' RLS-scoped reads).
 *
 * Used by /login for Supabase Auth. Not used by apps/extension — the
 * extension only ever calls apps/web's own API routes (see
 * docs/architecture.md); it gets its session via /login's postMessage
 * handoff (the returned session object, independent of how this client
 * persists it), not by talking to Supabase directly.
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

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
