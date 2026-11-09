import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Served as /robots.txt. Only blocks what has nothing for a crawler: API
// routes, the email-confirm handler, and /dashboard (signed-out visitors,
// Googlebot included, just get redirected to /login). /history/ is
// deliberately left crawlable — shared results opt out of search with a
// noindex tag instead (see history/[slug]/page.tsx), and Google can only
// see that tag if robots.txt lets it fetch the page; a robots.txt block
// alone can still leave the bare URL indexed if someone links to it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/dashboard"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
