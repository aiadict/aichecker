import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Permissions are kept to the minimum Phase-1 needs and must each be
// justified in the Chrome Web Store listing (see docs/privacy-and-legal.md):
//   - contextMenus: powers the right-click "Check for AI Content" action
//   - storage:      caches the auth session + settings locally
//   - activeTab:    lets the content script read the current page's selection
//   - scripting:    injects the selection-floating-icon overlay on demand
// "host_permissions": <all_urls> is required so the right-click check and
// floating icon work on any site — this is the single most sensitive
// permission and needs the clearest justification copy at submission time.
export default defineManifest({
  manifest_version: 3,
  name: "AI Checker",
  description:
    "Instantly check if text is AI-generated or human-written, anywhere on the web.",
  version: pkg.version,
  icons: {
    // TODO: replace with real designed icon set before Chrome Web Store submission.
    16: "public/icons/icon16.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["contextMenus", "storage", "activeTab", "scripting"],
  host_permissions: ["<all_urls>"],
});
