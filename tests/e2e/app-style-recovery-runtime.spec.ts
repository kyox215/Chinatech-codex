import { expect, test } from "@playwright/test";
import {
  repairDeskStyleRecoveryBootstrap,
  repairDeskStyleRecoveryProbeToken,
} from "../../src/shared/lib/app-style-recovery";

test.use({ serviceWorkers: "block" });
for (const runtimeDelay of [0, 2_000, 5_000]) {
  test(`waits for a healthy runtime delayed by ${runtimeDelay}ms without reloading`, async ({
    page,
  }) => {
    let documents = 0;
    await page.route("**/__runtime-recovery-test", (route) => {
      documents += 1;
      return route.fulfill({
        contentType: "text/html",
        body: `<html style="--repairdesk-styles-ready:1"><body><div id="repairdesk-style-status"></div><button id="repairdesk-style-retry">Retry</button><script>${repairDeskStyleRecoveryBootstrap}</script><script>setTimeout(() => window.__repairDeskStyleRecovery.markRuntimeReady(), ${runtimeDelay})</script></body></html>`,
      });
    });
    await page.route("**/recovery-probe.txt**", (route) =>
      route.fulfill({ body: repairDeskStyleRecoveryProbeToken }),
    );
    await page.goto("/__runtime-recovery-test");
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __repairDeskRuntimeReady?: boolean })
                .__repairDeskRuntimeReady,
          ),
        { timeout: 8_000 },
      )
      .toBe(true);
    expect(documents).toBe(1);
    await expect(page.locator("html")).not.toHaveAttribute("data-style-recovery");
  });
}

test("recovers an explicitly failed application script promptly and bounds reloads", async ({
  page,
}) => {
  let documents = 0;
  await page.route("**/__runtime-recovery-test", (route) => {
    documents += 1;
    return route.fulfill({
      contentType: "text/html",
      body: `<html style="--repairdesk-styles-ready:1"><body><div id="repairdesk-style-status"></div><button id="repairdesk-style-retry">Retry</button><script>${repairDeskStyleRecoveryBootstrap}</script><script src="/_next/static/failed-runtime-test.js"></script></body></html>`,
    });
  });
  await page.route("**/failed-runtime-test.js", (route) => route.abort("failed"));
  await page.route("**/recovery-probe.txt**", (route) =>
    route.fulfill({ body: repairDeskStyleRecoveryProbeToken }),
  );
  await page.goto("/__runtime-recovery-test");
  await expect.poll(() => documents, { timeout: 3_000 }).toBe(2);
  await expect(page.locator("html")).toHaveAttribute("data-style-recovery", "manual");
  expect(documents).toBe(2);
});
