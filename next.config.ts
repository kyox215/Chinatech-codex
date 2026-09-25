import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The devtools launcher overlaps touch keypads in synthetic interaction runs.
  // Runtime error reporting remains enabled.
  devIndicators: process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1" ? false : undefined,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: resolve(projectRoot),
  },
};

export default nextConfig;
