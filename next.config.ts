import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.BACKEND_MODE === "supabase" ? ".next-backend" : ".next",
  devIndicators: false,
  logging: { incomingRequests: { ignore: [/^\/auth\/(?:confirm|callback)(?:\?|$)/, /^\/(?:login)?\?.*\bcode=/] } },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
