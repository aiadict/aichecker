import { useEffect, useState } from "react";
import { getAuthToken } from "../../lib/storage";
import { getMe } from "../../lib/api";
import type { MeResponse } from "@ai-checker/shared-types";

// No logo/name here — Chrome's own side panel header already shows the
// extension's icon and name (pulled from the manifest), plus native pin
// and close controls. Building our own copies would be redundant, and for
// the pin specifically, non-functional (no API lets an extension pin
// itself). This is just the credits readout.
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
    <div className="credits-row">
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
  );
}
