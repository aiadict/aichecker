/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The extension runs on a different origin during local dev (Vite on
  // :5175) and needs to call /api/checks — loosen CORS only in dev.
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
