// Thin wrapper around chrome.storage so the rest of the extension doesn't
// touch the raw callback/promise API directly.

export interface ExtensionSettings {
  badgeMode: "default" | "silent";
  showFloatingIcon: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  badgeMode: "default",
  showFloatingIcon: true,
};

const KEYS = {
  authSession: "authSession",
  settings: "settings",
  pinNudgeDismissed: "pinNudgeDismissed",
  pendingSelection: "pendingSelection",
} as const;

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

/** The Supabase access token, used as the Bearer token against apps/web's API. */
export async function getAuthToken(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.accessToken ?? null;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const { [KEYS.authSession]: session } = await chrome.storage.local.get(KEYS.authSession);
  return (session as AuthSession | undefined) ?? null;
}

/** Stored by the background worker after the /login page hands off a session — see src/content/index.ts. */
export async function setAuthSession(session: AuthSession | null): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ [KEYS.authSession]: session });
  } else {
    await chrome.storage.local.remove(KEYS.authSession);
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const { [KEYS.settings]: settings } = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<ExtensionSettings> | undefined) };
}

export async function setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEYS.settings]: { ...current, ...settings } });
}

/** User explicitly closed the "pin the extension" nudge — don't show it again. */
export async function getPinNudgeDismissed(): Promise<boolean> {
  const { [KEYS.pinNudgeDismissed]: dismissed } = await chrome.storage.local.get(KEYS.pinNudgeDismissed);
  return Boolean(dismissed);
}

export async function setPinNudgeDismissed(): Promise<void> {
  await chrome.storage.local.set({ [KEYS.pinNudgeDismissed]: true });
}

/**
 * Set by the floating icon's click handler (see content/index.tsx), read
 * once by the popup on open. Only the floating-icon flow uses this — the
 * right-click "Check for AI Content" menu still runs the check itself and
 * shows the on-page panel directly, unchanged.
 */
export async function setPendingSelection(text: string, sourceUrl: string): Promise<void> {
  await chrome.storage.session.set({ [KEYS.pendingSelection]: { text, sourceUrl } });
}

export async function consumePendingSelection(): Promise<{ text: string; sourceUrl: string } | null> {
  const { [KEYS.pendingSelection]: pending } = await chrome.storage.session.get(KEYS.pendingSelection);
  if (pending) {
    await chrome.storage.session.remove(KEYS.pendingSelection);
  }
  return (pending as { text: string; sourceUrl: string } | undefined) ?? null;
}
