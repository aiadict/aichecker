import { synthesizeInsight, type CheckResult, type CreateCheckResponse } from "@ai-checker/shared-types";
import { API_BASE_URL } from "../lib/config";

export function describeCheckError(response: Extract<CreateCheckResponse, { ok: false }>): string {
  switch (response.error) {
    case "insufficient_credits":
      return "You're out of credits — upgrade to keep checking.";
    case "daily_cap_reached":
      return "Daily free-plan limit reached — try again tomorrow.";
    case "unauthorized":
      // CheckForAiTab special-cases this one with an inline Sign in link
      // instead of this plain string — kept here only so the switch stays
      // exhaustive.
      return "Sign in to check for AI.";
    case "text_too_short":
    case "text_too_long":
      return "That text is outside the allowed length for a check.";
    case "upstream_error":
      return response.message;
  }
}

// Pangram's own `prediction` is a full sentence ("We believe that this
// document is fully AI-generated") — good for the detail page, too long to
// sit next to a big percentage number here. Short label instead, derived
// from our own normalized category rather than parsing their sentence.
const SHORT_LABEL: Record<CheckResult["predictionShort"], string> = {
  ai: "AI generated",
  human: "Human written",
  mixed: "AI-assisted",
};

export default function ResultCard({ result, onClose }: { result: CheckResult; onClose?: () => void }) {
  const insight = synthesizeInsight(result.windows);

  return (
    <div className="result-card" key={result.id}>
      {onClose && (
        <button className="result-close" onClick={onClose} aria-label="Dismiss result">
          ×
        </button>
      )}
      <div className={`verdict ${result.predictionShort}`}>{SHORT_LABEL[result.predictionShort]}</div>
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

      {result.shareSlug && (
        <div style={{ marginTop: 12 }}>
          <a
            href={`${API_BASE_URL}/history/${result.shareSlug}`}
            target="_blank"
            rel="noreferrer"
            className="link-button"
          >
            View full analysis
          </a>
        </div>
      )}
    </div>
  );
}
