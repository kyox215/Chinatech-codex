import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const routes = [
  "/",
  "/orders",
  "/orders/new",
  "/customers",
  "/buyback",
  "/inventory",
  "/messages",
  "/settings",
  "/platform",
];

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

test.describe("responsive overflow guard", () => {
  for (const viewport of viewports) {
    test(`primary routes fit within ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expectNoPageOverflow(page);
      }
    });
  }

  test("orders detail dialog keeps page width stable", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/orders");
    await page.waitForLoadState("networkidle");

    const firstOrder = page.locator("text=/SEA-[0-9]+|R[0-9]{7}/").first();
    if ((await firstOrder.count()) === 0) {
      await expectNoPageOverflow(page);
      return;
    }

    await firstOrder.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(250);
    const overviewBox = await dialog.boundingBox();
    expect(overviewBox).not.toBeNull();

    await page.getByRole("button", { name: "附件库存" }).click();
    await expect(page.getByText("暂无与该工单关联的库存记录。")).toBeVisible();
    await page.waitForTimeout(250);
    const assetsBox = await dialog.boundingBox();
    expect(assetsBox).not.toBeNull();
    expect(Math.abs((assetsBox?.width ?? 0) - (overviewBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((assetsBox?.height ?? 0) - (overviewBox?.height ?? 0))).toBeLessThanOrEqual(1);
    await expectNoPageOverflow(page);
  });
});
