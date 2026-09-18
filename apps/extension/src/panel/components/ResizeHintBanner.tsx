import { useEffect, useState } from "react";
import { shouldShowResizeHint, recordResizeHintView, dismissResizeHint } from "../../lib/storage";

/**
 * One-time-ish discoverability nudge for Chrome's side panel resize handle
 * — real browser UI on the panel's left border that this extension can't
 * annotate directly, and genuinely easy to never notice (confirmed: not
 * something either of us thought to mention until this exact conversation).
 * Shown on the Check tab for the first few panel opens (see
 * shouldShowResizeHint's doc comment), or until dismissed.
 */
export default function ResizeHintBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    shouldShowResizeHint().then((show) => {
      setVisible(show);
      if (show) recordResizeHintView();
    });
  }, []);

  if (!visible) return null;

  return (
    <div className="resize-hint-banner">
      {/* A vertical bar with arrows splayed left/right - reads as "drag
          this edge" more directly than the old plain "<>" brackets did.
          Nudges gently side to side (see .resize-hint-icon's animation)
          since a static icon next to text is easy to skim past entirely -
          this is specifically trying to catch the eye toward the actual
          physical edge of the panel, not just decorate the sentence. */}
      <svg
        className="resize-hint-icon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 4v16" strokeLinecap="round" />
        <path d="M7 9 4 12l3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <strong style={{ display: "block" }}>Need more space</strong>
        Drag the panel&apos;s left edge to make it wider.
      </span>
      <button
        type="button"
        aria-label="Dismiss tip"
        onClick={() => {
          setVisible(false);
          dismissResizeHint();
        }}
      >
        ×
      </button>
    </div>
  );
}
