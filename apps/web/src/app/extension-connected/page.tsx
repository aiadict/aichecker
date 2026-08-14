"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ExtensionConnectedPage() {
  return (
    <Suspense fallback={null}>
      <ExtensionConnectedBody />
    </Suspense>
  );
}

/**
 * Landed on after email confirmation for a sign-up that started in the
 * extension (see login/page.tsx's emailRedirectTo). /auth/confirm is a
 * pure server-side redirect — no client JS runs there — so it can never
 * do the window.postMessage handoff that actually signs the extension in;
 * this page exists specifically to do that handoff after the fact, using
 * the session /auth/confirm just established via a real Set-Cookie (so
 * it's already present by the time this page's JS runs, no propagation
 * race). Reuses the exact same postMessage contract handleSubmit uses for
 * a normal sign-in, so apps/extension's content script / background
 * handler need zero changes — they don't care which page sent it, only
 * that it came from this origin.
 *
 * Known limitation, not new: if the confirmation email is opened in a
 * different browser/device than the one with the extension installed
 * (common — e.g. a phone's Mail app), this page still succeeds on the
 * web side but there's no content script listening there to catch the
 * message. Copy below accounts for that instead of promising the
 * extension is definitely signed in.
 */
function ExtensionConnectedBody() {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session) {
        window.postMessage(
          {
            type: "ai-checker/auth-success",
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
          },
          window.location.origin
        );
        setConnected(true);
      }
      setChecking(false);
    });
  }, []);

  return (
    <div className="container auth-page">
      <div className="auth-card-wrap">
        <h1 style={{ textAlign: "center" }}>Email confirmed</h1>

        {checking ? null : connected ? (
          <div className="auth-status success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              You&apos;re signed in on werida.io. If you&apos;re viewing this in the same browser as the
              AI Checker extension, it&apos;s signed in too — otherwise, open the extension and sign in
              there.
            </span>
          </div>
        ) : (
          <div className="auth-status error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            <span>
              Couldn&apos;t confirm your session here.{" "}
              <Link href="/login?source=extension">Sign in</Link> to continue.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
