import { useEffect, useState } from "react";
import Header from "./components/Header";
import PinNudge from "./components/PinNudge";
import CheckForAiTab from "./tabs/CheckForAiTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";
import { consumePendingSelection } from "../lib/storage";

type TabKey = "check" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<TabKey>("check");
  const [prefillText, setPrefillText] = useState("");

  useEffect(() => {
    // Set by the floating icon's click handler (content/index.tsx) via the
    // background worker — consumed once so it doesn't reappear on the next
    // popup open.
    consumePendingSelection().then((pending) => {
      if (pending?.text) {
        setPrefillText(pending.text);
        setTab("check");
      }
    });
  }, []);

  return (
    <div>
      <Header />
      <PinNudge />
      <div className="tabpanel">
        {tab === "check" && <CheckForAiTab prefillText={prefillText} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
      <nav className="tabs">
        <button className={tab === "check" ? "active" : ""} onClick={() => setTab("check")}>
          Check for AI
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          History
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
      </nav>
    </div>
  );
}
