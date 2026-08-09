import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles Supabase email confirmation links (signup, magic link, password
 * recovery, email change) server-side, instead of relying on the browser
 * client's default detectSessionInUrl auto-exchange.
 *
 * That default flow is client-side only: the confirmation link lands on a
 * page that gets server-rendered FIRST using whatever session cookie the
 * request already carried, and only AFTER hydration does JS detect the
 * code/token in the URL and set the new session cookie — too late for that
 * initial render. Confirmed live: signed in as one account, signed up a
 * second account from the same browser, clicked its confirmation email —
 * landed back on the *first* account's dashboard (that's what the stale
 * cookie rendered), and only an explicit sign-out + sign-in picked up the
 * new session. Exchanging here instead means the redirect below is a real
 * HTTP redirect carrying a fresh Set-Cookie, so the next page's first
 * render is already correct — no client-side race, no stale flash.
 *
 * Supabase's default confirmation email template points at
 * `{{ .SiteURL }}/auth/confirm?token_hash=...&type=...` — this route is
 * that exact contract, so it works without any email-template changes.
 * `code` is also handled for OAuth/PKCE-style links that use it instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createSupabaseServerClient();

  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("missing token_hash/type or code") };

  if (!error) {
    return NextResponse.redirect(new URL(next, origin));
  }

  console.error("Auth confirmation failed", error);
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "confirmation_failed");
  return NextResponse.redirect(loginUrl);
}
