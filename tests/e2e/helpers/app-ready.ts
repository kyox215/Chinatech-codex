import type { Page } from "@playwright/test";
import { repairDeskStyleReadyProperty } from "@/shared/lib/app-style-recovery";

/** Match the app's startup contract before creating drafts or document-identity markers. */
export async function waitForApplicationReady(page: Page) {
  await page.waitForFunction(
    (readyProperty) => {
      const root = document.documentElement;
      return (
        (window as Window & { __repairDeskRuntimeReady?: boolean }).__repairDeskRuntimeReady ===
          true &&
        getComputedStyle(root).getPropertyValue(readyProperty).trim() === "1" &&
        !root.hasAttribute("data-style-recovery")
      );
    },
    repairDeskStyleReadyProperty,
    { timeout: 30_000 },
  );
}
