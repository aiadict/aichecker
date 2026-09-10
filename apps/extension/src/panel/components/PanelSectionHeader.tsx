// Shared by CheckForAiTab ("Check text") and ResultCard ("Your result") —
// same title-left/"Open web checker"-right row in both places, per the
// design brief. Not shown at all in standalone mode (see App.tsx) - the
// link's whole purpose is opening that same view in a bigger tab, which
// makes no sense to show from inside that already-opened tab.
export default function PanelSectionHeader({ title, standalone }: { title: string; standalone: boolean }) {
  return (
    <div className="panel-section-header">
      <h2>{title}</h2>
      {!standalone && (
        <button type="button" className="open-web-checker-link" onClick={openWebChecker}>
          Open web checker
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Opens this same panel UI in a full browser tab instead of the narrow
 * side panel - chrome.runtime.getURL points at the extension's own
 * bundled panel page, not a werida.io URL (see docs/architecture.md's
 * note on why: reuses every existing component instead of duplicating the
 * check UI in apps/web, at the cost of requiring the extension to be
 * installed - a real web-hosted checker page is a separate, larger,
 * future initiative, not this). ?standalone=1 is read by App.tsx to widen
 * the layout and hide this same "Open web checker" link/header row.
 * chrome.tabs.create needs no "tabs" permission - that's only required to
 * read OTHER tabs' data, not to open a new one.
 */
export function openWebChecker() {
  const url = `${chrome.runtime.getURL("src/panel/index.html")}?standalone=1`;
  chrome.tabs.create({ url });
}
