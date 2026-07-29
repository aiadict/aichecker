import { useEffect, useState } from "react";
import { getAuthToken } from "../../lib/storage";

// TODO: replace the static 10/10 with a real GET /api/me call against
// apps/web once auth is wired end to end (see docs/architecture.md).
export default function Header() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    getAuthToken().then((token) => setSignedIn(Boolean(token)));
  }, []);

  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden="true" />
        AI Checker
      </div>
      <div className="credits">
        {signedIn ? (
          <>
            Credits <strong>10/10</strong>
          </>
        ) : (
          <span className="muted">Not signed in</span>
        )}
      </div>
    </header>
  );
}
