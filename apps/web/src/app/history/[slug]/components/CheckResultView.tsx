import type { ReactNode } from "react";
import {
  buildHighlightSegments,
  synthesizeInsight,
  overallConfidence,
  confidenceLabel,
  type CheckResult,
} from "@ai-checker/shared-types";
import PositionalBar from "./PositionalBar";

type Props = Pick<
  CheckResult,
  | "fullText"
  | "wordCount"
  | "prediction"
  | "predictionShort"
  | "fractionAi"
  | "fractionHuman"
  | "fractionAiAssisted"
  | "windows"
> & {
  // Page-specific content that still belongs inside the same card (e.g.
  // /history/[slug]'s "this link is private" note) - kept as a slot rather
  // than baked in here, since this component has no idea what a share
  // link even is.
  footerNote?: ReactNode;
};

/**
 * The result-display block shared by /history/[slug] (extracted from here
 * 2026-09-18) and /check. Pure presentational - no data fetching, no
 * DB-row awareness, just CheckResult's own fields in, markup out. Same
 * CSS classes (.pill, .breakdown-bar, .confidence-badge, .checked-text,
 * .hl-*) apps/extension's own ResultCard.tsx uses the extension-side
 * equivalents of, so a check looks the same wherever it's viewed.
 */
export default function CheckResultView({
  fullText,
  wordCount,
  prediction,
  predictionShort,
  fractionAi,
  fractionHuman,
  fractionAiAssisted,
  windows,
  footerNote,
}: Props) {
  const segments = buildHighlightSegments(fullText, windows);
  const insight = synthesizeInsight(windows);
  const confidence = overallConfidence(windows);
  const confLabel = confidenceLabel(confidence);
  const aiInvolvement = Math.round((fractionAi + fractionAiAssisted) * 100);

  return (
    <div className="card">
      <p className={`pill ${predictionShort}`}>{prediction}</p>

      <div
        style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 0", display: "flex", alignItems: "baseline", gap: 8 }}
      >
        {aiInvolvement}%
        <span className={`confidence-badge ${confLabel.toLowerCase()}`}>{confLabel} confidence</span>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        of this text shows AI involvement
      </p>

      <div className="breakdown-bar">
        <div className="seg ai" style={{ width: `${fractionAi * 100}%` }} />
        <div className="seg assisted" style={{ width: `${fractionAiAssisted * 100}%` }} />
        <div className="seg human" style={{ width: `${fractionHuman * 100}%` }} />
      </div>
      <div className="breakdown-legend">
        <span>
          <i className="dot ai" />
          AI {Math.round(fractionAi * 100)}%
        </span>
        <span>
          <i className="dot assisted" />
          Assisted {Math.round(fractionAiAssisted * 100)}%
        </span>
        <span>
          <i className="dot human" />
          Human {Math.round(fractionHuman * 100)}%
        </span>
      </div>

      {insight && (
        <p className="muted" style={{ marginTop: 12 }}>
          {insight}
        </p>
      )}

      <PositionalBar windows={windows} totalWords={wordCount} />

      <p className="muted" style={{ marginTop: 16 }}>
        {wordCount} words
      </p>
      <div className="checked-text">
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

      {footerNote}
    </div>
  );
}
