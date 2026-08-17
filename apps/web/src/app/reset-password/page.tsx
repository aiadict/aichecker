"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  // Landed on here via /auth/confirm exchanging a recovery token into a
  // real session (see src/app/login/page.tsx's handleForgotPassword) —
  // that exchange is what actually authorizes the updateUser call below,
  // not anything on this page. A direct visit with no such session (link
  // already used, expired, or just typed in) has nothing to update against.
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setCheckingSession(false);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    // Hard navigation, not router.push() — see login/page.tsx's matching
    // comment. Same class of bug: a stale, pre-auth Router Cache entry for
    // /dashboard (from the nav bar's background prefetch, before this
    // password update established a real session) can make a soft push
    // silently bounce back to /login instead of landing on /dashboard.
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  }

  if (checkingSession) return null;

  return (
    <div className="container auth-page">
      <div className="auth-card-wrap">
        <h1 style={{ textAlign: "center" }}>Set a new password</h1>

        {!hasSession && (
          <div className="auth-status error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            <span>This reset link is invalid or has expired. Request a new one from the sign-in page.</span>
          </div>
        )}

        {hasSession && done && (
          <div className="auth-status success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Password updated. Taking you to your dashboard…</span>
          </div>
        )}

        {hasSession && !done && (
          <form onSubmit={handleSubmit} style={{ maxWidth: 360, margin: "0 auto" }}>
            <div className="card">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12 }}
              />
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12 }}
              />
              <button type="submit" className="cta-button" disabled={loading} style={{ width: "100%", border: "none" }}>
                {loading ? "Updating…" : "Update password"}
              </button>
            </div>

            {error && (
              <div className="auth-status error" style={{ marginTop: 16 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
