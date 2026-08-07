import { useEffect, useState } from "react";
import { createCheck } from "../../lib/api";
import { countWords, creditsForWordCount, type CreateCheckResponse } from "@ai-checker/shared-types";
import ResultCard, { describeCheckError } from "../../components/ResultCard";

// Word-based, not character-based — matches the backend's own minimum
// (apps/web/src/app/api/checks/route.ts) exactly, via the same countWords
// helper, so the button's enabled state and the server's validation can
// never disagree on what "50 words" means.
const MIN_WORDS = 50;

export default function CheckForAiTab({ prefillText }: { prefillText: string }) {
  const [text, setText] = useState(prefillText);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CreateCheckResponse | null>(null);

  useEffect(() => {
    if (prefillText) setText(prefillText);
  }, [prefillText]);

  const wordCount = countWords(text);
  const credits = creditsForWordCount(wordCount);
  const belowMinimum = wordCount < MIN_WORDS;

  async function handleCheck() {
    setLoading(true);
    setResponse(null);
    try {
      const res = await createCheck({ text });
      setResponse(res);
    } catch {
      setResponse({ ok: false, error: "upstream_error", message: "Network error. Is apps/web running?" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="check-tab">
      {response && !response.ok && (
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          {describeCheckError(response)}
        </p>
      )}

      {response?.ok && (
        <ResultCard result={response.result} onClose={() => setResponse(null)} />
      )}

      <div className="word-counter-row">
        {wordCount} {wordCount === 1 ? "Word" : "Words"}, {credits} {credits === 1 ? "Credit" : "Credits"}
      </div>

      <div className="textarea-wrap">
        <textarea
          placeholder="Enter or paste your text here"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
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

      <button className="primary-button" disabled={belowMinimum || loading} onClick={handleCheck}>
        {loading ? "Checking…" : "Check for AI"}
      </button>
    </div>
  );
}
