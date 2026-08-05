import { useEffect, useState } from "react";
import { getPinNudgeDismissed, setPinNudgeDismissed } from "../../lib/storage";

/**
 * Chrome has no API for an extension to pin itself to the toolbar — pinning
 * is a user-controlled preference by design, not something we can trigger
 * programmatically. The best available option is this instructional nudge.
 *
 * chrome.action.getUserSettings() (MV3, Chrome 91+) reports whether the
 * extension is actually pinned right now, so this only shows up while it's
 * genuinely still needed — not just "shown once and remembered," which
 * would keep nagging someone who already pinned it, or stay silent for
 * someone who unpinned it later.
 */
export default function PinNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      if (await getPinNudgeDismissed()) return;
      const { isOnToolbar } = await chrome.action.getUserSettings();
      if (!isOnToolbar) setVisible(true);
    })();
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    setPinNudgeDismissed();
  }

  return (
    <div className="pin-nudge">
      <span>
        📌 Pin AI Checker for one-click access — click the puzzle-piece icon in your toolbar, then
        the pin next to AI Checker.
      </span>
      <button className="pin-nudge-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
