// Same-document pub/sub for state that changes outside the component that
// displays it. Unlike storage.ts's onAuthSessionChanged/onPendingSelectionSet
// (which cross the background <-> panel boundary and need chrome.storage),
// Header and CheckForAiTab are both mounted in the same panel document, so a
// plain window event is enough — no storage write/round-trip needed.

const CREDITS_CHANGED = "ai-checker:credits-changed";

/** Call after any action that spends credits (a check), so Header's count stays live. */
export function notifyCreditsChanged(): void {
  window.dispatchEvent(new Event(CREDITS_CHANGED));
}

export function onCreditsChanged(callback: () => void): () => void {
  window.addEventListener(CREDITS_CHANGED, callback);
  return () => window.removeEventListener(CREDITS_CHANGED, callback);
}
