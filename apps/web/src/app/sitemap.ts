import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Served as /sitemap.xml: the public pages someone could land on from
// search — add new ones here. Left out on purpose: /dashboard (sign-in
// only), shared /history/<slug> results (noindex), and account/extension
// flow pages (/login, /reset-password, /welcome, /extension-connected,
// /uninstall, /feedback). No lastModified/changeFrequency/priority: Google
// ignores the last two, and only trusts lastModified when it's accurate —
// which a build timestamp stamped on every page isn't.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/check", "/pricing", "/resultsupport", "/support", "/privacy", "/terms"].map(
    (path) => ({ url: `${APP_URL}${path}` })
  );
}
