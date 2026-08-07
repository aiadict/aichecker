import { useEffect, useState } from "react";
import Header from "./components/Header";
import CheckForAiTab from "./tabs/CheckForAiTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";
import { consumePendingSelection } from "../lib/storage";
import { API_BASE_URL } from "../lib/config";

type TabKey = "check" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<TabKey>("check");
  const [prefillText, setPrefillText] = useState("");

  useEffect(() => {
    // Set by background/index.ts's openSidePanelWithSelection() — both the
    // floating icon and the right-click menu land there — consumed once so
    // it doesn't reappear next time the panel opens.
    consumePendingSelection().then((pending) => {
      if (pending?.text) {
        setPrefillText(pending.text);
        setTab("check");
      }
    });
  }, []);

  return (
    <div className="panel-root">
      <Header />
      <div className="tabpanel">
        {tab === "check" && <CheckForAiTab prefillText={prefillText} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
      <nav className="icon-bar">
        <button
          className={`icon-bar-item ${tab === "check" ? "active" : ""}`}
          onClick={() => setTab("check")}
          aria-label="Check for AI"
        >
          <svg viewBox="0 0 32 32" fill="none">
            <rect x="6.5" y="19.4" width="14" height="2.4" rx="1.2" fill="currentColor" />
            <rect x="6.5" y="24.4" width="9" height="2.4" rx="1.2" fill="currentColor" opacity="0.6" />
            <circle cx="19.5" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="23.7" y1="16.2" x2="27" y2="19.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span>Check</span>
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
