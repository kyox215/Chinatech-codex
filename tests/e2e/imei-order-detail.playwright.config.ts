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
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
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
