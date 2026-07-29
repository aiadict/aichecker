// Content script: shows a small floating "AI Checker" icon near a text
// selection anywhere on the web. Clicking it opens the extension popup with
// the selection pre-filled. This is a convenience layer on top of the
// always-available right-click "Check for AI Content" menu and manual
// paste — see docs/product-spec.md §6 for why this doesn't use
// chrome.action.openPopup() directly from here (unreliable from content
// script context; the background service worker does it instead).

import { getSettings } from "../lib/storage";

const MIN_SELECTION_LENGTH = 20;
const HOST_ID = "ai-checker-floating-icon-host";

let hostEl: HTMLDivElement | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

function ensureHost(): { host: HTMLDivElement; button: HTMLButtonElement } {
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = HOST_ID;
    hostEl.style.position = "absolute";
    hostEl.style.zIndex = "2147483647";
    hostEl.style.display = "none";
    document.documentElement.appendChild(hostEl);

    const shadow = hostEl.attachShadow({ mode: "open" });
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
        background: #ea580c;
        color: white;
        font: 700 13px/1 system-ui, sans-serif;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }
      button:hover { background: #c2410c; }
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "AI";
    button.setAttribute("aria-label", "Check selection for AI Checker");
    shadow.appendChild(style);
    shadow.appendChild(button);
  }
  const button = hostEl.shadowRoot!.querySelector("button")!;
  return { host: hostEl, button };
}

function hideIcon() {
  if (hostEl) hostEl.style.display = "none";
}

function showIconNearSelection(rect: DOMRect, text: string) {
  const { host, button } = ensureHost();
  host.style.top = `${window.scrollY + rect.bottom + 6}px`;
  host.style.left = `${window.scrollX + rect.left}px`;
  host.style.display = "block";

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "ai-checker/open-popup-with-selection",
      text,
      sourceUrl: window.location.href,
    });
    hideIcon();
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

  if (hideTimeout) clearTimeout(hideTimeout);

  if (!selection || selection.isCollapsed || text.length < MIN_SELECTION_LENGTH) {
    // Small delay avoids flicker when the user is mid-drag-select.
    hideTimeout = setTimeout(hideIcon, 150);
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
  if (hostEl && !hostEl.contains(e.target as Node)) hideIcon();
});
