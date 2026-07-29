import { useEffect, useState } from "react";
import { getAuthToken } from "../../lib/storage";
import { getMe } from "../../lib/api";
import type { MeResponse } from "@ai-checker/shared-types";

export default function Header() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    getAuthToken().then(async (token) => {
      setSignedIn(Boolean(token));
      if (token) setMe(await getMe());
    });
  }, []);

  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden="true" />
        AI Checker
      </div>
      <div className="credits">
        {signedIn && me ? (
          <>
            Credits{" "}
            <strong>
              {me.creditsRemaining}/{me.plan.monthlyCredits}
            </strong>
          </>
        ) : signedIn ? (
          <span className="muted">Loading…</span>
        ) : (
          <span className="muted">Not signed in</span>
        )}
      </div>
    </header>
  );
}
