import { defineConfig, devices } from "@playwright/test";

if (process.env.REPAIRDESK_E2E_ATOMIC_ONBOARDING_POSTGREST === "1") {
  throw new Error(
    "Sensitive store-signup PostgREST E2E requires --config=playwright.store-signup-postgrest.config.ts.",
  );
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER
  ? process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1"
  : !process.env.CI;
const requestedBrowser = process.env.PLAYWRIGHT_BROWSER;
if (requestedBrowser && requestedBrowser !== "chromium" && requestedBrowser !== "webkit") {
  throw new Error(`Unsupported PLAYWRIGHT_BROWSER: ${requestedBrowser}`);
}
const browserProject =
  requestedBrowser === "webkit"
    ? { name: "webkit", use: { ...devices["Desktop Safari"] } }
    : { name: "chromium", use: { ...devices["Desktop Chrome"] } };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    video: "off",
    trace: "on-first-retry",
  },
  projects: [browserProject],
  webServer: {
    command: process.env.PLAYWRIGHT_WEBSERVER_COMMAND ?? "npm run dev",
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
});
