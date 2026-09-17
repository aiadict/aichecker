import { useAccountStatus } from "../../lib/useAccountStatus";
import { API_BASE_URL } from "../../lib/config";

// No logo/name here — Chrome's own side panel header already shows the
// extension's icon and name (pulled from the manifest), plus native pin
// and close controls. Building our own copies would be redundant, and for
// the pin specifically, non-functional (no API lets an extension pin
// itself). This is just the credits readout.
export default function Header() {
  const { signedIn, me, trial } = useAccountStatus();

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
            Upgrade to Premium
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
