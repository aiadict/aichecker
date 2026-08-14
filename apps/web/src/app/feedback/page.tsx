"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const REASON_OPTIONS = [
  "Results seemed inaccurate",
  "The extension didn't work",
  "It was difficult to use",
  "The analysis took too long",
  "Pricing or usage limits were unclear",
  "I couldn't find the feature I needed",
  "Other",
];

const MAX_MESSAGE_LENGTH = 1500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lucide's "star" icon path (MIT licensed) — same one used by
// apps/extension/src/panel/components/RateUsPrompt.tsx, duplicated here
// rather than shared since this is a plain web page, not the extension.
const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackForm />
    </Suspense>
  );
}

/**
 * Reached from the extension's "Enjoying AI Checker?" prompt (1-3 star
 * click) with ?rating=&id= already set — see
 * apps/extension/src/panel/components/RateUsPrompt.tsx's doc comment for
 * why the id is generated client-side there rather than returned from an
 * API call. Also works as a standalone feedback form (no rating, no
 * prior id) for e.g. a future footer link — a fresh id is generated here
 * in that case, and the rating/heading just fall back to a generic form.
 *
 * The rating itself is deliberately read-only here rather than editable:
 * making it editable would need this page's whole "what went wrong /
 * what would make it better" framing to branch for a 4-5 star answer, a
 * case that shouldn't reach this page in the first place (the extension
 * already sends 4-5 star clicks straight to the Chrome Web Store).
 */
function FeedbackForm() {
  const searchParams = useSearchParams();
  const ratingParam = searchParams.get("rating");
  const rating = ratingParam ? Number(ratingParam) : null;
  const [id] = useState(() => searchParams.get("id") ?? crypto.randomUUID());

  const [reasons, setReasons] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Convenience only — the field stays fully editable/clearable, since
    // it's optional either way. Guarded on the field still being empty so
    // this can't clobber anything the user already typed if the session
    // check resolves after they've started filling the form in.
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const sessionEmail = data.session?.user.email;
      if (sessionEmail) setEmail((current) => current || sessionEmail);
    });
  }, []);

  function toggleReason(option: string) {
    setValidationError(null);
    setReasons((prev) => {
      const wasSelected = prev.includes(option);
      // Deliberate, user-triggered focus move (checking "Other" implies
      // they're about to explain), not an autofocus-on-load — doesn't
      // fight screen readers or mobile keyboards the way page-load
      // autofocus would.
      if (option === "Other" && !wasSelected) {
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      return wasSelected ? prev.filter((r) => r !== option) : [...prev, option];
    });
  }

  function validateEmail(value: string): boolean {
    if (value && !EMAIL_PATTERN.test(value)) {
      setEmailError("Enter a valid email address or leave this field empty.");
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setValidationError(null);

    if (reasons.length === 0 && !message.trim()) {
      setValidationError("Please select an option or tell us what we could improve.");
      return;
    }
    if (!validateEmail(email)) return;

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
          reasons,
          message,
          email: email || undefined,
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      setDone(true);
    } catch {
      // Deliberately doesn't clear reasons/message/email — a failed send
      // shouldn't cost the user everything they already filled in.
      setSubmitError("We couldn't send your feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const heading = rating !== null && rating <= 2 ? "What went wrong?" : "What would make AI Checker better?";
  const supportingText =
    rating === null
      ? "Tell us what we could improve."
      : rating <= 2
        ? `You rated AI Checker ${rating} out of 5. Tell us what happened so we can make it better.`
        : `You rated AI Checker ${rating} out of 5. Tell us what we could improve.`;

  return (
    <div className="feedback-page-wrap">
      <div className="feedback-card">
        {done ? (
          <div style={{ textAlign: "center" }}>
            <svg
              viewBox="0 0 24 24"
              width="40"
              height="40"
              fill="none"
              stroke="#166534"
              strokeWidth="1.6"
              style={{ margin: "0 auto 14px" }}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Thank you for your feedback</h1>
            <p className="muted" style={{ margin: "0 0 22px" }}>Your feedback helps us improve AI Checker.</p>
            <Link href="/" className="cta-button-secondary" style={{ marginTop: 0 }}>
              Back to werida.io
            </Link>
          </div>
        ) : (
          <>
            {rating !== null && (
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div className="feedback-stars" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <svg
                      key={n}
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill={n <= rating ? "var(--brand)" : "none"}
                      stroke={n <= rating ? "var(--brand)" : "var(--border)"}
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    >
                      <path d={STAR_PATH} />
                    </svg>
                  ))}
                </div>
                {/* Visible, not just aria-hidden-adjacent — the spec calls
                    for a real text alternative, not colour/icon alone. */}
                <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
                  You rated AI Checker {rating} out of 5
                </p>
              </div>
            )}

            <h1 style={{ fontSize: 21, textAlign: "center", margin: "0 0 6px" }}>{heading}</h1>
            <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "0 0 26px" }}>
              {supportingText}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div id="reasons-heading" style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                What could we improve?
              </div>
              <div className="feedback-reasons" role="group" aria-labelledby="reasons-heading">
                {REASON_OPTIONS.map((option) => {
                  const checked = reasons.includes(option);
                  return (
                    <label key={option} className={`feedback-reason-card ${checked ? "selected" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleReason(option)} />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>

              {validationError && (
                <p role="alert" className="feedback-field-error" style={{ marginTop: 10 }}>
                  {validationError}
                </p>
              )}

              <label htmlFor="message" style={{ fontWeight: 600, fontSize: 14, display: "block", margin: "22px 0 8px" }}>
                Tell us more (optional)
              </label>
              <textarea
                id="message"
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setValidationError(null);
                }}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="What happened, and what did you expect instead?"
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: 10,
                  fontFamily: "inherit",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  resize: "vertical",
                }}
              />

              <label htmlFor="email" style={{ fontWeight: 600, fontSize: 14, display: "block", margin: "20px 0 4px" }}>
                Email (optional)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                onBlur={(e) => validateEmail(e.target.value)}
                placeholder="Email address"
                aria-invalid={emailError ? "true" : "false"}
                aria-describedby={emailError ? "email-error" : "email-helper"}
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 14,
                  borderRadius: 8,
                  border: `1px solid ${emailError ? "#b91c1c" : "var(--border)"}`,
                }}
              />
              {emailError ? (
                <p id="email-error" role="alert" className="feedback-field-error">
                  {emailError}
                </p>
              ) : (
                <p id="email-helper" className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  Add your email if you&apos;d like us to follow up.
                </p>
              )}

              <button
                type="submit"
                className="cta-button"
                disabled={loading}
                style={{ width: "100%", border: "none", marginTop: 24 }}
              >
                {loading ? "Sending…" : "Send feedback"}
              </button>

              {submitError && (
                <div className="auth-status error" style={{ marginTop: 16 }} role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  <span>{submitError}</span>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
