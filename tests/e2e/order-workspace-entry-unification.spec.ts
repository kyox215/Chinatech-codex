import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260723-006-order-entry-unification";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for order workspace entry checks.");

for (const viewport of [
  { width: 390, height: 844 },
  { width: 767, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`restores canonical order workspace intents at ${viewport.width}px`, async ({ page }) => {
    mkdirSync(evidenceDir, { recursive: true });
    await page.setViewportSize(viewport);

    await gotoReady(page, "/orders?workspace=order-detail&orderId=ord_1&source=customer");
    const detailDialog = page.locator('[data-order-detail-dialog-shell="true"]');
    if (viewport.width < 768) {
      await expect(page).toHaveURL(/\/orders\/ord_1\?from=customer$/);
      await expect(detailDialog).toHaveCount(0);
      const detailPage = page.locator(
        '[data-order-detail-root="true"][data-order-detail-surface="page"]',
      );
      await expect(detailPage).toBeVisible();
      await expect(detailPage.locator('[data-mobile-order-page="true"]')).toBeVisible();
      await expect(detailPage.locator('[data-mobile-order-action-dock="true"] button')).toHaveCount(
        2,
      );
      await expect(detailPage.locator('[data-mobile-payment-summary="true"]')).toBeVisible();
      await expect(detailPage.locator('a[href^="/customers/"]').first()).toBeVisible();
    } else {
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog.locator('[data-order-detail-root="true"]')).toBeVisible();
    }
    await expectNoPageOverflow(page);
    await page.screenshot({
      path: `${evidenceDir}/order-detail-workspace-${viewport.width}.png`,
      fullPage: false,
    });
    if (viewport.width < 768) {
      await gotoReady(page, "/orders/ord_1?from=orders");
      await expect(
        page.locator('[data-order-detail-root="true"] a[href="/orders"]').first(),
      ).toBeVisible();
    }
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
