import { API_BASE_URL } from "../../lib/config";

// Shared by CheckForAiTab ("Check text") and ResultCard ("Your result") —
// same title-left/"Open web checker"-right row in both places, per the
// design brief.
export default function PanelSectionHeader({ title }: { title: string }) {
  return (
    <div className="panel-section-header">
      <h2>{title}</h2>
      <button type="button" className="open-web-checker-link" onClick={openWebChecker}>
        Open web checker
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Opens the real, hosted web checker at werida.io/check in a new tab —
 * the full web-native version of this same "paste text, check it, see
 * the result" flow (see docs/architecture.md's "Hosted web checker at
 * /check" section). Used to open this extension's own bundled page in a
 * full tab instead (`?standalone=1`); that mode and the duplicate code
 * it required have been removed now that a real web page exists.
 */
export function openWebChecker() {
  chrome.tabs.create({ url: `${API_BASE_URL}/check` });
}
