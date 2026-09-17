const STORAGE_KEY = "ai-checker-device-id";

let memoryFallback: string | null = null;

/**
 * Web equivalent of apps/extension/src/lib/storage.ts's chrome.storage.local
 * device id, backing the same anonymous-trial mechanism on /api/checks
 * (X-Device-Id header). chrome.storage is extension-sandboxed and
 * unreachable from a normal page, so this is necessarily a SEPARATE
 * trial-credit pool from the extension's own — a visitor using both ends
 * up with two independent 2-credit trials, not one shared pool. Accepted
 * platform limitation, not solvable without shared device fingerprinting,
 * which is out of scope.
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Private/strict browsing modes can throw on localStorage access —
    // fall back to an id that only lasts this page load rather than
    // breaking the check flow entirely.
    if (!memoryFallback) memoryFallback = crypto.randomUUID();
    return memoryFallback;
  }
}
