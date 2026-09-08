"use client";

/**
 * Hands a Supabase session off to the AI Checker extension via
 * window.postMessage (see apps/extension/src/content/index.tsx's listener,
 * and docs/architecture.md's "Auth flow: extension sign-in").
 *
 * Resends the same message every 250ms for ~2s instead of once. The
 * extension's content script registers its listener at run_at:
 * "document_idle" (apps/extension/manifest.config.ts) - independent of this
 * page's own React hydration. /login's postMessage (fired only after a user
 * types credentials and clicks Submit) has several seconds of natural
 * margin for that injection to finish first, but a page that fires this on
 * mount - like /extension-connected, landed on straight from an OAuth
 * redirect chain with zero user interaction in between - has none. Confirmed
 * live: /extension-connected showed its own "connected" success state
 * (proving getSession() + the single postMessage it used to send did run)
 * while the extension's side panel stayed signed out - the message went out
 * before the content script's listener existed to catch it. Resending is
 * safe: the extension's background handler just re-stores the same tokens
 * each time, so a few harmless repeats reliably close the race without
 * needing a real handshake/ack protocol between page and content script.
 */
export function postExtensionAuthSuccess(session: { access_token: string; refresh_token: string }): void {
  const payload = {
    type: "ai-checker/auth-success",
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };

  window.postMessage(payload, window.location.origin);
  let attempts = 1;
  const interval = setInterval(() => {
    window.postMessage(payload, window.location.origin);
    attempts += 1;
    if (attempts >= 8) clearInterval(interval);
  }, 250);
}
