import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_DESKTOP_TYPOGRAPHY === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_DESKTOP_TYPOGRAPHY=1 for desktop typography checks.");

test("desktop lg typography improves queue readability without changing mobile card scale", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await page.setViewportSize({ width: 1023, height: 768 });
  await gotoReady(page, "/orders", '[data-order-mobile-list="true"]');
  await expect(page.locator('[data-order-desktop-list="true"]')).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoReady(page, "/orders", '[data-order-desktop-list="true"]');
  await expect(page.locator('[data-order-mobile-list="true"]')).toHaveCount(0);
  const desktopPhone = page
    .locator('[data-order-row="true"] [data-order-customer-identity="true"] > span')
    .first();
  await expect(desktopPhone).toBeVisible();
  const desktopFontSize = await desktopPhone.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(desktopFontSize, "desktop customer identifier font size").toBeGreaterThanOrEqual(13);

  const desktopFontFamily = await page
    .locator('[data-order-desktop-list="true"] .text-sm')
    .first()
    .evaluate((element) => getComputedStyle(element).fontFamily);
  for (const fallback of [
    "PingFang SC",
    "Microsoft YaHei UI",
    "Microsoft YaHei",
    "Noto Sans CJK SC",
  ]) {
    expect(desktopFontFamily, `desktop CJK fallback ${fallback}`).toContain(fallback);
  }

  for (const width of [390, 430, 768, 834]) {
    await page.setViewportSize({ width, height: 844 });
    await gotoReady(page, "/orders", '[data-order-mobile-list="true"]');
    const mobileMeta = page.locator('[data-order-mobile-card="true"] p.font-mono').first();
    await expect(mobileMeta).toBeVisible();
    const mobileFontSize = await mobileMeta.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(mobileFontSize, `mobile metadata font size at ${width}px`).toBeLessThanOrEqual(10.5);
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoReady(page, "/orders/new", '[data-new-order-form="true"]');
  const newOrderRoot = page.locator('[data-new-order-root="true"]');
  await expect(newOrderRoot).toBeVisible();
  await expect(newOrderRoot.locator('[data-new-order-workspace-grid="true"]')).toBeVisible();
  await expect(newOrderRoot.locator('[data-new-order-submit-card="true"]')).toBeVisible();
  const newOrderLabel = newOrderRoot.locator('[data-new-order-section="customer"] label').first();
  await expect(newOrderLabel).toBeVisible();
  const newOrderLabelFontSize = await newOrderLabel.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(newOrderLabelFontSize, "new-order desktop field label font size").toBeGreaterThanOrEqual(
    12,
  );
});

async function gotoReady(page: Page, path: string, readySelector: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await page.locator(readySelector).first().waitFor({ state: "visible", timeout: 30_000 });
  await page
    .waitForFunction(
      () =>
        !document.body.innerText.includes("正在恢复 RepairDesk") &&
        !document.body.innerText.includes("Compiling"),
      null,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
}
