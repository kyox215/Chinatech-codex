import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_ORDER_PRESET_PHASE2 === "1";
const screenshotDir = process.env.REPAIRDESK_PRESET_PHASE2_SCREENSHOT_DIR;
test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_PRESET_PHASE2=1 for the preset Phase 2 audit.");

async function expectInsideViewport(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = locator.page().viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectNoOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
}

test("mobile intake uses distinct 44px symptom choices without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders/new");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const symptomChoice = page.getByRole("button", { name: "无法充电" });
  await expect(symptomChoice).toBeVisible();
  expect((await symptomChoice.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await symptomChoice.click();
  await expect(symptomChoice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("常见维修项目（可选）")).toBeVisible();
  await expectNoOverflow(page);
  if (screenshotDir) {
    await page.screenshot({ path: `${screenshotDir}/mobile-fact-picker-390x844.png` });
  }
});

test("dedicated deposit correction overlay stays above the action dock", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/orders");
  await page.waitForLoadState("networkidle");

  const firstRow = page.locator('[data-order-desktop-list="true"] [data-order-row="true"]').first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();

  const detail = page.getByRole("dialog", { name: "工单详情" });
  await expect(detail).toBeVisible();
  const correctionButton = detail.getByRole("button", { name: /更正初始定金|更正定金/ });
  await expect(correctionButton).toBeVisible();
  await correctionButton.click();

  const correction = page.getByRole("dialog", { name: "更正初始定金" });
  await expect(correction).toBeVisible();
  await expect(correction.getByRole("radio", { name: /建单时多录/ })).toBeVisible();
  await expect(correction.getByRole("button", { name: "确认更正" })).toBeDisabled();
  await expect(detail.locator('[data-order-action-dock="true"]')).toHaveCount(0);
  await expectInsideViewport(correction);
  await expectInsideViewport(correction.getByRole("button", { name: "确认更正" }));
  await expectNoOverflow(page);
  if (screenshotDir) {
    await page.screenshot({
      path: `${screenshotDir}/desktop-initial-deposit-overlay-1280x800.png`,
    });
  }
});

test("rework detail separates triage from post-diagnosis disposition", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/orders");
  await page.waitForLoadState("networkidle");

  const reworkRow = page
    .locator('[data-order-desktop-list="true"] [data-order-row="true"]')
    .first();
  await expect(reworkRow).toBeVisible();
  await reworkRow.click();

  const detail = page.getByRole("dialog", { name: "工单详情" });
  await expect(detail.locator('[data-order-rework-disposition-card="true"]')).toBeVisible();
  await expect(detail.getByText("请先记录检测结论，再选择返修处置。")).toBeVisible();
  await expect(detail.getByRole("button", { name: "选择处置" })).toBeDisabled();
  await expectNoOverflow(page);
  if (screenshotDir) {
    await page.screenshot({ path: `${screenshotDir}/desktop-rework-disposition-1280x800.png` });
  }
});
