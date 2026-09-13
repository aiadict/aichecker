import { useState } from "react";
import {
  synthesizeInsight,
  buildHighlightSegments,
  overallConfidence,
  confidenceLabel,
  type CheckResult,
  type CreateCheckResponse,
} from "@ai-checker/shared-types";
import { API_BASE_URL } from "../lib/config";
import PanelSectionHeader from "../panel/components/PanelSectionHeader";

export function describeCheckError(response: Extract<CreateCheckResponse, { ok: false }>): string {
  switch (response.error) {
    case "insufficient_credits":
      return "You're out of credits - upgrade to keep checking.";
    case "daily_cap_reached":
      return "Daily free-plan limit reached - try again tomorrow.";
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

export default function ResultCard({
  result,
  onClose,
  standalone,
}: {
  result: CheckResult;
  onClose?: () => void;
  standalone: boolean;
}) {
  const insight = synthesizeInsight(result.windows);
  const confidence = overallConfidence(result.windows);
  const confLabel = confidenceLabel(confidence);
  const [showHighlighted, setShowHighlighted] = useState(false);
  const segments = buildHighlightSegments(result.fullText, result.windows);

  return (
    <div style={{ marginBottom: 16 }}>
      <PanelSectionHeader title="Your result" standalone={standalone} />
      <div className="result-card" key={result.id}>
        {onClose && (
          <button className="result-close" onClick={onClose} aria-label="Dismiss result">
            ×
          </button>
        )}
        <div className={`verdict ${result.predictionShort}`}>{SHORT_LABEL[result.predictionShort]}</div>
        <div className="pct">
          {Math.round((result.fractionAi + result.fractionAiAssisted) * 100)}%
          <span className={`confidence-badge ${confLabel.toLowerCase()}`}>{confLabel} confidence</span>
        </div>
        <div className="muted">
          of this text shows AI involvement{" "}
          <span
            title="Text is split into segments and each is scored for AI involvement; this percentage is a probabilistic estimate, not certain proof. Confidence reflects how clear-cut that scoring was for this particular text — a low-confidence result is worth double-checking."
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

        <button
          type="button"
          className="link-button"
          style={{ marginTop: 8, display: "block" }}
          onClick={() => setShowHighlighted((v) => !v)}
        >
          {showHighlighted ? "Hide" : "Show"} highlighted text {showHighlighted ? "▴" : "▾"}
        </button>
        {showHighlighted && (
          // Collapsed by default, not shown automatically — the same text is
          // already visible, editable, right below this card in the
          // textarea. Showing a second (highlighted, read-only) copy here
          // too is only worth the duplication when someone actually wants
          // to see which sentences were flagged before deciding what to
          // edit, not on every single result.
          <div className="checked-text" style={{ marginTop: 8 }}>
            {segments.map((seg, i) =>
              seg.label && seg.label !== "human" ? (
                <mark key={i} className={`hl-${seg.label}`}>
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </div>
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

        <div className="result-card-footer">
          <a href={`${API_BASE_URL}/resultsupport`} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"
                strokeLinejoin="round"
              />
              <path
                d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
                strokeLinejoin="round"
              />
            </svg>
            Understand your result &amp; how we check it
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
