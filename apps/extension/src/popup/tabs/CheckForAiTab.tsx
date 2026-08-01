import { useEffect, useState } from "react";
import { createCheck, shareCheck } from "../../lib/api";
import type { CreateCheckResponse } from "@ai-checker/shared-types";
import ResultCard, { describeCheckError } from "../../components/ResultCard";

const MIN_CHARS = 20;

export default function CheckForAiTab({ prefillText }: { prefillText: string }) {
  const [text, setText] = useState(prefillText);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CreateCheckResponse | null>(null);

  useEffect(() => {
    if (prefillText) setText(prefillText);
  }, [prefillText]);

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
      <button className="primary-button" disabled={text.trim().length < MIN_CHARS || loading} onClick={handleCheck}>
        {loading ? "Checking…" : "Check for AI"}
      </button>

      {response && !response.ok && (
        <p className="muted" style={{ marginTop: 12 }}>
          {describeCheckError(response)}
        </p>
      )}

      {response?.ok && <ResultCard result={response.result} shareFn={shareCheck} />}
    </div>
  );
}
