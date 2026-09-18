import { useEffect, useState } from "react";
import { listRecentChecks } from "../../lib/api";
import { getAuthToken, onAuthSessionChanged } from "../../lib/storage";
import type { CheckResult } from "@ai-checker/shared-types";
import { API_BASE_URL } from "../../lib/config";

export default function HistoryTab() {
  const [items, setItems] = useState<CheckResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Anonymous checks are never persisted (docs/architecture.md - there's
    // no account for them to belong to), so a signed-out user's history is
    // ALWAYS empty, not just "possibly empty like anyone else's." The old
    // copy ("No checks yet, run one...") was misleading here - it implies
    // the fix is running a check, when the actual blocker is not being
    // signed in at all, no matter how many checks they've run.
    function refreshSignedIn() {
      getAuthToken().then((token) => setSignedIn(Boolean(token)));
    }
    refreshSignedIn();
    const unsubscribe = onAuthSessionChanged(refreshSignedIn);

    listRecentChecks(5).then((results) => {
      setItems(results);
      setLoaded(true);
    });

    return unsubscribe;
  }, []);

  if (loaded && !signedIn) {
    return (
      <p className="muted">
        Sign in to see your check history.{" "}
        <a href={`${API_BASE_URL}/login?source=extension`} target="_blank" rel="noreferrer">
          Sign in
        </a>
      </p>
    );
  }

  if (loaded && items.length === 0) {
    return <p className="muted">No checks yet. Run one from the &quot;Check for AI&quot; tab.</p>;
  }

  return (
    <div>
      {items.map((item) => (
        <div
          className="history-item"
          key={item.id}
          onClick={() => window.open(`${API_BASE_URL}/history/${item.shareSlug}`, "_blank", "noopener")}
        >
          <span>{item.fullText.slice(0, 40)}…</span>
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
