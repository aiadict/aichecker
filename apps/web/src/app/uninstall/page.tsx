"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Opened automatically by Chrome when a user removes the extension - see
 * apps/extension/src/background/index.ts's chrome.runtime.setUninstallURL
 * call. That API's target is a static URL set in advance (capped at 255
 * chars by Chrome), so the only context it can carry is whatever was
 * already known when it was last set - here, just a device_id, best-effort
 * (not present if the URL was set before a device id existed yet, or on
 * browsers/policies that suppress the uninstall URL entirely).
 *
 * No auth check, unlike /dashboard/* - by definition, the extension the
 * user would've been signed into is already gone by the time this loads,
 * and this is a low-friction one-question survey, not an account page.
 */
export default function UninstallPage() {
  return (
    <Suspense fallback={null}>
      <UninstallForm />
    </Suspense>
  );
}

function UninstallForm() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device_id");

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/feedback/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, deviceId: deviceId ?? undefined }),
      });
      if (!res.ok) throw new Error("request_failed");
      setDone(true);
    } catch {
      setError("We couldn't send your feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="feedback-page-wrap">
        <div className="uninstall-hero-card" style={{ marginBottom: 0, textAlign: "center" }}>
          <svg
            viewBox="0 0 24 24"
            width="36"
            height="36"
            fill="none"
            stroke="#166534"
            strokeWidth="1.6"
            style={{ margin: "0 auto 14px" }}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Thanks for letting us know</h1>
          <p className="muted" style={{ margin: 0 }}>Your feedback helps us improve AI Checker.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page-wrap">
      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        <div className="uninstall-hero-card">
          <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>We&apos;re sorry to see you go.</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>Your feedback helps us improve AI Checker.</p>
        </div>

        <div className="uninstall-question-card">
          <label htmlFor="reason" style={{ fontSize: 17, fontWeight: 600, display: "block" }}>
            Why have you deleted the app?
          </label>
          <input
            id="reason"
            className="uninstall-answer-input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Your answer"
            maxLength={1000}
          />
        </div>

        {error && (
          <div className="auth-status error" style={{ maxWidth: 640, margin: "0 auto 16px" }} role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="uninstall-actions">
          <button type="submit" className="cta-button" disabled={loading} style={{ marginTop: 0, border: "none" }}>
            {loading ? "Submitting…" : "Submit"}
          </button>
          <button type="button" className="link-button" onClick={() => setReason("")}>
            Clear form
          </button>
        </div>
      </form>
    </div>
  );
}
