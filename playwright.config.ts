import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["line"], ["json", { outputFile: ".local/ui-proof/controls/results.json" }]],
  use: { baseURL: "http://127.0.0.1:3121", trace: "retain-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "webkit-touch", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3121",
    url: "http://127.0.0.1:3121/login",
    reuseExistingServer: !process.env.CI,
    env: { BACKEND_MODE: "preview", LOCAL_PREVIEW: "true", NEXT_TELEMETRY_DISABLED: "1", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", APP_DATABASE_URL: "" },
  },
});
