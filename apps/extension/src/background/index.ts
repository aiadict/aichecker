// MV3 service worker. Owns the right-click context menu and relays network
// calls on behalf of the content script's on-page result panel — a content
// script's own fetch/XHR is subject to the host page's CSP, while this
// service worker isn't, so createCheck/shareCheck run here instead.

import { setAuthSession } from "../lib/storage";
import { createCheck, shareCheck } from "../lib/api";

const CONTEXT_MENU_ID = "ai-checker-check-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Check for AI Content",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText || !tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, {
    type: "ai-checker/check-selection",
    text: info.selectionText,
    sourceUrl: tab.url ?? "",
  });
});

// Messages from the content script (see src/content/index.tsx): a check or
// share request from the on-page panel, or a session handoff after signing
// in on the /login page.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ai-checker/run-check") {
    createCheck({ text: message.text, sourceUrl: message.sourceUrl }).then(sendResponse);
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "ai-checker/share-check") {
    shareCheck(message.checkId).then(sendResponse);
    return true;
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
