import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260809-004-inventory-mobile-selector-remediation-release",
);

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`inventory create stays in one bounded dialog at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/inventory");
    await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
    const pathnameBefore = new URL(page.url()).pathname;

    await page.getByRole("button", { name: "快速录入商品" }).click();
    const dialog = page.locator('[data-inventory-product-create-dialog="true"]');
    await expect(dialog).toBeVisible();
    if (viewport.width < 1024) {
      await expect(dialog).toBeFocused();
      expect(
        await page.evaluate(() =>
          document.activeElement?.matches("input, textarea, select, [role='combobox']"),
        ),
      ).toBe(false);
    } else {
      await expect(page.getByLabel(/品牌/)).toBeFocused();
    }
    expect(new URL(page.url()).pathname).toBe(pathnameBefore);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toHaveCount(0);
    await expect(page.locator('[data-ui="inventory-product-actions"]')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertDialogInsideViewport(page);

    if (viewport.width === 390 || viewport.width === 1280) {
      await page.screenshot({
        path: resolve(screenshotDir, `${viewport.width}-inventory-create-dialog.png`),
      });
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/inventory");
  });
}

test("dirty close uses an inline confirmation and keeps the list context", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/inventory");
  await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
  const search = page.locator('input[placeholder="搜索商品、SKU、型号"]:visible');
  await search.fill("Apple");
  await page.getByRole("button", { name: "快速录入商品" }).click();
  await selectCatalogValue(page, "product-brand", "搜索手机品牌或手动输入", "Apple");
  await page.getByRole("button", { name: "关闭商品录入弹窗" }).click();

  await expect(page.getByRole("heading", { name: "放弃本次未保存商品？" })).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  const continueEditing = page.getByRole("button", { name: "继续填写" });
  const discardAndClose = page.getByRole("button", { name: "放弃并关闭" });
  await expect(continueEditing).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(discardAndClose).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(continueEditing).toBeFocused();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "430-inventory-create-discard.png") });

  await continueEditing.click();
  await expect(page.locator("#product-brand")).toContainText("Apple");
  await page.keyboard.press("Escape");
  await discardAndClose.click();
  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  await expect(search).toHaveValue("Apple");
  expect(new URL(page.url()).pathname).toBe("/inventory");
});

test("mobile browse stays keyboard-free until explicit search and desktop keeps the editable popover", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/inventory");
    await expect(page.getByRole("button", { name: "快速录入商品" })).toBeVisible();
    await page.getByRole("button", { name: "快速录入商品" }).click();
    await page.getByRole("radio", { name: /游戏机/ }).click();

    const brandTrigger = page.locator("#product-brand");
    await expect(brandTrigger).toHaveAttribute("role", "combobox");
    await expect(brandTrigger).toHaveAttribute("aria-haspopup", "listbox");
    await expect(brandTrigger).toHaveAttribute("aria-controls", "product-brand-catalog-list");
    await expect(brandTrigger).toHaveJSProperty("tagName", "BUTTON");
    await brandTrigger.click();
    const picker = page.locator('[data-inventory-catalog-picker="inline"]');
    await expect(picker).toBeVisible();
    const closeButton = page.getByRole("button", { name: "关闭品牌选择" });
    await expect(closeButton).toBeFocused();
    await expect(page.locator("[data-inventory-catalog-search-action]")).toBeVisible();
    await expect(page.locator("[data-inventory-catalog-search]")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement?.matches("input, textarea, select")),
    ).toBe(false);
    await assertInlinePickerCoversActions(page, picker);
    await assertNoFocusEscape(page, picker);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: resolve(screenshotDir, `${width}-game-console-brand-browse.png`),
    });

    await page.locator("[data-inventory-catalog-search-action]").click();
    const searchInput = page.getByPlaceholder("搜索游戏机品牌或手动输入");
    await expect(searchInput).toBeFocused();
    await expect(closeButton).toBeVisible();
    await assertVisibleInsideViewport(page, picker.locator("section"));
    await searchInput.fill("Nintendo");
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: resolve(screenshotDir, `${width}-game-console-brand-search.png`),
    });

    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "放弃本次未保存商品？" })).toHaveCount(0);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await page.getByRole("button", { name: "快速录入商品" }).click();
  const desktopBrand = page.locator("#product-brand");
  await expect(desktopBrand).toHaveAttribute("role", "combobox");
  await expect(desktopBrand).toHaveJSProperty("tagName", "INPUT");
  await desktopBrand.click();
  await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toBeVisible();
  await page.waitForTimeout(250);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "1280-brand-popover.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toHaveCount(0);
  await page.getByLabel(/品牌/).fill("Sony / PlayStation");
  await page.getByLabel(/型号 \/ 商品名称/).pressSequentially("Workshop Prototype");
  await expect(
    page.locator('[data-ui="inventory-product-catalog-transition-confirm"]'),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("catalog trigger changes exactly at the 1024px desktop boundary", async ({ page }) => {
  for (const width of [1023, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/inventory");
    await page.getByRole("button", { name: "快速录入商品" }).click();
    const brand = page.locator("#product-brand");
    await expect(brand).toHaveAttribute("role", "combobox");
    if (width < 1024) {
      await expect(brand).toHaveJSProperty("tagName", "BUTTON");
      await brand.click();
      await expect(page.locator('[data-inventory-catalog-picker="inline"]')).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-inventory-catalog-picker="inline"]')).toHaveCount(0);
    } else {
      await expect(brand).toHaveJSProperty("tagName", "INPUT");
      await brand.click();
      await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "关闭商品录入弹窗" }).click();
    await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  }
});

test("route intent opens the dialog while the standalone compatibility page keeps scanning", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory?workspace=new-product");
  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/inventory$/);

  await page.goto("/inventory/new");
  await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
  await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toBeVisible();
  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test("successful create closes the dialog before canonical product navigation", async ({
  page,
}) => {
  await page.route("**/api/repairdesk/inventory/products/quick-create", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ok: true,
          code: "created",
          id: "inv_mock_3",
          sku: "I001203",
          created_at: "2026-08-07T16:00:00.000Z",
        },
      }),
    });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/inventory");
  await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
  await page.getByRole("button", { name: "快速录入商品" }).click();
  await page.getByLabel(/品牌/).fill("Apple");
  await page.getByLabel(/型号 \/ 商品名称/).fill("iPad Air 5");
  await page.getByRole("button", { name: "保存并查看商品" }).click();

  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/inventory\/inv_mock_3$/);
});

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("[role='dialog'], form, header, section")]
      .filter((element) => {
        const overflowX = window.getComputedStyle(element).overflowX;
        return (
          element.scrollWidth > element.clientWidth + 1 &&
          overflowX !== "hidden" &&
          overflowX !== "clip"
        );
      })
      .map((element) => ({
        tag: element.tagName,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
  }));
  expect(result.document).toBeLessThanOrEqual(result.viewport);
  expect(result.offenders).toEqual([]);
}

async function assertDialogInsideViewport(page: Page) {
  const dialog = page.locator('[data-inventory-product-create-dialog="true"]');
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    (await page.evaluate(() => window.innerHeight)) + 2,
  );
}

async function assertInlinePickerCoversActions(page: Page, picker: ReturnType<Page["locator"]>) {
  const actions = page.locator('[data-ui="inventory-product-actions"]');
  await expect(actions).toBeVisible();
  const result = await page.evaluate(() => {
    const picker = document.querySelector<HTMLElement>('[data-inventory-catalog-picker="inline"]');
    const actions = document.querySelector<HTMLElement>('[data-ui="inventory-product-actions"]');
    if (!picker || !actions) return { picker: null, actions: null, hitActions: null };
    const pickerBox = picker.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    const sampleX = Math.max(
      0,
      Math.min(window.innerWidth - 1, actionsBox.left + actionsBox.width / 2),
    );
    const sampleY = Math.max(0, Math.min(window.innerHeight - 1, actionsBox.bottom - 4));
    const hit = document.elementFromPoint(sampleX, sampleY);
    return {
      picker: { top: pickerBox.top, bottom: pickerBox.bottom, height: pickerBox.height },
      actions: { top: actionsBox.top, bottom: actionsBox.bottom, height: actionsBox.height },
      hitActions: Boolean(hit?.closest('[data-ui="inventory-product-actions"]')),
    };
  });
  expect(result.picker).not.toBeNull();
  expect(result.actions).not.toBeNull();
  expect(result.picker!.bottom).toBeGreaterThanOrEqual(result.actions!.bottom - 2);
  expect(result.hitActions).toBe(false);
  await assertVisibleInsideViewport(page, picker.locator("section"));
}

async function assertNoFocusEscape(page: Page, picker: ReturnType<Page["locator"]>) {
  await page.keyboard.press("Shift+Tab");
  await expect(picker).toContainText(/游戏机/);
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[data-inventory-catalog-picker="inline"]')),
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[data-inventory-catalog-picker="inline"]')),
    ),
  ).toBe(true);
  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-inventory-catalog-picker="inline"]')),
      ),
    ).toBe(true);
  }
}

async function assertVisibleInsideViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    (await page.evaluate(() => window.innerHeight)) + 2,
  );
}

async function selectCatalogValue(
  page: Page,
  id: string,
  searchPlaceholder: string,
  value: string,
) {
  const trigger = page.locator(`#${id}`);
  const tagName = await trigger.evaluate((element) => element.tagName);
  if (tagName === "INPUT") {
    await trigger.fill(value);
    return;
  }

  await trigger.click();
  const searchAction = page.locator("[data-inventory-catalog-search-action]");
  await expect(searchAction).toBeVisible();
  await searchAction.scrollIntoViewIfNeeded();
  await searchAction.click();
  const search = page.getByPlaceholder(searchPlaceholder);
  await expect(search).toBeFocused();
  await search.fill(value);
  const exactOption = page.getByRole("option", {
    name: new RegExp(`^${escapeRegExp(value)}(?:\\s|$)`),
  });
  if (await exactOption.count()) {
    await exactOption.first().click();
  } else {
    await page.getByRole("option", { name: new RegExp(`使用“${escapeRegExp(value)}”`) }).click();
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
