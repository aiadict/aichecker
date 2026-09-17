"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { postExtensionAuthSuccess } from "@/lib/extension-handoff";

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
 * message. The postMessage handoff above is therefore treated as
 * best-effort, not guaranteed — copy below always leads with "open the
 * extension and click Sign in" as the one path that reliably works
 * (same one already proven live), rather than implying the extension is
 * definitely signed in already.
 *
 * postExtensionAuthSuccess (not a single postMessage call) — see its own
 * doc comment. Confirmed live: this page reaching "connected" doesn't by
 * itself mean the extension caught the message, since landing here from
 * an OAuth redirect chain gives the content script's document_idle
 * injection zero of the natural margin a typed-out /login submit has.
 */
function ExtensionConnectedBody() {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session) {
        postExtensionAuthSuccess(session);
        setConnected(true);
      }
      setChecking(false);
    });
  }, []);

  return (
    <div className="container auth-page">
      <div className="auth-card-wrap">
        <h1 style={{ textAlign: "center" }}>You&apos;re signed in</h1>

        {checking ? null : connected ? (
          <div className="connected-card">
            <div className="connected-card-row connected-card-row-primary">
              <span className="connected-card-icon connected-card-icon-success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 12.5l4 4 8-8.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <div className="connected-card-title">Continue in the extension</div>
                <p className="connected-card-desc">
                  Open the AI Checker extension. Your credits should now appear there.
                </p>
              </div>
            </div>
            <div className="connected-card-row">
              <span className="connected-card-icon connected-card-icon-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 11v5" strokeLinecap="round" />
                  <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <div>
                <div className="connected-card-title">Still seeing &quot;Sign in&quot; in the extension?</div>
                <p className="connected-card-desc">Click it and sign in there too.</p>
              </div>
            </div>
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
