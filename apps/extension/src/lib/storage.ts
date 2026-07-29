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
  authToken: "authToken",
  settings: "settings",
  pendingSelection: "pendingSelection",
} as const;

export async function getAuthToken(): Promise<string | null> {
  const { [KEYS.authToken]: token } = await chrome.storage.local.get(KEYS.authToken);
  return (token as string | undefined) ?? null;
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (token) {
    await chrome.storage.local.set({ [KEYS.authToken]: token });
  } else {
    await chrome.storage.local.remove(KEYS.authToken);
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

/** Set by the content script's floating icon / context menu; read once by the popup on open. */
export async function setPendingSelection(text: string, sourceUrl: string): Promise<void> {
  await chrome.storage.session.set({ [KEYS.pendingSelection]: { text, sourceUrl } });
}

export async function consumePendingSelection(): Promise<{ text: string; sourceUrl: string } | null> {
  const { [KEYS.pendingSelection]: pending } = await chrome.storage.session.get(
    KEYS.pendingSelection
  );
  if (pending) {
    await chrome.storage.session.remove(KEYS.pendingSelection);
  }
  return (pending as { text: string; sourceUrl: string } | undefined) ?? null;
}
