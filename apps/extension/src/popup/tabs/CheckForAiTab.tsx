import { useEffect, useState } from "react";
import { createCheck } from "../../lib/api";
import type { CreateCheckResponse } from "@ai-checker/shared-types";

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
          {response.error === "insufficient_credits" && "You're out of credits — upgrade to keep checking."}
          {response.error === "daily_cap_reached" && "Daily free-plan limit reached — try again tomorrow."}
          {response.error === "unauthorized" && "Please sign in from the Settings tab first."}
          {(response.error === "text_too_short" || response.error === "text_too_long") &&
            "That text is outside the allowed length for a check."}
          {response.error === "upstream_error" && response.message}
        </p>
      )}

      {response?.ok && (
        <div className="result-card">
          <div className={`verdict ${response.result.predictionShort}`}>{response.result.prediction}</div>
          <div className="pct">
            {Math.round((response.result.fractionAi + response.result.fractionAiAssisted) * 100)}%
          </div>
          <div className="muted">of this text shows AI involvement</div>
          <div className="breakdown-bar">
            <div className="seg ai" style={{ width: `${response.result.fractionAi * 100}%` }} />
            <div className="seg assisted" style={{ width: `${response.result.fractionAiAssisted * 100}%` }} />
            <div className="seg human" style={{ width: `${response.result.fractionHuman * 100}%` }} />
          </div>
          <div className="breakdown-legend">
            <span>
              <i className="dot ai" />
              AI {Math.round(response.result.fractionAi * 100)}%
            </span>
            <span>
              <i className="dot assisted" />
              Assisted {Math.round(response.result.fractionAiAssisted * 100)}%
            </span>
            <span>
              <i className="dot human" />
              Human {Math.round(response.result.fractionHuman * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
