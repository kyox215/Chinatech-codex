import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.BACKEND_MODE === "supabase" && process.env.VERCEL !== "1" ? ".next-backend" : ".next",
  devIndicators: false,
  outputFileTracingIncludes: { '/api/toolbox/office': ['./server-assets/office/*.ps1.txt'], '/api/toolbox/office/script': ['./server-assets/office/*.ps1.txt'] },
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
  logging: { incomingRequests: { ignore: [/^\/api\/toolbox\/office\/script(?:\?|$)/, /^\/auth\/(?:confirm|callback|account\/callback)(?:\?|$)/, /^\/(?:login)?\?.*\bcode=/] } },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
