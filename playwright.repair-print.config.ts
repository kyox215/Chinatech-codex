import { defineConfig, devices } from "@playwright/test";

const mode = process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR ? "production" : "source";

// Printing fixtures only: about:blank, in-memory providers, all requests aborted.
// No webServer/baseURL: a frozen production CSS directory remains untouched.
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "repair-print-layout.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["line"], ["json", { outputFile: `.local/ui-proof/repair-print-layout/${mode}-results.json` }]],
  outputDir: `.local/ui-proof/repair-print-layout/${mode}-test-results`,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "webkit-touch", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } } },
  ],
});
