import { useEffect, useState } from "react";
import { getAuthToken, onAuthSessionChanged } from "../../lib/storage";
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
    function refresh() {
      getAuthToken().then(async (token) => {
        setSignedIn(Boolean(token));
        setMe(token ? await getMe() : null);
      });
    }

    // Once on mount, and again any time the stored session is set or
    // cleared afterward — the side panel is long-lived, unlike the old
    // popup's always-fresh mount, so a session that changes while it's
    // already open (a background refresh, or one racing refresh losing to
    // another and getting cleared — see lib/api.ts) needs to update the
    // displayed credits live instead of leaving them stale.
    refresh();
    return onAuthSessionChanged(refresh);
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
