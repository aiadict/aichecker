import { useEffect, useState } from "react";
import {
  getSettings,
  setSettings,
  getAuthToken,
  setAuthSession,
  onAuthSessionChanged,
  type ExtensionSettings,
} from "../../lib/storage";
import { API_BASE_URL } from "../../lib/config";

export default function SettingsTab() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // Read live from the installed manifest rather than a hardcoded string —
  // the old "v0.1.0" literal here had already drifted from package.json's
  // real version (1.0.0) with no way to notice short of manually checking.
  const version = chrome.runtime.getManifest().version;

  useEffect(() => {
    getSettings().then(setSettingsState);

    // Once on mount, and again any time the stored session is set or
    // cleared afterward — mirrors Header.tsx's pattern. Without this,
    // signing in elsewhere (e.g. the /login?source=extension tab) only
    // updated Header's credits row live; this tab kept showing "Sign in"
    // until the user switched away and back, remounting it.
    function refreshAuth() {
      getAuthToken().then((t) => setSignedIn(Boolean(t)));
    }
    refreshAuth();
    return onAuthSessionChanged(refreshAuth);
  }, []);

  async function toggleFloatingIcon() {
    if (!settings) return;
    const next = { ...settings, showFloatingIcon: !settings.showFloatingIcon };
    setSettingsState(next);
    await setSettings(next);
  }

  async function handleLogout() {
    await setAuthSession(null);
    setSignedIn(false);
  }

  if (!settings) return null;

  return (
    <div>
      <div className="settings-row">
        <div>
          <div>Account</div>
          <div className="muted">{signedIn ? "Signed in" : "Not signed in"}</div>
        </div>
        {/* Signed-out state deliberately has no button here — Header's own
            Sign-in pill is already visible directly above, on every tab
            including this one, so a second one was pure redundancy. */}
        {signedIn && (
          <button className="primary-button" style={{ width: "auto", margin: 0 }} onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
      {!signedIn && (
        // Sets expectations up front rather than leaving a silent dead end:
        // email confirmation only signs the user in on werida.io itself
        // (see apps/web/src/app/extension-connected/page.tsx's doc comment
        // for why that handoff can't be made fully automatic) — this is
        // the recovery path, reusing the Sign-in pill above rather than a
        // second button, since it's the exact same destination.
        <p style={{ fontSize: 12.5, marginTop: -8, marginBottom: 16, color: "var(--brand)", fontWeight: 600 }}>
          Just signed up? Confirm your email, then tap Sign in above — the same email and password
          you just used.
        </p>
      )}

      <div className="settings-row">
        <div>
          <div>Show Floating Icon</div>
          <div className="muted">Appears near selected text on any page</div>
        </div>
        <input type="checkbox" checked={settings.showFloatingIcon} onChange={toggleFloatingIcon} />
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        <a href={`${API_BASE_URL}`} target="_blank" rel="noreferrer">
          Go to werida.io
        </a>
      </p>
      <p className="muted">v{version}</p>
    </div>
  );
}
