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
        <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#3d6fe0" />
          <rect x="6.5" y="19.4" width="14" height="2.4" rx="1.2" fill="#fff" />
          <rect x="6.5" y="24.4" width="9" height="2.4" rx="1.2" fill="#fff" opacity="0.75" />
          <circle cx="19.5" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="1.8" />
          <line x1="23.7" y1="16.2" x2="27" y2="19.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
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
