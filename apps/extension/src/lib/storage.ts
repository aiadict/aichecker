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
  pendingSelection: "pendingSelection",
  deviceId: "deviceId",
  hasRated: "hasRated",
  hasEverSignedIn: "hasEverSignedIn",
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

/**
 * Stored by the background worker after the /login page hands off a
 * session — see src/content/index.ts. Also flips hasEverSignedIn the
 * first time a real session lands, permanently — see
 * getHasEverSignedIn's doc comment for why this needs to be one-way
 * (never reset on logout).
 */
export async function setAuthSession(session: AuthSession | null): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ [KEYS.authSession]: session, [KEYS.hasEverSignedIn]: true });
  } else {
    await chrome.storage.local.remove(KEYS.authSession);
  }
}

/**
 * Whether this install has EVER completed a real sign-in — used to pick
 * the Sign-in pill's destination mode (see Header.tsx). A brand new user
 * clicking "Sign in" with no account yet lands on a sign-in FORM asking
 * for credentials they don't have, which isn't obvious to switch away
 * from (confirmed confusing in practice) — defaulting straight to
 * Sign-up fixes that for genuine first-timers. Deliberately never reset
 * on logout: once we know this device has a real account, a later
 * logged-out state almost always means "log back into that account", not
 * "create a new one" — resetting the flag on logout would wrongly send a
 * returning user back to a sign-up form instead.
 */
export async function getHasEverSignedIn(): Promise<boolean> {
  const { [KEYS.hasEverSignedIn]: value } = await chrome.storage.local.get(KEYS.hasEverSignedIn);
  return value === true;
}

/**
 * Random per-install identifier for the anonymous trial (see
 * lib/api.ts's X-Device-Id header and apps/web's /api/checks +
 * /api/trial). Lives in .local, not .sync, deliberately — it should NOT
 * follow the user's Google account to another machine, since that would
 * make the trial trivially stackable across devices sharing one profile.
 * Generated once and never rotated, so reinstalling the extension (or a
 * second Chrome profile) is the only way to get a fresh one — a known,
 * accepted limitation of a device-scoped trial.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const { [KEYS.deviceId]: existing } = await chrome.storage.local.get(KEYS.deviceId);
  if (typeof existing === "string" && existing) return existing;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [KEYS.deviceId]: id });
  return id;
}

/**
 * Whether the user has ever clicked a star on the "Enjoying AI Checker?"
 * prompt (see panel/components/RateUsPrompt.tsx) — clicking any star
 * (1-5) counts as "rated" and hides the prompt for good, since that
 * click already redirects them to the feedback form or the Chrome Web
 * Store review page; there's nothing more for the prompt itself to do.
 * Lives in .local like everything else here — no reason for it to
 * follow a Google account across machines.
 */
export async function getHasRated(): Promise<boolean> {
  const { [KEYS.hasRated]: value } = await chrome.storage.local.get(KEYS.hasRated);
  return value === true;
}

export async function setHasRated(): Promise<void> {
  await chrome.storage.local.set({ [KEYS.hasRated]: true });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const { [KEYS.settings]: settings } = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<ExtensionSettings> | undefined) };
}

export async function setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEYS.settings]: { ...current, ...settings } });
}

/**
 * Set by background/index.ts's openSidePanelWithSelection() — both the
 * floating icon and the right-click "Check for AI Content" menu land there.
 * Unlike the old popup (which always started from a fresh mount), the side
 * panel is persistent and can already be open when a new selection comes
 * in, so this is read both once on mount AND live via onPendingSelectionSet
 * below (see panel/App.tsx) — a mount-only read would miss any selection
 * made while the panel was already sitting open.
 *
 * Keyed by windowId: chrome.storage.session is extension-global, not
 * per-window. With the extension's side panel open on two screens at once,
 * a single unscoped key meant both panels' onChanged listeners raced to
 * read-then-remove the same entry — both won the read before either's
 * removal landed, so both auto-ran the same check (confirmed live: two
 * side panels, one selection, credits_remaining dropped by 2 instead of
 * 1). Scoping the key to the target window's id means only the side panel
 * actually attached to that window ever sees the change.
 */
function pendingSelectionKey(windowId: number): string {
  return `${KEYS.pendingSelection}:${windowId}`;
}

export async function setPendingSelection(text: string, sourceUrl: string, windowId: number): Promise<void> {
  await chrome.storage.session.set({ [pendingSelectionKey(windowId)]: { text, sourceUrl } });
}

export async function consumePendingSelection(
  windowId: number
): Promise<{ text: string; sourceUrl: string } | null> {
  const key = pendingSelectionKey(windowId);
  const { [key]: pending } = await chrome.storage.session.get(key);
  if (pending) {
    await chrome.storage.session.remove(key);
  }
  return (pending as { text: string; sourceUrl: string } | undefined) ?? null;
}

/**
 * Notifies `callback` whenever a new pending selection is written for this
 * specific window (not on the removal consumePendingSelection does right
 * after reading it — only on an actual new value arriving). Returns an
 * unsubscribe function.
 */
export function onPendingSelectionSet(windowId: number, callback: () => void): () => void {
  const key = pendingSelectionKey(windowId);
  function listener(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
    if (areaName === "session" && changes[key]?.newValue) {
      callback();
    }
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Notifies `callback` whenever the stored auth session is set OR cleared —
 * e.g. by authedFetch's refresh-on-401 logic (lib/api.ts). The side panel
 * is long-lived, unlike the old popup that was always a fresh mount, so a
 * session that goes stale (or gets cleared) while the panel sits open
 * needs to update the UI live rather than leaving it showing whatever was
 * true at mount time. Returns an unsubscribe function.
 */
export function onAuthSessionChanged(callback: () => void): () => void {
  function listener(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
    if (areaName === "local" && KEYS.authSession in changes) {
      callback();
    }
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
