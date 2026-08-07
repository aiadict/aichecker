import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Permissions are kept to the minimum needed and must each be justified in
// the Chrome Web Store listing (see docs/privacy-and-legal.md):
//   - contextMenus: powers the right-click "Check for AI Content" action
//   - storage:      caches the auth session + settings locally
//   - sidePanel:    the extension's UI lives in Chrome's side panel, not a
//                   toolbar popup — see docs/architecture.md for why
// "host_permissions": <all_urls> is required so the right-click check and
// floating icon work on any site — this is the single most sensitive
// permission and needs the clearest justification copy at submission time.
// `activeTab` and `scripting` were dropped: the content script is
// registered declaratively above (not injected via chrome.scripting.*),
// and nothing reads tab data beyond what host_permissions and the
// context-menu callback already provide — fewer permissions means a
// faster review and a less alarming install prompt for users.
export default defineManifest({
  manifest_version: 3,
  name: "AI Checker",
  description:
    "Instantly check if text is AI-generated or human-written, anywhere on the web.",
  version: pkg.version,
  icons: {
    16: "public/icons/icon16.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png",
  },
  // No default_popup: setting one takes over the action icon's click
  // behavior entirely (side panel behavior is silently ignored while it's
  // present), so the toolbar icon opening the side panel instead depends
  // on this key being absent, not just on sidePanel.setPanelBehavior().
  action: {},
  side_panel: {
    default_path: "src/panel/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
  permissions: ["contextMenus", "storage", "sidePanel"],
  host_permissions: ["<all_urls>"],
});
