import { useEffect, useState } from "react";
import { createCheck } from "../../lib/api";
import { notifyCreditsChanged } from "../../lib/events";
import { countWords, creditsForWordCount, type CreateCheckResponse } from "@ai-checker/shared-types";
import ResultCard, { describeCheckError } from "../../components/ResultCard";

// Word-based, not character-based — matches the backend's own minimum
// (apps/web/src/app/api/checks/route.ts) exactly, via the same countWords
// helper, so the button's enabled state and the server's validation can
// never disagree on what "50 words" means.
const MIN_WORDS = 50;

export default function CheckForAiTab({
  prefillText,
  autoRunToken,
}: {
  prefillText: string;
  autoRunToken?: number;
}) {
  const [text, setText] = useState(prefillText);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CreateCheckResponse | null>(null);

  useEffect(() => {
    if (prefillText) setText(prefillText);
  }, [prefillText]);

  const wordCount = countWords(text);
  const credits = creditsForWordCount(wordCount);
  const belowMinimum = wordCount < MIN_WORDS;

  // Accepts an override so an auto-run (below) doesn't depend on `text`
  // state having already caught up to a just-arrived prefillText in the
  // same render — the two are set from separate effects, so reading `text`
  // directly here would risk a stale value.
  async function handleCheck(overrideText?: string) {
    setLoading(true);
    setResponse(null);
    try {
      const res = await createCheck({ text: overrideText ?? text });
      setResponse(res);
      if (res.ok) notifyCreditsChanged();
    } catch {
      setResponse({ ok: false, error: "upstream_error", message: "Network error. Is apps/web running?" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Fires once per real pending selection (floating icon / right-click
    // "Check for AI Content" — see panel/App.tsx), not on plain typing.
    // Skips straight past the extra "now click Check for AI" step, since
    // the whole point of selecting text and clicking that icon is to check
    // it, not just to paste it. Under the word minimum, do nothing and let
    // the existing "Minimum 50 words" hint show, same as manual typing.
    if (!autoRunToken) return;
    if (countWords(prefillText) < MIN_WORDS) return;
    handleCheck(prefillText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunToken]);

  return (
    <div className="check-tab">
      {response && !response.ok && response.error === "unauthorized" && (
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          {/* Header's own Sign-in pill is always visible directly above,
              on every tab — no need to duplicate it here (see
              apps/extension/src/panel/components/Header.tsx). Only the
              wording changes based on `reason`: reaching the trial's own
              limit or the shared daily cap both mean "you had free
              checks and used them", a different situation from any other
              unauthenticated attempt. */}
          {response.reason === "trial_exhausted" || response.reason === "anon_daily_cap_reached"
            ? "You've used your 2 free checks — sign in to keep going."
            : "Sign in to check for AI."}
        </p>
      )}
      {response && !response.ok && response.error !== "unauthorized" && (
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          {describeCheckError(response)}
        </p>
      )}

      {response?.ok && (
        <ResultCard result={response.result} onClose={() => setResponse(null)} />
      )}

      <div className="textarea-wrap">
        <textarea
          placeholder="Paste a paragraph from an article, essay, or email to check it for AI"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="textarea-counter">
          {wordCount} {wordCount === 1 ? "Word" : "Words"}, {credits} {credits === 1 ? "Credit" : "Credits"}
        </div>
        {text.length > 0 && (
          <button className="clear-text-btn" onClick={() => setText("")} aria-label="Clear text">
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M5.5 6l.6 9a1 1 0 0 0 1 .9h5.8a1 1 0 0 0 1-.9l.6-9"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {text.length > 0 && belowMinimum && (
        <p className="min-words-hint">Minimum 50 words required for accurate detection</p>
      )}

      <button className="primary-button" disabled={belowMinimum || loading} onClick={() => handleCheck()}>
        {loading ? "Checking…" : "Check for AI"}
      </button>
    </div>
  );
}
