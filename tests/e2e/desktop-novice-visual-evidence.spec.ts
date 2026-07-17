import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const screenshotDir = path.resolve(
  process.env.REPAIRDESK_E2E_NOVICE_SCREENSHOT_DIR ??
    "screenshots/TASK-20260717-008-desktop-novice-ui-implementation",
);

test.skip(!enabled, "Enable the controlled RepairDesk mock environment.");

test("captures the desktop novice workflow with controlled data", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(screenshotDir, { recursive: true });

  await capture(page, "/", { width: 1024, height: 768 }, "dashboard-1024x768.png", async () => {
    await expect(page.locator('[data-ui="dashboard-priority-card"]').first()).toBeVisible();
    await expect(page.locator('[data-ui="dashboard-priority-card"]')).toHaveCount(
      await cappedPriorityCount(page),
    );
  });

  await capture(page, "/orders", { width: 1280, height: 800 }, "orders-1280x800.png", async () => {
    await expect(page.getByRole("link", { name: "维修工单", exact: true }).first()).toBeVisible();
    await expect(page.getByText("维修工单", { exact: true }).last()).toBeVisible();
  });

  await capture(
    page,
    "/orders/new",
    { width: 1440, height: 900 },
    "order-new-1440x900.png",
    async () => {
      await expect(page.locator('[data-new-order-form="true"]')).toBeVisible();
      await expect(page.locator('[data-new-order-missing-items="true"]')).toBeVisible();
    },
  );
  await expect(page.locator('[data-new-order-missing-items="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /设备留店/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: /设备未留店/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "补充：设备型号" }).click();
  await expect(page.locator('[data-new-order-field="device-model"] input')).toBeFocused();

  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-order-action-dock="true"]')).toBeVisible();
  await expect(
    page.locator('[data-order-action-dock="true"] [data-primary-action="true"]'),
  ).toHaveCount(1);
  await prepare(page);
  await page.screenshot({ path: path.join(screenshotDir, "order-detail-1440x900.png") });

  const responsibilityRow = page.locator('[data-order-responsibility-row="true"]');
  if (await responsibilityRow.isVisible()) {
    await responsibilityRow.scrollIntoViewIfNeeded();
    await prepare(page);
    await page.screenshot({
      path: path.join(screenshotDir, "order-detail-responsibility-1440x900.png"),
    });
  }

  await capture(
    page,
    "/customers",
    { width: 1600, height: 1000 },
    "customers-1600x1000.png",
    async () => {
      await expect(page.locator("main table").first()).toBeVisible();
    },
  );
  const customerTable = page.locator("main table").first();
  await expect(customerTable.getByRole("columnheader", { name: "当前事项" })).toBeVisible();
  await expect(customerTable.getByRole("columnheader", { name: "待收", exact: true })).toHaveCount(
    0,
  );

  await page.route("**/api/repairdesk/inventory/list", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "controlled buyback failure" }),
    });
  });
  await capture(
    page,
    "/buyback",
    { width: 1440, height: 900 },
    "buyback-error-1440x900.png",
    async () => {
      await expect(page.getByRole("heading", { name: "回收记录加载失败" })).toBeVisible();
    },
  );
  await expect(page.getByText("还没有回收报价")).toHaveCount(0);
});

async function capture(
  page: Page,
  route: string,
  viewport: { width: number; height: number },
  filename: string,
  ready: () => Promise<void>,
) {
  await page.setViewportSize(viewport);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await ready();
  await prepare(page);
  await page.screenshot({ path: path.join(screenshotDir, filename) });
}

async function prepare(page: Page) {
  await page.waitForTimeout(200);
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) (portal as HTMLElement).style.display = "none";
  });
}

async function cappedPriorityCount(page: Page) {
  const count = await page.locator('[data-ui="dashboard-priority-card"]').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5);
  return count;
}
