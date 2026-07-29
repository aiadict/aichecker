// Central place for the extension's runtime config. The extension talks
// ONLY to our own backend (apps/web) — never directly to Pangram. See
// docs/architecture.md for why.
export const API_BASE_URL: string =
  (import.meta.env.VITE_APP_API_URL as string | undefined) ?? "http://localhost:3000";
