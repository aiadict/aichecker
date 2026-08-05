import { useEffect, useState } from "react";
import { createCheck, shareCheck } from "../../lib/api";
import { countWords, type CreateCheckResponse } from "@ai-checker/shared-types";
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
    <div>
      <textarea
        placeholder="Enter or paste your text here"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="primary-button" disabled={belowMinimum || loading} onClick={handleCheck}>
        {loading ? "Checking…" : "Check for AI"}
      </button>

      {belowMinimum && (
        <p style={{ color: "var(--brand)", fontSize: 12, marginTop: 6 }}>
          Minimum 50 words required for accurate detection
        </p>
      )}

      {response && !response.ok && (
        <p className="muted" style={{ marginTop: 12 }}>
          {describeCheckError(response)}
        </p>
      )}

      {response?.ok && <ResultCard result={response.result} shareFn={shareCheck} />}
    </div>
  );
}
