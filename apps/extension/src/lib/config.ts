// Central place for the extension's runtime config. The extension talks
// ONLY to our own backend (apps/web) — never directly to Pangram. See
// docs/architecture.md for why.
export const API_BASE_URL: string =
  (import.meta.env.VITE_APP_API_URL as string | undefined) ?? "http://localhost:3000";

// Supabase URL + anon/publishable key are safe to bundle here (same values
// already public in apps/web's client bundle — RLS is what protects data,
// not secrecy of these). Used only to call Supabase's token-refresh
// endpoint directly (lib/api.ts) — the extension still never talks to
// Supabase for anything else, and never touches the service_role secret.
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "https://najbzowkupdhlartoyjk.supabase.co";
export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "sb_publishable_WiOtk1G-MjjvYAxhugzwew_wvROODhO";

// Used by RateUsTab's 4-5 star click — there's no documented, Google-
// supported way to pre-fill a star count on this page, so it just links
// straight to the listing; the user clicks "Rate and review" themselves.
export const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/ai-checker/onmgheoplmjcaamolnfecbpanekfjlnl";
