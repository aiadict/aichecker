// Content script: shows a small floating "AI Checker" icon near a text
// selection anywhere on the web. Clicking it (or the right-click "Check
// for AI Content" menu, handled entirely in the background worker) opens
// the side panel with the selection prefilled — the real "paste text,
// click Check for AI" flow, not an automatic check. See docs/architecture.md.

import { getSettings } from "../lib/storage";
import { API_BASE_URL } from "../lib/config";

const MIN_SELECTION_LENGTH = 20;
const ICON_HOST_ID = "ai-checker-floating-icon-host";

// --- Floating selection icon ------------------------------------------

let iconHostEl: HTMLDivElement | null = null;
let hideIconTimeout: ReturnType<typeof setTimeout> | null = null;

function ensureIconHost(): { host: HTMLDivElement; button: HTMLButtonElement } {
  if (!iconHostEl) {
    iconHostEl = document.createElement("div");
    iconHostEl.id = ICON_HOST_ID;
    iconHostEl.style.position = "absolute";
    iconHostEl.style.zIndex = "2147483647";
    iconHostEl.style.display = "none";
    document.documentElement.appendChild(iconHostEl);

    const shadow = iconHostEl.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #3d6fe0;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }
      button:hover { background: #2c56c4; }
      button svg { width: 20px; height: 20px; display: block; }
    `;
    const button = document.createElement("button");
    button.type = "button";
    // Same glyph as the toolbar/panel mark, minus its own background rect —
    // this button's circular background already does that job.
    button.innerHTML = `
      <svg viewBox="0 0 32 32">
        <rect x="6.5" y="19.4" width="14" height="2.4" rx="1.2" fill="#fff"/>
        <rect x="6.5" y="24.4" width="9" height="2.4" rx="1.2" fill="#fff" opacity="0.75"/>
        <circle cx="19.5" cy="12" r="6" fill="none" stroke="#fff" stroke-width="1.8"/>
        <line x1="23.7" y1="16.2" x2="27" y2="19.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    button.setAttribute("aria-label", "Check selection for AI Checker");
    shadow.appendChild(style);
    shadow.appendChild(button);
  }
  const button = iconHostEl.shadowRoot!.querySelector("button")!;
  return { host: iconHostEl, button };
}

function hideIcon() {
  if (iconHostEl) iconHostEl.style.display = "none";
}

function showIconNearSelection(rect: DOMRect, text: string) {
  const { host, button } = ensureIconHost();

  // Re-claim the last position in the DOM on every show, not just once at
  // creation. Other extensions doing the same "append to documentElement
  // with the max z-index" thing we do (e.g. Copyleaks, confirmed live) can
  // end up after us in DOM order, and for two elements at the same
  // z-index in the same stacking context, the browser's native hit-testing
  // routes clicks to whichever is later in the DOM — our icon stayed
  // visible but silently unclickable, since that's decided before any of
  // our JS runs. Moving ourselves last right before showing means we're
  // the one re-asserting that position on every selection, rather than
  // whatever the injection order happened to be at page load.
  document.documentElement.appendChild(host);

  host.style.top = `${window.scrollY + rect.bottom + 6}px`;
  host.style.left = `${window.scrollX + rect.left}px`;
  host.style.display = "block";

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideIcon();
    chrome.runtime.sendMessage({
      type: "ai-checker/open-panel-with-selection",
      text,
      sourceUrl: window.location.href,
    });
  };
}

async function handleSelectionChange() {
  const settings = await getSettings();
  if (!settings.showFloatingIcon) {
    hideIcon();
    return;
  }

  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";

  if (hideIconTimeout) clearTimeout(hideIconTimeout);

  if (!selection || selection.isCollapsed || text.length < MIN_SELECTION_LENGTH) {
    // Small delay avoids flicker when the user is mid-drag-select.
    hideIconTimeout = setTimeout(hideIcon, 150);
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  showIconNearSelection(rect, text);
}

document.addEventListener("selectionchange", () => {
  handleSelectionChange().catch(() => hideIcon());
});
document.addEventListener("mousedown", (e) => {
  if (iconHostEl && !iconHostEl.contains(e.target as Node)) hideIcon();
});

// Auth handoff: only relevant on our own web app's origin, where /login
// posts the Supabase session to this same window after a successful
// sign-in (see apps/web/src/app/login/page.tsx). A content script can't
// read the page's localStorage directly (separate JS "isolated world"),
// but it does share the DOM/window, so window.postMessage crosses that
// boundary — postMessage isn't subject to CORS, only the origin check below.
if (window.location.origin === API_BASE_URL) {
  window.addEventListener("message", (event) => {
    if (event.origin !== API_BASE_URL) return;
    if (event.data?.type !== "ai-checker/auth-success") return;

    chrome.runtime.sendMessage({
      type: "ai-checker/store-auth-session",
      accessToken: event.data.accessToken,
      refreshToken: event.data.refreshToken,
    });
  });
}
