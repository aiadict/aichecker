// MV3 service worker. Owns the right-click context menu and the auth
// session handoff from the /login page.

import { setAuthSession, setPendingSelection } from "../lib/storage";
import { API_BASE_URL } from "../lib/config";

const CONTEXT_MENU_ID = "ai-checker-check-selection";

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Check for AI Content",
    contexts: ["selection"],
  });

  // Only on a genuine first install. Chrome reports "update" for a version
  // bump or a plain reload of an already-loaded unpacked extension
  // (chrome://extensions' refresh icon) — "install" only fires again if the
  // extension is fully removed and re-loaded, which is the same situation a
  // real user re-installing from the Web Store would be in.
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${API_BASE_URL}/welcome` });
  }
});

/**
 * Both the right-click menu and the floating icon (via the message handler
 * below) land here: stash the selection and open the popup with it
 * prefilled, rather than running the check silently — shows the real
 * "paste text, click Check for AI" flow instead of a result just appearing
 * in History with no visible step in between. Called directly inside a
 * user-gesture-triggered event (the menu click), which Chrome allows for
 * chrome.action.openPopup() since M99.
 */
async function openPopupWithSelection(text: string, sourceUrl: string) {
  await setPendingSelection(text, sourceUrl);
  await chrome.action.openPopup();
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;
  await openPopupWithSelection(info.selectionText, info.pageUrl ?? "");
});

// Messages from the content script (see src/content/index.tsx): the
// floating icon asking to open the popup with its selection, or a session
// handoff after signing in on the /login page.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ai-checker/open-popup-with-selection") {
    openPopupWithSelection(message.text, message.sourceUrl).then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "ai-checker/store-auth-session") {
    (async () => {
      await setAuthSession({
        accessToken: message.accessToken,
        refreshToken: message.refreshToken,
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});
