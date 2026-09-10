import { useEffect, useState } from "react";
import { shouldShowResizeHint, recordResizeHintView, dismissResizeHint } from "../../lib/storage";

/**
 * One-time-ish discoverability nudge for Chrome's side panel resize handle
 * — real browser UI on the panel's left border that this extension can't
 * annotate directly, and genuinely easy to never notice (confirmed: not
 * something either of us thought to mention until this exact conversation).
 * Shown on the Check tab for the first few panel opens (see
 * shouldShowResizeHint's doc comment), or until dismissed. Not shown in
 * standalone mode (see App.tsx/PanelSectionHeader) - there's no resize
 * handle to point at in a normal browser tab.
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
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 5 4 12l4 7M16 5l4 7-4 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Tip: drag the left edge of this panel to resize it — more room for reading and editing.</span>
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
