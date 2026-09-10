// MV3 service worker. Owns the right-click context menu, opens the side
// panel on the extension's behalf (content scripts can't call
// chrome.sidePanel.open() directly), and handles the auth session handoff
// from the /login page.

import { setAuthSession, setPendingSelection, getOrCreateDeviceId } from "../lib/storage";
import { API_BASE_URL } from "../lib/config";

const CONTEXT_MENU_ID = "ai-checker-check-selection";

// chrome.runtime.setUninstallURL opens this in a new background tab the
// moment the user removes the extension - see apps/web/src/app/uninstall's
// doc comment. Its target is a static string Chrome caps at 255 chars, set
// in advance rather than computed at the actual moment of uninstall (there
// is no "about to uninstall" event to hook), so this just re-sets it with
// whatever's known right now every time the service worker wakes up -
// cheap, idempotent, and keeps it current if the device id wasn't created
// yet the first time this ran. device_id is a random per-install id (see
// getOrCreateDeviceId), not anything tied to a signed-in account - by the
// time this page loads the extension itself is already gone.
getOrCreateDeviceId().then((deviceId) => {
  chrome.runtime.setUninstallURL(`${API_BASE_URL}/uninstall?device_id=${encodeURIComponent(deviceId)}`);
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Check for AI Content",
    contexts: ["selection"],
  });

  // Makes clicking the toolbar icon open the side panel directly — only
  // takes effect because the manifest has no action.default_popup; a
  // popup, if set, would silently win over this behavior.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

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
 * below) land here: open the side panel and stash the selection for it to
 * pick up, rather than running the check silently — shows the real "paste
 * text, click Check for AI" flow instead of a result just appearing in
 * History with no visible step in between.
 *
 * chrome.sidePanel.open() needs a very fresh user gesture — confirmed live
 * that even the right-click path (which, unlike the floating icon, has no
 * cross-context message hop at all) failed to open the panel while
 * setPendingSelection's storage write was awaited first. open() now goes
 * first, as the very next thing after the gesture, before anything else
 * has a chance to spend it.
 */
async function openSidePanelWithSelection(text: string, sourceUrl: string, windowId: number | undefined) {
  if (windowId === undefined) return;
  try {
    await chrome.sidePanel.open({ windowId });
  } catch (err) {
    console.error("chrome.sidePanel.open() failed", err);
    return;
  }
  await setPendingSelection(text, sourceUrl, windowId);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;
  await openSidePanelWithSelection(info.selectionText, info.pageUrl ?? "", tab?.windowId);
});

// Messages from the content script (see src/content/index.tsx): the
// floating icon asking to open the side panel with its selection, or a
// session handoff after signing in on the /login page.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ai-checker/open-panel-with-selection") {
    openSidePanelWithSelection(message.text, message.sourceUrl, sender.tab?.windowId).then(() =>
      sendResponse({ ok: true })
    );
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
