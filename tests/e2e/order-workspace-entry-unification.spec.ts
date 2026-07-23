import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260723-006-order-entry-unification";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for order workspace entry checks.");

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`restores canonical order workspace intents at ${viewport.width}px`, async ({ page }) => {
    mkdirSync(evidenceDir, { recursive: true });
    await page.setViewportSize(viewport);

    await gotoReady(page, "/orders?workspace=new-order&source=customer&intakeSession=e2e-entry");
    const newOrderDialog = page.locator('[data-new-order-dialog="true"]');
    await expect(newOrderDialog).toBeVisible();
    await expect(newOrderDialog.locator('[data-new-order-root="true"]')).toBeVisible();
    await expectNoPageOverflow(page);
    await page.screenshot({
      path: `${evidenceDir}/new-order-workspace-${viewport.width}.png`,
      fullPage: false,
    });
    await newOrderDialog.getByRole("button", { name: "关闭新建维修工单" }).click();
    await expect(page).toHaveURL(/\/orders$/);

    await gotoReady(page, "/orders?workspace=order-detail&orderId=ord_1&source=customer");
    const detailDialog = page.locator('[data-order-detail-dialog-shell="true"]');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('[data-order-detail-root="true"]')).toBeVisible();
    await expectNoPageOverflow(page);
    await page.screenshot({
      path: `${evidenceDir}/order-detail-workspace-${viewport.width}.png`,
      fullPage: false,
    });
    await detailDialog.getByRole("button", { name: "关闭工单详情" }).first().click();
    await expect(page).toHaveURL(/\/orders$/);
  });
}

async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <=
          window.innerWidth + 1,
      ),
    )
    .toBe(true);
}
