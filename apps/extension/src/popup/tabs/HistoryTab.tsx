import { useEffect, useState } from "react";
import { listRecentChecks } from "../../lib/api";
import type { CheckResult } from "@ai-checker/shared-types";
import { API_BASE_URL } from "../../lib/config";

export default function HistoryTab() {
  const [items, setItems] = useState<CheckResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listRecentChecks(5).then((results) => {
      setItems(results);
      setLoaded(true);
    });
  }, []);

  if (loaded && items.length === 0) {
    return <p className="muted">No checks yet. Run one from the "Check for AI" tab.</p>;
  }

  return (
    <div>
      {items.map((item) => (
        <div className="history-item" key={item.id}>
          <span>{item.textSnippet.slice(0, 40)}…</span>
          <span className={`badge ${item.predictionShort}`}>{item.predictionShort}</span>
        </div>
      ))}
      <a
        className="primary-button"
        style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "24px" }}
        href={`${API_BASE_URL}/dashboard/history`}
        target="_blank"
        rel="noreferrer"
      >
        View All Checks
      </a>
    </div>
  );
}
