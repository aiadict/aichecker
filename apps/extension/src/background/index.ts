// MV3 service worker. Owns the right-click context menu and is the message
// hub between the content script (floating icon) and the popup.

import { setPendingSelection, setAuthSession } from "../lib/storage";

const CONTEXT_MENU_ID = "ai-checker-check-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Check for AI Content",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;
  await setPendingSelection(info.selectionText, tab?.url ?? "");
  // Called directly inside a user-gesture-triggered event (the menu click),
  // which Chrome allows for chrome.action.openPopup() since M99.
  await chrome.action.openPopup();
});

// Messages from the content script (see src/content/index.ts): either the
// floating icon's "check this selection" click, or a session handoff after
// signing in on the /login page.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ai-checker/open-popup-with-selection") {
    (async () => {
      await setPendingSelection(message.text, message.sourceUrl);
      await chrome.action.openPopup();
      sendResponse({ ok: true });
    })();
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
