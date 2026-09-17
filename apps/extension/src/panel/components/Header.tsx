import { useAccountStatus } from "../../lib/useAccountStatus";
import { API_BASE_URL } from "../../lib/config";

// No logo/name in the side panel case — Chrome's own side panel header
// already shows the extension's icon and name (pulled from the manifest),
// plus native pin and close controls, so building our own copies there
// would be redundant. The *standalone* case (opened via "Open web
// checker" into a full, ordinary browser tab - see PanelSectionHeader.tsx)
// has no such native chrome, just this page in a plain tab - without a
// brand mark there, there's nothing on screen telling the user what this
// tab even is.
export default function Header({ standalone }: { standalone: boolean }) {
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
        {standalone && (
          // Same mark as apps/web/public/logo.svg / manifest icons -
          // inlined rather than an asset path, so it can't ever 404 and
          // stays crisp at this small a size regardless of pixel density.
          <span className="standalone-brand">
            <svg className="standalone-brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#3d6fe0" />
              <rect x="6.5" y="19.4" width="14" height="2.4" rx="1.2" fill="#fff" />
              <rect x="6.5" y="24.4" width="9" height="2.4" rx="1.2" fill="#fff" opacity="0.75" />
              <circle cx="19.5" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="1.8" />
              <line x1="23.7" y1="16.2" x2="27" y2="19.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            AI Checker
          </span>
        )}
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
