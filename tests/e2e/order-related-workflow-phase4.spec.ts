import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_ORDER_RELATED_PHASE4 === "1";
const screenshotDir = process.env.REPAIRDESK_PHASE4_SCREENSHOT_DIR;

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_RELATED_PHASE4=1 for the Phase 4 audit.");

test("shows the immutable-source related-order contract with a no-typing triage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/orders/ord_14", { waitUntil: "domcontentloaded" });

  const sourceCard = await firstVisible(
    page.locator('[data-order-rework-disposition-card="true"]'),
  );
  await expect(sourceCard).toBeVisible();
  await expect(sourceCard).toContainText("原单证据和金额保持不变");
  await sourceCard.getByRole("button", { name: "开始复检" }).click();

  const dialog = page.getByRole("dialog", { name: "开始售后复检" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /疑似原故障复发/ }).click();
  await expect(dialog.getByRole("radio", { name: /疑似原故障复发/ })).toBeChecked();
  await expect(dialog.getByRole("button", { name: "建立复检单" })).toBeEnabled();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  if (screenshotDir) {
    await page.screenshot({
      path: `${screenshotDir}/desktop-related-rework-triage-1280x800.png`,
      fullPage: true,
    });
  }
});

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

async function firstVisible(locator: Locator) {
  await expect.poll(() => firstVisibleIndex(locator)).toBeGreaterThanOrEqual(0);
  return locator.nth(await firstVisibleIndex(locator));
}

async function firstVisibleIndex(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await locator
        .nth(index)
        .isVisible()
        .catch(() => false)
    ) {
      return index;
    }
  }
  return -1;
}
