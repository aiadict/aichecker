import { useEffect, useState } from "react";
import Header from "./components/Header";
import CheckForAiTab from "./tabs/CheckForAiTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";
import { consumePendingSelection } from "../lib/storage";

type TabKey = "check" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<TabKey>("check");
  const [prefillText, setPrefillText] = useState<string>("");

  useEffect(() => {
    // If the popup was opened via the floating icon or right-click menu,
    // a pending selection is waiting in session storage — consume it once.
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
