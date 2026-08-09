import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const captureScreenshots = process.env.REPAIRDESK_E2E_SCREENSHOTS === "1";
const screenshotDirectory =
  process.env.REPAIRDESK_E2E_SCREENSHOT_DIR ??
  "artifacts/screenshots/TASK-20260809-005-global-compact-selector-typography-release";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for inventory intake checks.");

for (const viewport of [
  { width: 320, height: 780 },
  { width: 359, height: 800 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 820, height: 1180 },
  { width: 1023, height: 800 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`quick product categories stay usable without horizontal scrolling at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/inventory/new");

    const phone = page.getByRole("radio", { name: /手机/ });
    const tablet = page.getByRole("radio", { name: /平板/ });
    await expect(phone).toBeVisible();
    await expect(tablet).toBeVisible();
    await expect(page.getByLabel("品牌")).toBeVisible();
    await expect(page.getByLabel("型号 / 商品名称")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    if (viewport.width <= 360) {
      const brandBox = await page.locator("#product-brand").boundingBox();
      const modelBox = await page.locator("#product-model").boundingBox();
      expect(brandBox).not.toBeNull();
      expect(modelBox).not.toBeNull();

      if (viewport.width < 360) {
        expect(modelBox!.y).toBeGreaterThan(brandBox!.y + brandBox!.height);
      } else {
        expect(Math.abs(modelBox!.y - brandBox!.y)).toBeLessThanOrEqual(2);
      }
    }

    await phone.focus();
    await page.keyboard.press("ArrowRight");
    await expect(tablet).toBeFocused();
    await expect(tablet).toHaveAttribute("aria-checked", "true");
    await expect(phone).toHaveAttribute("tabindex", "-1");

    if (captureScreenshots && [360, 390, 430, 1024, 1280].includes(viewport.width)) {
      await phone.click();
      await expect(phone).toHaveAttribute("aria-checked", "true");
      await page.screenshot({
        path: `${screenshotDirectory}/inventory-phone-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });
}

for (const width of [390, 430]) {
  test(`game console storage and edition fields stay full-width at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/inventory/new");

    await page.getByRole("radio", { name: "游戏机" }).click();
    const brand = page.getByRole("combobox", { name: "品牌 *" });
    const model = page.locator("#product-model");
    await expect(brand).toHaveText("选择品牌");
    await expect(model).toHaveText("先选品牌");

    const storage = page.locator("#product-storage");
    const edition = page.locator("#product-spec-edition");
    await expect(storage).toBeVisible();
    await expect(edition).toBeVisible();
    const [storageBox, editionBox] = await Promise.all([
      storage.boundingBox(),
      edition.boundingBox(),
    ]);
    expect(storageBox).not.toBeNull();
    expect(editionBox).not.toBeNull();
    expect(storageBox!.width).toBeGreaterThan(width * 0.6);
    expect(editionBox!.width).toBeGreaterThan(width * 0.6);

    if (width < 1024) {
      await expect(brand).toHaveClass(/text-sm/);
      await expect(brand).toHaveClass(/min-h-11/);
    }
    await assertNoHorizontalOverflow(page);

    if (captureScreenshots) {
      await page.screenshot({
        path: `${screenshotDirectory}/inventory-game-console-${width}-closed.png`,
        fullPage: true,
      });

      if (width === 390) {
        await brand.click();
        await page.getByRole("button", { name: "搜索目录或手动输入" }).click();
        await page.getByPlaceholder("搜索游戏机品牌或手动输入").fill("Nintendo");
        await page
          .getByRole("option", { name: /Nintendo/ })
          .first()
          .click();
        await model.click();
        const modelOption = page.getByText("Nintendo Switch OLED Model", { exact: true });
        await expect(modelOption).toBeVisible();
        await modelOption.scrollIntoViewIfNeeded();
        const modelOptionMetrics = await modelOption.evaluate((element) => {
          const row = element.closest<HTMLElement>('[role="option"]');
          if (!row) throw new Error("Nintendo model option row was not found");
          const style = getComputedStyle(element);
          return {
            textScrollHeight: element.scrollHeight,
            textClientHeight: element.clientHeight,
            lineClamp: style.getPropertyValue("-webkit-line-clamp"),
            whiteSpace: style.whiteSpace,
            rowScrollWidth: row.scrollWidth,
            rowClientWidth: row.clientWidth,
          };
        });
        expect(modelOptionMetrics.textScrollHeight).toBeLessThanOrEqual(
          modelOptionMetrics.textClientHeight + 2,
        );
        expect(modelOptionMetrics.lineClamp).toBe("2");
        expect(modelOptionMetrics.whiteSpace).toBe("normal");
        expect(modelOptionMetrics.rowScrollWidth).toBeLessThanOrEqual(
          modelOptionMetrics.rowClientWidth + 1,
        );
        const modelOptionRow = page
          .getByRole("option")
          .filter({ hasText: "Nintendo Switch OLED Model" })
          .first();
        await modelOptionRow.scrollIntoViewIfNeeded();
        await modelOptionRow.screenshot({
          path: `${screenshotDirectory}/inventory-game-console-390-long-model-list.png`,
        });
        await modelOptionRow.click();
        await expect(model).toHaveText("Nintendo Switch OLED Model");
        await expect(model).toHaveAccessibleName(/Nintendo Switch OLED Model/);
        const selectedTriggerMetrics = await model.evaluate((element) => {
          const value = element.querySelector<HTMLElement>("span");
          const arrow = element.querySelector<SVGElement>("svg");
          const valueRect = value?.getBoundingClientRect();
          const arrowRect = arrow?.getBoundingClientRect();
          return {
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            valueRight: valueRect?.right ?? 0,
            arrowLeft: arrowRect?.left ?? Number.POSITIVE_INFINITY,
          };
        });
        expect(selectedTriggerMetrics.scrollWidth).toBeLessThanOrEqual(
          selectedTriggerMetrics.clientWidth + 1,
        );
        expect(selectedTriggerMetrics.valueRight).toBeLessThanOrEqual(
          selectedTriggerMetrics.arrowLeft + 1,
        );
      }
    }
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("main, form, fieldset, [role='radiogroup']")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
  }));
  expect(result.document).toBeLessThanOrEqual(result.viewport);
  expect(result.offenders).toEqual([]);
}
