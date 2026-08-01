import { useState } from "react";
import Header from "./components/Header";
import CheckForAiTab from "./tabs/CheckForAiTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";

type TabKey = "check" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<TabKey>("check");

  return (
    <div>
      <Header />
      <div className="tabpanel">
        {tab === "check" && <CheckForAiTab prefillText="" />}
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
