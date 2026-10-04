import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.BACKEND_MODE === "supabase" && process.env.VERCEL !== "1" ? ".next-backend" : ".next",
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/:path((?!sw\\.js$|recovery-probe\\.txt$).*)",
        has: [{ type: "host", value: "chinatech.in" }],
        destination: "https://www.chinatech.in/:path",
        permanent: true,
      },
    ];
  },
  logging: { incomingRequests: { ignore: [/^\/auth\/(?:confirm|callback|account\/callback)(?:\?|$)/, /^\/(?:login)?\?.*\bcode=/] } },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
