"use client";

import { useState } from "react";
import { buildPositionalBlocks, type CheckWindow } from "@ai-checker/shared-types";

const SEGMENT_LABEL: Record<string, string> = { ai: "AI-Generated", mixed: "AI-Assisted", human: "Human Written" };

/**
 * Merges adjacent same-label windows into contiguous blocks (see
 * buildPositionalBlocks' own doc comment for why — TruthScan's
 * per-sentence windows would otherwise render as a noisy hatch of many
 * thin same-color segments instead of clean colored regions). Hidden
 * entirely for a single uniform block — nothing positional to show,
 * same reasoning synthesizeInsight already uses for its own one-line text.
 */
export default function PositionalBar({ windows, totalWords }: { windows: CheckWindow[]; totalWords: number }) {
  const blocks = buildPositionalBlocks(windows);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (blocks.length < 2 || totalWords === 0) return null;

  return (
    <div className="positional-bar-wrap">
      <div className="positional-bar">
        {blocks.map((b, i) => (
          <div
            key={i}
            className={`positional-bar-seg ${b.label}`}
            style={{ width: `${(b.wordCount / totalWords) * 100}%` }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {hoveredIndex === i && (
              <div className="positional-tooltip">
                {SEGMENT_LABEL[b.label]} · {Math.round(b.confidence * 100)}% confidence
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="positional-bar-labels">
        <span>Start of text</span>
        <span>End of text</span>
      </div>
    </div>
  );
}
