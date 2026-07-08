import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3022";
const serverPort = new URL(baseURL).port || (baseURL.startsWith("https:") ? "443" : "80");

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
    },
  ],
  webServer: {
    command: `REPAIRDESK_E2E_ORDER_AUDIT=1 npx next dev -p ${serverPort} --hostname localhost`,
    cwd: "../..",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
