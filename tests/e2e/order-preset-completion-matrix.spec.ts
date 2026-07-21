import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_ORDER_PRESET_COMPLETION === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_PRESET_COMPLETION=1 for this matrix.");

const mobileMatrices = [
  { name: "360x640", width: 360, height: 640 },
  { name: "844x390-landscape", width: 844, height: 390 },
  {
    name: "1024x768-at-200-percent-zoom-equivalent",
    width: 512,
    height: 384,
  },
] as const;

test.describe("order preset completion matrix", () => {
  for (const viewport of mobileMatrices) {
    test(`keeps the transition CTA reachable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoReady(page, "/orders/ord_47");

      await clickFirstVisible(page.getByRole("button", { name: "流转" }));
      const sheet = page.getByRole("dialog", { name: "状态流转" });
      const inlinePanel = page.getByRole("region", { name: "状态流转" });
      await expect
        .poll(async () => (await sheet.isVisible()) || (await inlinePanel.isVisible()))
        .toBe(true);
      const transitionSurface = (await sheet.isVisible()) ? sheet : inlinePanel;
      await clickFirstVisible(transitionSurface.getByRole("button", { name: /已取消|取消工单/ }));
      await clickFirstVisible(transitionSurface.getByRole("button", { name: /查看全部/ }));
      await transitionSurface.getByRole("radio", { name: /其他原因/ }).click();

      const note = transitionSurface.locator('[data-order-other-reason="true"]');
      const confirm = transitionSurface.getByRole("button", { name: "确认流转" });
      await note.fill("完整视口矩阵验证");
      await confirm.scrollIntoViewIfNeeded();
      await expect(confirm).toBeEnabled();
      await expectInsideViewport(confirm);
      await expectNoHorizontalOverflow(page);
      await expect(page.locator('[data-order-action-dock="true"]:visible')).toHaveCount(0);
      await expect(page.locator('[data-order-mobile-action-dock="true"]:visible')).toHaveCount(0);
    });
  }

  test("keeps desktop inline transition reachable at 1366x768", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoReady(page, "/orders");

    const list = page.locator('[data-order-desktop-list="true"]');
    const row = await firstVisible(list.locator('[data-order-row="true"]'));
    await row.click();

    const detail = page.getByRole("dialog", { name: "工单详情" });
    await clickFirstVisible(detail.getByRole("button", { name: "流转", exact: true }));
    const panel = detail.locator('[data-order-desktop-transition-panel="true"]');
    await expect(panel).toBeFocused();
    await clickFirstVisible(panel.getByRole("button", { name: /已取消|取消工单/ }));
    await clickFirstVisible(panel.getByRole("button", { name: /查看全部/ }));
    await panel.getByRole("radio", { name: /其他原因/ }).click();

    const note = panel.locator('[data-order-other-reason="true"]');
    const confirm = panel.getByRole("button", { name: "确认流转" });
    await note.fill("桌面完整视口矩阵验证");
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeEnabled();
    await expectInsideViewport(confirm);
    await expectNoHorizontalOverflow(page);
    await expect(detail.locator('[data-order-action-dock="true"]')).toHaveCount(0);
  });

  test("supports keyboard selection in reduced motion and forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/orders/ord_47");

    await clickFirstVisible(page.getByRole("button", { name: "流转" }));
    const sheet = page.getByRole("dialog", { name: "状态流转" });
    await clickFirstVisible(sheet.getByRole("button", { name: /已取消|取消工单/ }));

    const radios = sheet.getByRole("radio");
    await expect(radios).not.toHaveCount(0);
    const radio = radios.first();
    await expect(radio).toHaveAttribute("aria-checked", "false");
    await radio.focus();
    await page.keyboard.press("Space");
    await expect(radio).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByRole("button", { name: "确认流转" })).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function firstVisible(locator: Locator) {
  await expect.poll(() => firstVisibleIndex(locator)).toBeGreaterThanOrEqual(0);
  return locator.nth(await firstVisibleIndex(locator));
}

async function clickFirstVisible(locator: Locator) {
  const target = await firstVisible(locator);
  await expect(target).toBeEnabled();
  await target.click();
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

async function expectInsideViewport(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = locator.page().viewportSize();
  expect(viewport).not.toBeNull();
  expect(box?.x ?? -2).toBeGreaterThanOrEqual(-1);
  expect(box?.y ?? -2).toBeGreaterThanOrEqual(-1);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
