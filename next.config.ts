import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.BACKEND_MODE === "supabase" && process.env.VERCEL !== "1" ? ".next-backend" : ".next",
  devIndicators: false,
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    // Exact ICU addon for each actual native-runtime consumer.
    '/api/backend/command': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/command': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/page': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/app/retail': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/retail': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/retail/facets': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/retail/scan': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/retail/identity-check': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    '/api/backend/v2/settings': ['./native/icu-sort-key/runtime.cjs','./native/icu-sort-key/build/*'],
    // Playwright loads browsers.json and bundled runtime modules dynamically.
    // Tracing only its static import produces a function that builds successfully
    // but fails before the receipt handler runs in an isolated deployment.
    '/api/backend/repair-receipt': ['./node_modules/playwright-core/**', './node_modules/@sparticuz/chromium/bin/**', './server-assets/receipt/*', './public/fonts/source-sans-3/source-sans-3-roman.woff2'],
    '/api/toolbox/office': ['./server-assets/office/*.ps1.txt'],
    '/api/toolbox/office/script': ['./server-assets/office/*.ps1.txt'],
    '/api/toolbox/office-desktop/package': ['./server-assets/office-desktop/runner.ps1.txt'],
  },
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
