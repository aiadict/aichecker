import { useEffect, useState } from "react";
import { getSettings, setSettings, setAuthSession, type ExtensionSettings } from "../../lib/storage";
import { useAccountStatus } from "../../lib/useAccountStatus";
import { API_BASE_URL } from "../../lib/config";

export default function SettingsTab() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);
  const { signedIn, me, trial } = useAccountStatus();
  // Read live from the installed manifest rather than a hardcoded string —
  // the old "v0.1.0" literal here had already drifted from package.json's
  // real version (1.0.0) with no way to notice short of manually checking.
  const version = chrome.runtime.getManifest().version;

  useEffect(() => {
    getSettings().then(setSettingsState);
  }, []);

  async function toggleFloatingIcon() {
    if (!settings) return;
    const next = { ...settings, showFloatingIcon: !settings.showFloatingIcon };
    setSettingsState(next);
    await setSettings(next);
  }

  async function handleLogout() {
    await setAuthSession(null);
  }

  if (!settings) return null;

  // Same data Header shows on every tab (see lib/useAccountStatus.ts) —
  // reused here rather than a second, drift-prone fetch, so this badge and
  // Header's own credits readout can never disagree with each other.
  const creditsBadge =
    signedIn && me
      ? `${me.creditsRemaining}/${me.plan.monthlyCredits} credits`
      : !signedIn && trial && trial.trialCreditsRemaining > 0
      ? `${trial.trialCreditsRemaining} trial ${trial.trialCreditsRemaining === 1 ? "credit" : "credits"} left`
      : null;

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      <div className="settings-card settings-card-account">
        <div className="settings-card-row">
          <div>
            <div className="settings-card-label">Account</div>
            <div className="muted">{signedIn && me ? `Signed in as ${me.email}` : "Not signed in"}</div>
          </div>
          {creditsBadge && <span className="credits-badge">{creditsBadge}</span>}
        </div>

        {signedIn ? (
          <button className="secondary-button" onClick={handleLogout}>
            Sign out
          </button>
        ) : (
          <>
            <a
              className="primary-button settings-signin-button"
              href={`${API_BASE_URL}/login?source=extension`}
              target="_blank"
              rel="noreferrer"
            >
              Sign in
            </a>
            {/* Email confirmation only signs the user in on werida.io itself
                (see apps/web/src/app/extension-connected/page.tsx's doc
                comment for why that handoff can't be made fully automatic)
                — this sets expectations up front instead of a silent dead
                end, pointing back at the button directly above. */}
            <p className="muted settings-signup-hint">
              Just signed up? Confirm your email, then tap Sign in above - the same email and
              password you just used.
            </p>
          </>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card-label" style={{ marginBottom: 14 }}>
          Preferences
        </div>
        <div className="settings-row">
          <div>
            <div>Show floating icon</div>
            <div className="muted">Appears near selected text on any page</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={settings.showFloatingIcon} onChange={toggleFloatingIcon} />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
      </div>

      <div className="settings-footer">
        <a href={API_BASE_URL} target="_blank" rel="noreferrer" className="settings-footer-link">
          Go to werida.io
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <span className="muted">v{version}</span>
      </div>
    </div>
  );
}
