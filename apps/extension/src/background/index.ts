// MV3 service worker. Owns the right-click context menu and relays network
// calls on behalf of the content script's on-page result panel — a content
// script's own fetch/XHR is subject to the host page's CSP, while this
// service worker isn't, so createCheck/shareCheck run here instead.

import { setAuthSession, setPendingSelection } from "../lib/storage";
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
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "ai-checker/check-selection",
      text: info.selectionText,
      sourceUrl: tab.url ?? "",
    });
  } catch (err) {
    // Most commonly: this tab was already open before the extension was
    // last (re)loaded, so it's still running the old content script, which
    // lost its connection to this new extension instance — Chrome doesn't
    // re-inject content scripts into already-open tabs on an unpacked
    // reload, only on fresh navigation. Was previously unhandled, so this
    // failed with zero visible feedback. Refreshing the tab re-injects the
    // current content script and fixes it; logged here so that's
    // diagnosable from the service worker console instead of a silent no-op.
    console.error("Couldn't reach the content script in this tab — try refreshing the page.", err);
  }
});

// Messages from the content script (see src/content/index.tsx): a check or
// share request from the on-page panel, the floating icon asking to open
// the popup with the selection prefilled instead, or a session handoff
// after signing in on the /login page.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ai-checker/run-check") {
    createCheck({ text: message.text, sourceUrl: message.sourceUrl }).then(sendResponse);
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "ai-checker/open-popup-with-selection") {
    (async () => {
      // Deliberately shows the real "paste text, click Check for AI" flow
      // instead of running the check silently — the floating icon used to
      // do that (see the on-page panel other flows use), but showing
      // nothing until a result popped into History felt opaque. The
      // right-click context menu is unchanged; only this one entry point
      // now opens the popup.
      await setPendingSelection(message.text, message.sourceUrl);
      await chrome.action.openPopup();
      sendResponse({ ok: true });
    })();
    return true;
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
