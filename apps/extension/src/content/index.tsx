// Content script: shows a small floating "AI Checker" icon near a text
// selection anywhere on the web, and — for both that icon and the
// right-click "Check for AI Content" menu — an on-page result panel that
// stays visible after the user clicks elsewhere on the page. This
// replaces the earlier design of opening the native toolbar popup, which
// Chrome auto-closes the instant focus leaves it (the moment you click
// back into the page to do anything with the result). See
// docs/architecture.md for the tradeoffs.
//
// Actual network calls (createCheck, shareCheck) are relayed through the
// background service worker rather than fetched directly here — a content
// script's own fetch/XHR calls are subject to the host page's CSP, while
// the background worker isn't.

import { createRoot, type Root } from "react-dom/client";
import type { CreateCheckResponse, ShareCheckResponse } from "@ai-checker/shared-types";
import ResultPanel, { type PanelPosition, type PanelState } from "./ResultPanel";
import { getSettings } from "../lib/storage";
import { API_BASE_URL } from "../lib/config";

const MIN_SELECTION_LENGTH = 20;
const ICON_HOST_ID = "ai-checker-floating-icon-host";
const PANEL_HOST_ID = "ai-checker-panel-host";

const PANEL_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    position: fixed;
    width: 320px;
    max-height: 480px;
    overflow-y: auto;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #111827;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 700;
  }
  .panel-close {
    all: unset;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    color: #6b7280;
    padding: 2px 6px;
  }
  .panel-close:hover { color: #111827; }
  .panel-body { padding: 12px; }
  .result-card .verdict { font-weight: 700; font-size: 16px; text-transform: capitalize; }
  .result-card .verdict.ai { color: #c2410c; }
  .result-card .verdict.human { color: #15803d; }
  .result-card .verdict.mixed { color: #b45309; }
  .result-card .pct { font-size: 28px; font-weight: 800; margin: 6px 0; }
  .muted { color: #6b7280; font-size: 12px; }
  .breakdown-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0 8px; background: #e5e7eb; }
  .breakdown-bar .seg.ai { background: #c2410c; }
  .breakdown-bar .seg.assisted { background: #b45309; }
  .breakdown-bar .seg.human { background: #15803d; }
  .breakdown-legend { display: flex; gap: 12px; font-size: 12px; color: #6b7280; flex-wrap: wrap; }
  .breakdown-legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 4px; }
  .breakdown-legend .dot.ai { background: #c2410c; }
  .breakdown-legend .dot.assisted { background: #b45309; }
  .breakdown-legend .dot.human { background: #15803d; }
  .link-button { background: none; border: none; padding: 0; color: #ea580c; text-decoration: underline; cursor: pointer; font: inherit; font-size: 12px; }
  .link-button:disabled { color: #6b7280; cursor: default; }
`;

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
  const button = iconHostEl.shadowRoot!.querySelector("button")!;
  return { host: iconHostEl, button };
}

function hideIcon() {
  if (iconHostEl) iconHostEl.style.display = "none";
}

function showIconNearSelection(rect: DOMRect, text: string) {
  const { host, button } = ensureIconHost();
  host.style.top = `${window.scrollY + rect.bottom + 6}px`;
  host.style.left = `${window.scrollX + rect.left}px`;
  host.style.display = "block";

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideIcon();
    runCheckAndShowPanel(text, window.location.href, rect);
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

// --- Result panel --------------------------------------------------------

let panelHostEl: HTMLDivElement | null = null;
let panelRoot: Root | null = null;

function ensurePanelHost(): Root {
  if (!panelHostEl) {
    panelHostEl = document.createElement("div");
    panelHostEl.id = PANEL_HOST_ID;
    panelHostEl.style.position = "fixed";
    panelHostEl.style.top = "0";
    panelHostEl.style.left = "0";
    panelHostEl.style.zIndex = "2147483647";
    document.documentElement.appendChild(panelHostEl);

    const shadow = panelHostEl.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    const mount = document.createElement("div");
    shadow.appendChild(mount);
    panelRoot = createRoot(mount);
  }
  return panelRoot!;
}

function hidePanel() {
  panelRoot?.render(<></>);
}

async function runCheckInBackground(text: string, sourceUrl: string): Promise<CreateCheckResponse> {
  return chrome.runtime.sendMessage({ type: "ai-checker/run-check", text, sourceUrl });
}

async function shareCheckInBackground(checkId: string): Promise<ShareCheckResponse> {
  return chrome.runtime.sendMessage({ type: "ai-checker/share-check", checkId });
}

function renderPanel(state: PanelState, position: PanelPosition | null) {
  const root = ensurePanelHost();
  root.render(
    <ResultPanel state={state} position={position} onClose={hidePanel} shareFn={shareCheckInBackground} />
  );
}

async function runCheckAndShowPanel(text: string, sourceUrl: string, anchorRect: DOMRect | null) {
  const position: PanelPosition | null = anchorRect
    ? { top: window.scrollY + anchorRect.bottom + 10, left: window.scrollX + anchorRect.left }
    : null;

  renderPanel({ status: "loading" }, position);
  try {
    const response = await runCheckInBackground(text, sourceUrl);
    renderPanel({ status: "done", response }, position);
  } catch {
    renderPanel({ status: "error", message: "Network error. Please try again." }, position);
  }
}

function currentSelectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

// Right-click "Check for AI Content" — the background service worker owns
// the context menu (needs the chrome.contextMenus API) but delegates the
// actual check + panel display back here. The selection is usually still
// live in the page at this point (right-clicking a selection doesn't
// clear it), so we can still anchor the panel to it when available.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ai-checker/check-selection") {
    runCheckAndShowPanel(message.text, message.sourceUrl, currentSelectionRect());
  }
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
