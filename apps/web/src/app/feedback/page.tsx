"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackForm />
    </Suspense>
  );
}

/**
 * Reached from the extension's "Rate us" tab (1-3 star click) with
 * ?rating=&id= already set — see apps/extension/src/panel/tabs/
 * RateUsTab.tsx's doc comment for why the id is generated client-side
 * there rather than returned from an API call. Also works as a
 * standalone feedback form (no rating, no prior id) for e.g. a future
 * footer link — a fresh id is generated here in that case, and the
 * "You rated us..." line just doesn't render.
 */
function FeedbackForm() {
  const searchParams = useSearchParams();
  const ratingParam = searchParams.get("rating");
  const rating = ratingParam ? Number(ratingParam) : null;
  const [id] = useState(() => searchParams.get("id") ?? crypto.randomUUID());

  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Grabbed explicitly rather than relying on a cookie — this is a
    // plain Route Handler, and getAuthenticatedUser only ever reads the
    // Authorization header (see apps/web/src/lib/auth.ts), same reason
    // login/page.tsx's extension handoff and reset-password both do
    // this rather than assuming the server sees the session.
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch("/api/feedback/rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          id,
          ...(rating ? { rating } : {}),
          message,
          email: email || undefined,
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      setDone(true);
    } catch {
      setError("Something went wrong sending your feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container auth-page">
      <div className="auth-card-wrap">
        <h1 style={{ textAlign: "center" }}>Tell us what we can improve</h1>
        {rating && (
          <p className="muted" style={{ textAlign: "center" }}>
            You rated us {rating} out of 5 — we&apos;d love to know why.
          </p>
        )}

        {done ? (
          <div className="auth-status success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Thanks for the feedback — we read every one.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="card">
              <label htmlFor="message">What could we improve?</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12, fontFamily: "inherit", resize: "vertical" }}
              />
              <label htmlFor="email">Email (optional, if you&apos;d like a reply)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, marginBottom: 12 }}
              />
              <button type="submit" className="cta-button" disabled={loading} style={{ width: "100%", border: "none" }}>
                {loading ? "Sending…" : "Send feedback"}
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
