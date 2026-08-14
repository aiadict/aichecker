import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5175,
    strictPort: true,
    hmr: { port: 5175 },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Extension pages load in a separate "world" context from content
    // scripts, and Chrome's preload-cache matching doesn't line up across
    // that boundary — the modulepreload hint Vite emits by default gets
    // "used" from a different context than the one that requested it, so
    // Chrome logs a harmless but noisy "preload not used" warning in
    // chrome://extensions. Disabling it just means the chunk loads
    // on-demand via the normal import instead of a preload hint —
    // functionally identical for a bundle this small.
    modulePreload: false,
  },
});
