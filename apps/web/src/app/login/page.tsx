"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up" | "forgot-password";
type ErrorVariant = "generic" | "duplicate_email" | "confirmation_failed";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * Only ever a same-site relative path (e.g. "/dashboard/history" — set by
 * middleware.ts when it bounces an unauthenticated /dashboard/* request
 * here). Rejects anything else so this can't be turned into an open
 * redirect via a crafted ?redirectTo= value (a protocol-relative "//evil.com"
 * or an absolute "https://evil.com" would both fail the leading-single-
 * slash check below).
 */
function safeRedirectTarget(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExtensionSource = searchParams.get("source") === "extension";
  const redirectTo = safeRedirectTarget(searchParams.get("redirectTo"));

  // Always starts on Sign-in. An earlier version guessed sign-in vs.
  // sign-up per device (via the extension's hasEverSignedIn flag), but
  // that guess depended on a session handoff that turned out to be
  // unreliable — confirmed live that Supabase's confirmation email never
  // actually carries our custom redirect through, so a device that HAD
  // signed up still got sent back to Sign-up. Dropped in favor of the
  // auth-mode-toggle buttons below being equally prominent either way —
  // a true first-timer is one obvious click from Sign-up, no guessing
  // required, and it can't ever be wrong.
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<ErrorVariant>("generic");
  // Which flow failed — decides what "Request a new link" should do
  // below (send them to Forgot-password vs. Sign-up). Tracked
  // separately from `mode` since the effect below may itself change
  // `mode`, and inferring context back out of `mode` later would break
  // the moment the user switches modes manually.
  const [confirmationFailedContext, setConfirmationFailedContext] = useState<"recovery" | "other" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // /auth/confirm redirects here on a failed token/code exchange —
    // most commonly a password-reset or signup-confirmation link opened
    // in a different browser than the one that requested it (PKCE flow
    // ties the exchange to the originating browser by design, as an
    // anti-hijacking property — confirmed live by tracing exactly what
    // Supabase's own redirect carries for a recovery link). This was
    // previously silently ignored: the query param existed but nothing
    // ever read it, leaving the user on a bare sign-in form with zero
    // explanation for why they'd landed there.
    if (searchParams.get("error") !== "confirmation_failed") return;
    const failedNext = searchParams.get("next") ?? "";
    const isRecovery = failedNext.includes("reset-password");
    setErrorVariant("confirmation_failed");
    setConfirmationFailedContext(isRecovery ? "recovery" : "other");
    setError(
      isRecovery
        ? "This password reset link couldn't be verified — for security, reset links only work in the same browser you requested them from. Request a new one below."
        : "This link couldn't be verified — it may have expired, already been used, or been opened in a different browser than the one that requested it."
    );
    if (isRecovery) setMode("forgot-password");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorVariant("generic");
    setStatus(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { data, error: authError } =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              // Points Supabase's confirmation email at our own server-side
              // exchange route (see src/app/auth/confirm/route.ts) instead
              // of its default client-side-only auto-detect. For the
              // extension flow, lands on /extension-connected rather than
              // back on this form — /auth/confirm is a pure server redirect
              // with no client JS, so it can never run handleSubmit's
              // postMessage handoff below; /extension-connected exists
              // specifically to do that handoff after the fact instead of
              // silently leaving the extension signed out while the web
              // session is already live.
              emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
                isExtensionSource ? "/extension-connected?source=extension" : redirectTo
              )}`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "sign-up" && !data.session) {
      // Supabase's signUp() deliberately returns success (no error) for an
      // email that already has a CONFIRMED account too — same response
      // shape as a genuine new signup, specifically to avoid leaking which
      // emails are registered via an explicit error. The documented way to
      // tell the two apart on our side: a real new signup's user object has
      // a non-empty identities array; an already-registered email's comes
      // back empty. Confirmed live: without this check, re-signing-up with
      // an existing email silently showed "check your email" with no email
      // ever actually sent.
      if (data.user?.identities?.length === 0) {
        setErrorVariant("duplicate_email");
        setError("An account with this email already exists.");
        return;
      }
      // Extension-sourced signups get an explicit instruction to return to
      // the extension specifically, not just "sign in" — confirming the
      // email signs the user in here on werida.io only (see
      // extension-connected/page.tsx's doc comment for why that can't be
      // made fully automatic), and "come back and sign in" alone left
      // users unsure where "back" even meant.
      setStatus(
        isExtensionSource
          ? "Check your email to confirm your account. Once confirmed, open the AI Checker extension and click Sign in there to finish."
          : "Check your email to confirm your account, then come back and sign in."
      );
      return;
    }

    if (!data.session) {
      setError("Something went wrong — no session was created. Please try again.");
      return;
    }

    if (isExtensionSource) {
      // Hand the session off to the AI Checker extension. The extension's
      // content script (running on this same page, since it's injected on
      // <all_urls>) listens for exactly this message — see
      // apps/extension/src/content/index.ts. postMessage (not a cookie or
      // localStorage read) is used because the extension's isolated-world
      // content script can't read this page's localStorage directly, but it
      // shares the DOM/window and so can receive same-window messages.
      window.postMessage(
        {
          type: "ai-checker/auth-success",
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
        window.location.origin
      );
      setStatus("Signed in! You can close this tab and return to the extension.");
      return;
    }

    router.push(redirectTo);
  }

  /**
   * Deliberately shows the same "check your email" status whether or not
   * the address has an account — Supabase's resetPasswordForEmail already
   * behaves this way (always resolves, never errors on an unknown email),
   * so surfacing anything more specific here would just be us re-adding
   * the account-enumeration leak Supabase's own API avoids.
   */
  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorVariant("generic");
    setStatus(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    // Lands on /reset-password (see src/app/reset-password/page.tsx) after
    // /auth/confirm exchanges the recovery token — same route/mechanism as
    // sign-up confirmation, just a different `next`.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setStatus("If an account exists for that email, a password reset link is on its way.");
  }

  const heading =
    mode === "sign-up" ? "Create your account" : mode === "forgot-password" ? "Reset your password" : "Sign in";

  return (
    <div className="container auth-page">
      <div className="auth-card-wrap">
        <h1 style={{ textAlign: "center" }}>{heading}</h1>
        <p className="muted" style={{ textAlign: "center" }}>
          {mode === "forgot-password"
            ? "Enter your email and we'll send you a link to set a new password."
            : isExtensionSource
              ? "Signing in for the AI Checker extension."
              : "Save your check history, manage billing, and keep your credits in sync across devices."}
        </p>

        {mode !== "forgot-password" && (
          <div className="auth-mode-toggle" role="tablist" aria-label="Sign in or sign up" style={{ maxWidth: 360, margin: "0 auto" }}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "sign-in"}
              className={`auth-mode-btn${mode === "sign-in" ? " active" : ""}`}
              onClick={() => {
                setMode("sign-in");
                setError(null);
                setStatus(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "sign-up"}
              className={`auth-mode-btn${mode === "sign-up" ? " active" : ""}`}
              onClick={() => {
                setMode("sign-up");
                setError(null);
                setStatus(null);
              }}
            >
              Sign up
            </button>
          </div>
        )}

        {mode === "forgot-password" ? (
          <form onSubmit={handleForgotPassword} style={{ maxWidth: 360, margin: "0 auto" }}>
            <div className="card">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12 }}
              />
              <button type="submit" className="cta-button" disabled={loading} style={{ width: "100%", border: "none" }}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 360, margin: "0 auto" }}>
            <div className="card">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12 }}
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12 }}
              />
              {mode === "sign-in" && (
                <button
                  type="button"
                  className="link-button"
                  style={{ fontSize: 13, display: "block", marginBottom: 12 }}
                  onClick={() => {
                    setMode("forgot-password");
                    setError(null);
                    setStatus(null);
                  }}
                >
                  Forgot password?
                </button>
              )}
              <button type="submit" className="cta-button" disabled={loading} style={{ width: "100%", border: "none" }}>
                {loading ? "Please wait…" : mode === "sign-up" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="auth-status error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            {errorVariant === "duplicate_email" ? (
              <span>
                {error}{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                    setErrorVariant("generic");
                  }}
                >
                  Sign in
                </button>{" "}
                instead, or{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode("forgot-password");
                    setError(null);
                    setErrorVariant("generic");
                  }}
                >
                  reset your password
                </button>{" "}
                if you don&apos;t remember it.
              </span>
            ) : errorVariant === "confirmation_failed" ? (
              <span>
                {error}{" "}
                {/* Recovery failures already sit on the forgot-password
                    form (see the effect above) — its own "Send reset
                    link" button already covers this, a second one here
                    would be redundant. */}
                {confirmationFailedContext === "recovery" ? null : (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setMode("sign-up");
                      setError(null);
                      setErrorVariant("generic");
                    }}
                  >
                    Sign up again
                  </button>
                )}
              </span>
            ) : (
              <span>{error}</span>
            )}
          </div>
        )}
        {status && (
          <div className="auth-status success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{status}</span>
          </div>
        )}

        {mode === "forgot-password" && (
          <p className="muted" style={{ textAlign: "center" }}>
            <button
              className="link-button"
              onClick={() => {
                setMode("sign-in");
                setError(null);
                setStatus(null);
              }}
            >
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
