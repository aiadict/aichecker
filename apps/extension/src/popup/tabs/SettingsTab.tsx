import { useEffect, useState } from "react";
import { getSettings, setSettings, getAuthToken, setAuthToken, type ExtensionSettings } from "../../lib/storage";
import { API_BASE_URL } from "../../lib/config";

export default function SettingsTab() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    getSettings().then(setSettingsState);
    getAuthToken().then((t) => setSignedIn(Boolean(t)));
  }, []);

  async function toggleFloatingIcon() {
    if (!settings) return;
    const next = { ...settings, showFloatingIcon: !settings.showFloatingIcon };
    setSettingsState(next);
    await setSettings(next);
  }

  async function handleLogout() {
    await setAuthToken(null);
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
        {signedIn ? (
          <button className="primary-button" style={{ width: "auto", margin: 0 }} onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <a
            className="primary-button"
            style={{ width: "auto", margin: 0, textDecoration: "none", display: "inline-block", lineHeight: "24px" }}
            href={`${API_BASE_URL}/login?source=extension`}
            target="_blank"
            rel="noreferrer"
          >
            Sign in
          </a>
        )}
      </div>

      <div className="settings-row">
        <div>
          <div>Show Floating Icon</div>
          <div className="muted">Appears near selected text on any page</div>
        </div>
        <input type="checkbox" checked={settings.showFloatingIcon} onChange={toggleFloatingIcon} />
      </div>

      <div className="settings-row">
        <div>Google Doc Widget</div>
        <span className="muted">Coming soon (Phase 2)</span>
      </div>
      <div className="settings-row">
        <div>Automatically Scan My Feed</div>
        <span className="muted">Coming soon (Phase 2)</span>
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        <a href={`${API_BASE_URL}`} target="_blank" rel="noreferrer">
          Go to werida.io
        </a>
      </p>
      <p className="muted">v0.1.0 (mocked — no Pangram API key configured)</p>
    </div>
  );
}
