import { expect, test, type Page } from "@playwright/test";

import {
  collectDomPerformanceMetrics,
  installPerformanceObservers,
  PERFORMANCE_HARNESS_METADATA,
  takeSyntheticScreenshot,
  type DomPerformanceMetrics,
  writePerformanceArtifact,
} from "./support/performance-harness";

/**
 * Controlled dev synthetic evidence only. This gate measures the Orders
 * surface in the business mock and is not production RUM or a production
 * timing budget.
 */
const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(
  !enabled,
  "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for synthetic Orders performance evidence.",
);

const viewports = [
  {
    width: 390,
    height: 844,
    listSelector: '[data-order-mobile-list="true"]',
    listMode: "mobile",
  },
  {
    width: 1024,
    height: 768,
    listSelector: '[data-order-desktop-list="true"]',
    listMode: "desktop",
  },
  {
    width: 1440,
    height: 900,
    listSelector: '[data-order-desktop-list="true"]',
    listMode: "desktop",
  },
] as const;

test.describe("Orders renderer performance (controlled dev synthetic)", () => {
  test("captures structural metrics and synthetic visual evidence at supported widths", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await installPerformanceObservers(page);

    const samples: Array<Record<string, unknown>> = [];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoOrdersList(page, viewport.listSelector);

      const listMetrics = await collectDomPerformanceMetrics(page);
      assertOrdersListStructure(
        listMetrics,
        viewport.listMode,
        `Orders list at ${viewport.width}px`,
      );
      assertNoOverflow(listMetrics, `Orders list at ${viewport.width}px`);
      const listSample: Record<string, unknown> = {
        viewport,
        surface: "list",
        ordersListSubtreeNodeCount: listMetrics.ordersList.subtreeNodeCount[viewport.listMode],
        metrics: listMetrics,
      };

      if (viewport.width === 390) {
        await takeSyntheticScreenshot(page, testInfo, "orders-list-390.png");
        listSample.screenshot = "orders-list-390.png";
      }
      if (viewport.width === 1440) {
        await takeSyntheticScreenshot(page, testInfo, "orders-list-1440.png");
        listSample.screenshot = "orders-list-1440.png";
      }

      if (viewport.width === 1024) {
        listSample.dialog = await captureDialogSample(page, testInfo);
      }
      samples.push(listSample);

      await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
      const detail = page.locator('[data-order-detail-root="true"]');
      await expect(detail).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(
              '[data-order-detail-renderer="compact"], [data-order-detail-renderer="desktop"]',
            )
            .count(),
        )
        .toBe(1);

      const detailMetrics = await collectDomPerformanceMetrics(page);
      assertDetailStructure(detailMetrics, `Orders detail at ${viewport.width}px`);
      samples.push({
        viewport,
        surface: "detail",
        metrics: detailMetrics,
      });
    }

    const artifact = {
      ...PERFORMANCE_HARNESS_METADATA,
      route: "/orders",
      routesNotCovered: ["/customers", "/inventory", "/buyback"],
      timingAdvisory:
        "Development/HMR timings are recorded for diagnosis only; no timing threshold gates this test.",
      samples,
    };
    const artifactPath = await writePerformanceArtifact(
      testInfo,
      "orders-renderer-performance.json",
      artifact,
    );
    console.info(
      `[orders-performance] artifact=${artifactPath} source=${PERFORMANCE_HARNESS_METADATA.source} samples=${samples.length} screenshots=3 timingAdvisory=true`,
    );
  });
});

async function gotoOrdersList(page: Page, listSelector: string) {
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator(listSelector)).toBeVisible();
}

async function captureDialogSample(
  page: Page,
  testInfo: Parameters<typeof takeSyntheticScreenshot>[1],
) {
  const firstRow = page.locator('[data-order-desktop-list="true"] [data-order-row="true"]').first();
  await expect(firstRow).toBeVisible();

  const startedAt = Date.now();
  await firstRow.click();
  const dialogShell = page.locator('[data-order-detail-dialog-shell="true"]');
  await expect(dialogShell).toBeVisible();
  const shellFeedbackMs = Date.now() - startedAt;

  const dialogDetail = dialogShell.locator(
    '[data-order-detail-root="true"][data-order-detail-surface="dialog"]',
  );
  await expect(dialogDetail).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-order-detail-renderer="compact"], [data-order-detail-renderer="desktop"]')
        .count(),
    )
    .toBe(1);
  const detailReadyMs = Date.now() - startedAt;
  const metrics = await collectDomPerformanceMetrics(page);
  assertDetailStructure(metrics, "Orders dialog detail at 1024px");

  await takeSyntheticScreenshot(page, testInfo, "orders-dialog-detail-1024.png");

  return {
    shellFeedbackMs,
    detailReadyMs,
    timingAdvisory: true,
    screenshot: "orders-dialog-detail-1024.png",
    metrics,
  };
}

function assertDetailStructure(metrics: DomPerformanceMetrics, label: string) {
  expect(metrics.renderer.active, `${label}: exactly one active renderer`).toBe(1);
  expect(metrics.renderer.inactive, `${label}: inactive renderer must be absent`).toBe(0);
  assertNoOverflow(metrics, label);
}

function assertOrdersListStructure(
  metrics: DomPerformanceMetrics,
  mode: "mobile" | "desktop",
  label: string,
) {
  expect(metrics.ordersList.total, `${label}: exactly one Orders list renderer`).toBe(1);
  expect(metrics.ordersList[mode], `${label}: expected ${mode} Orders list renderer`).toBe(1);
  expect(
    metrics.ordersList[mode === "mobile" ? "desktop" : "mobile"],
    `${label}: inactive Orders list renderer`,
  ).toBe(0);
}

function assertNoOverflow(metrics: DomPerformanceMetrics, label: string) {
  expect(metrics.scrollWidth, `${label}: document overflow`).toBeLessThanOrEqual(
    metrics.innerWidth + 1,
  );
}
