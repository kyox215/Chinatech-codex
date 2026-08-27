import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: resolve(projectRoot),
  },
  // The catch-all API imports the image sanitizer. Keep both sharp's native
  // loader and its Linux libvips binary in the Vercel function bundle.
  // Escape the dynamic segment because the route key is a picomatch pattern;
  // this keeps the native payload scoped to the catch-all function.
  outputFileTracingIncludes: {
    "/api/repairdesk/\\[...path\\]": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
