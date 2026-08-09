import { useEffect, useState } from "react";
import { getAuthToken, onAuthSessionChanged } from "../../lib/storage";
import { onCreditsChanged } from "../../lib/events";
import { getMe, getTrialStatus } from "../../lib/api";
import { API_BASE_URL } from "../../lib/config";
import type { MeResponse, TrialStatusResponse } from "@ai-checker/shared-types";

// No logo/name here — Chrome's own side panel header already shows the
// extension's icon and name (pulled from the manifest), plus native pin
// and close controls. Building our own copies would be redundant, and for
// the pin specifically, non-functional (no API lets an extension pin
// itself). This is just the credits readout.
export default function Header() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [trial, setTrial] = useState<TrialStatusResponse | null>(null);

  useEffect(() => {
    function refresh() {
      getAuthToken().then(async (token) => {
        setSignedIn(Boolean(token));
        if (token) {
          setMe(await getMe());
        } else {
          setMe(null);
          setTrial(await getTrialStatus());
        }
      });
    }

    // Once on mount, and again any time the stored session is set or
    // cleared afterward — the side panel is long-lived, unlike the old
    // popup's always-fresh mount, so a session that changes while it's
    // already open (a background refresh, or one racing refresh losing to
    // another and getting cleared — see lib/api.ts) needs to update the
    // displayed credits live instead of leaving them stale. Also refresh
    // right after a check spends credits (see lib/events.ts) — otherwise
    // this count only ever updated on the next full panel mount, so a user
    // running several checks in one session watched a stale number the
    // whole time. Covers both the signed-in credits row and the signed-out
    // trial count, since CheckForAiTab fires the same event either way.
    refresh();
    const unsubAuth = onAuthSessionChanged(refresh);
    const unsubCredits = onCreditsChanged(refresh);
    return () => {
      unsubAuth();
      unsubCredits();
    };
  }, []);

  const dailyRemaining =
    me?.plan.dailyCap != null ? Math.max(me.plan.dailyCap - me.checksToday, 0) : null;

  // Only for Free-plan users who've actually hit a wall — out of monthly
  // credits, or out of today's checks — not shown proactively while
  // there's still room left, and not shown to Pro/Business users who
  // already pay. Both Pro and Business have no daily_cap at all (see
  // supabase/seed.sql), so upgrading genuinely clears either wall.
  const outOfCredits =
    signedIn &&
    me?.plan.key === "free" &&
    (me.creditsRemaining <= 0 || (me.plan.dailyCap != null && me.checksToday >= me.plan.dailyCap));

  return (
    <div className="credits-row">
      <span className="credits-row-left">
        {outOfCredits && (
          <a className="upgrade-pill" href={`${API_BASE_URL}/pricing`} target="_blank" rel="noreferrer">
            Change to Premium
          </a>
        )}
      </span>
      <span className="credits-row-right">
        {signedIn && me ? (
          <>
            Credits{" "}
            <strong>
              {me.creditsRemaining}/{me.plan.monthlyCredits}
            </strong>
            {dailyRemaining != null && (
              <>
                {" "}
                · <strong>{dailyRemaining}</strong> left today
              </>
            )}
          </>
        ) : signedIn ? (
          <span className="muted">Loading…</span>
        ) : (
          <>
            {trial && trial.trialCreditsRemaining > 0 && (
              <>
                <strong>{trial.trialCreditsRemaining}</strong> trial{" "}
                {trial.trialCreditsRemaining === 1 ? "credit" : "credits"} left ·{" "}
              </>
            )}
            <a
              className="signin-pill"
              href={`${API_BASE_URL}/login?source=extension`}
              target="_blank"
              rel="noreferrer"
            >
              Sign in
            </a>
          </>
        )}
      </span>
    </div>
  );
}
