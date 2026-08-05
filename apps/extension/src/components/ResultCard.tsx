import { useState } from "react";
import {
  synthesizeInsight,
  type CheckResult,
  type CreateCheckResponse,
  type ShareCheckResponse,
} from "@ai-checker/shared-types";
import { API_BASE_URL } from "../lib/config";

/** Used by the popup's "Check for AI" tab. `shareFn` is injected rather than imported directly
 * so this component doesn't need to know where the share call actually goes. */

export function describeCheckError(response: Extract<CreateCheckResponse, { ok: false }>): string {
  switch (response.error) {
    case "insufficient_credits":
      return "You're out of credits — upgrade to keep checking.";
    case "daily_cap_reached":
      return "Daily free-plan limit reached — try again tomorrow.";
    case "unauthorized":
      return "Please sign in from the extension's Settings tab first.";
    case "text_too_short":
    case "text_too_long":
      return "That text is outside the allowed length for a check.";
    case "upstream_error":
      return response.message;
  }
}

function ShareButton({
  checkId,
  shareFn,
}: {
  checkId: string;
  shareFn: (id: string) => Promise<ShareCheckResponse>;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setBusy(true);
    const res = await shareFn(checkId);
    setBusy(false);
    if (!res.ok) return;
    await navigator.clipboard.writeText(`${API_BASE_URL}/history/${res.shareSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button className="link-button" onClick={handleShare} disabled={busy}>
      {copied ? "Link copied!" : "Share result"}
    </button>
  );
}

export default function ResultCard({
  result,
  shareFn,
}: {
  result: CheckResult;
  shareFn: (id: string) => Promise<ShareCheckResponse>;
}) {
  const insight = synthesizeInsight(result.windows);

  return (
    <div className="result-card" key={result.id}>
      <div className={`verdict ${result.predictionShort}`}>{result.prediction}</div>
      <div className="pct">{Math.round((result.fractionAi + result.fractionAiAssisted) * 100)}%</div>
      <div className="muted">
        of this text shows AI involvement{" "}
        <span
          title="Powered by Pangram's AI detection model. Text is split into windows and each is scored for AI involvement; this percentage is a probabilistic estimate, not certain proof."
          style={{ cursor: "help" }}
        >
          ⓘ
        </span>
      </div>
      <div className="breakdown-bar">
        <div className="seg ai" style={{ width: `${result.fractionAi * 100}%` }} />
        <div className="seg assisted" style={{ width: `${result.fractionAiAssisted * 100}%` }} />
        <div className="seg human" style={{ width: `${result.fractionHuman * 100}%` }} />
      </div>
      <div className="breakdown-legend">
        <span>
          <i className="dot ai" />
          AI {Math.round(result.fractionAi * 100)}%
        </span>
        <span>
          <i className="dot assisted" />
          Assisted {Math.round(result.fractionAiAssisted * 100)}%
        </span>
        <span>
          <i className="dot human" />
          Human {Math.round(result.fractionHuman * 100)}%
        </span>
      </div>

      {insight && (
        <p className="muted" style={{ marginTop: 8 }}>
          {insight}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <a
          href={`${API_BASE_URL}/history/${result.shareSlug}`}
          target="_blank"
          rel="noreferrer"
          className="link-button"
        >
          View full analysis
        </a>
        <ShareButton checkId={result.id} shareFn={shareFn} />
      </div>
    </div>
  );
}
