import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-scoped Supabase client for Server Components and Route Handlers.
 * Unlike lib/supabase/admin.ts, this respects RLS as whichever user (or
 * anon) the request's cookies represent — used by the /dashboard pages
 * (own-rows-only via RLS) and the public /history/[slug] share page (anon
 * role, so RLS's "is_public = true" policy is what gates visibility, not
 * application code — see supabase/migrations/20260729000002_rls_policies.sql).
 *
 * Next.js Server Components can't set cookies (only read them) — call sites
 * there just won't see a token refresh persisted; middleware.ts is what
 * actually refreshes and re-persists the session cookie on navigation.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — see .env.example."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (can't set cookies there) —
          // safe to ignore as long as middleware.ts is refreshing sessions.
        }
      },
    },
  });
}
