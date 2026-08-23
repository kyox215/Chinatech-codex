import { defineConfig } from "@playwright/test";

import { assertAtomicStoreOnboardingPostgrestEnvironment } from "./tests/e2e/support/atomic-store-onboarding-postgrest-env";

const environment = assertAtomicStoreOnboardingPostgrestEnvironment();

export default defineConfig({
  testDir: environment.repositoryRoot,
  testMatch: "tests/e2e/atomic-store-onboarding-postgrest.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: environment.baseURL,
    storageState: environment.storageState,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: environment.webServerCommand,
    url: environment.baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
