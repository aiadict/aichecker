/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The extension calls these routes from a chrome-extension:// origin, in
  // both dev and production — always allow it. Safe to allow any origin
  // here because auth is a Bearer token (verified per-request against
  // Supabase in src/lib/auth.ts), not a cookie/origin-trust model, so an
  // unrelated website reflecting these headers gains nothing it didn't
  // already have.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Device-Id" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
