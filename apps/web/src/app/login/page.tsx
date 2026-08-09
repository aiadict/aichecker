"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

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

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
              // of its default client-side-only auto-detect, and carries
              // through where to land afterwards — back to the extension
              // handoff if that's where sign-up started, same as sign-in.
              emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
                isExtensionSource ? "/login?source=extension" : redirectTo
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
      setStatus("Check your email to confirm your account, then come back and sign in.");
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

  return (
    <div className="container auth-page">
      <div className="auth-card-wrap">
        <h1 style={{ textAlign: "center" }}>{mode === "sign-up" ? "Create your account" : "Sign in"}</h1>
        <p className="muted" style={{ textAlign: "center" }}>
          {isExtensionSource
            ? "Signing in for the AI Checker extension."
            : "Save your check history, manage billing, and keep your credits in sync across devices."}
        </p>

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
            <button type="submit" className="cta-button" disabled={loading} style={{ width: "100%", border: "none" }}>
              {loading ? "Please wait…" : mode === "sign-up" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </form>

        {error && (
          <div className="auth-status error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            <span>{error}</span>
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

        <p className="muted" style={{ textAlign: "center" }}>
          {mode === "sign-in" ? (
            <>
              No account?{" "}
              <button className="link-button" onClick={() => setMode("sign-up")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="link-button" onClick={() => setMode("sign-in")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
