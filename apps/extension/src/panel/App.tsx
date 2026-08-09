import { useEffect, useState } from "react";
import Header from "./components/Header";
import CheckForAiTab from "./tabs/CheckForAiTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";
import { consumePendingSelection, onPendingSelectionSet } from "../lib/storage";
import { API_BASE_URL } from "../lib/config";

type TabKey = "check" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<TabKey>("check");
  const [prefillText, setPrefillText] = useState("");
  // Bumped (never read for its own value) every time a real pending
  // selection arrives — CheckForAiTab watches it to auto-run the check for
  // the floating-icon / right-click flow, without depending on prefillText
  // itself changing (prefillText can be set from plain typing too, which
  // shouldn't auto-run anything).
  const [autoRunToken, setAutoRunToken] = useState(0);

  useEffect(() => {
    // Set by background/index.ts's openSidePanelWithSelection() — both the
    // floating icon and the right-click menu land here. Scoped to this
    // panel's own window: chrome.windows.getCurrent(), called from inside a
    // side panel, resolves to the window that panel is attached to. Without
    // this, two side panels open on two screens both raced to consume the
    // same unscoped entry and both auto-ran the same check (see storage.ts).
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    chrome.windows.getCurrent().then((win) => {
      if (cancelled || win.id === undefined) return;
      const windowId = win.id;

      function loadPendingSelection() {
        consumePendingSelection(windowId).then((pending) => {
          if (pending?.text) {
            setPrefillText(pending.text);
            setAutoRunToken((t) => t + 1);
            setTab("check");
          }
        });
      }

      // Once for whatever was already waiting when the panel mounted, and
      // again any time a new one arrives while it's already open — unlike
      // the old popup (always a fresh mount), the side panel is persistent,
      // so a selection made while it's sitting open needs a live update, not
      // just a one-time read.
      loadPendingSelection();
      unsubscribe = onPendingSelectionSet(windowId, loadPendingSelection);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <div className="panel-root">
      <Header />
      <div className="tabpanel">
        {tab === "check" && <CheckForAiTab prefillText={prefillText} autoRunToken={autoRunToken} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
      <nav className="icon-bar">
        <button
          className={`icon-bar-item ${tab === "check" ? "active" : ""}`}
          onClick={() => setTab("check")}
          aria-label="Check for AI"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 15h7" strokeLinecap="round" />
            <path d="M4 18.5h4.5" strokeLinecap="round" />
            <circle cx="15" cy="10" r="4.3" />
            <line x1="18" y1="13" x2="20.5" y2="15.5" strokeLinecap="round" />
          </svg>
          <span>AI Check</span>
        </button>

        <button
          className={`icon-bar-item ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
          aria-label="History"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>History</span>
        </button>

        <a
          className="icon-bar-item"
          href={`${API_BASE_URL}/support`}
          target="_blank"
          rel="noreferrer"
          aria-label="Contact us"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
            <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Contact</span>
        </a>

        <button
          className={`icon-bar-item ${tab === "settings" ? "active" : ""}`}
          onClick={() => setTab("settings")}
          aria-label="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h10M17 7h3M4 12h3M9 12h11M4 17h13M20 17h0" strokeLinecap="round" />
            <circle cx="12" cy="7" r="1.8" fill="currentColor" stroke="none" />
            <circle cx="6" cy="12" r="1.8" fill="currentColor" stroke="none" />
            <circle cx="16" cy="17" r="1.8" fill="currentColor" stroke="none" />
          </svg>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
