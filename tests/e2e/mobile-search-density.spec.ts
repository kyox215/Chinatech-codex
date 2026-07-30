import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260729-009-quick-order-mobile-density";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for mobile search checks.");
test.use({ isMobile: true, hasTouch: true });

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 440, height: 956 },
]) {
  test(`shared and order searches stay compact at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);

    await gotoApp(page, "/customers");
    const customerSearch = page.getByRole("textbox", { name: "姓名、电话或设备" });
    await expectEmbeddedSearch(customerSearch);
    await expectNoOverflow(page);

    await gotoApp(page, "/orders");
    const orderSearch = page.getByRole("textbox", {
      name: "搜索工单、客户、电话或 IMEI",
    });
    await expect(orderSearch).toHaveAttribute("placeholder", "工单 / 客户 / IMEI");
    await expectEmbeddedSearch(orderSearch);

    for (const actionName of [/订单扫码查询/, /筛选订单/]) {
      const action = page.getByRole("button", { name: actionName });
      const box = await action.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await expectNoOverflow(page);
    if (viewport.width === 390) {
      await page.screenshot({
        path: `${evidenceDir}/orders-search-compact-${testInfo.project.name}-${viewport.width}x${viewport.height}.png`,
        clip: { x: 0, y: 0, width: viewport.width, height: 260 },
      });
    }

    await gotoApp(page, "/account");
    const globalSearch = page.getByRole("button", { name: "打开全局搜索" });
    const globalSearchBox = await globalSearch.boundingBox();
    expect(globalSearchBox?.width).toBeGreaterThanOrEqual(44);
    expect(globalSearchBox?.height).toBeGreaterThanOrEqual(44);
    await globalSearch.click();

    const commandInput = page.getByPlaceholder("输入命令、搜索工单或客户…");
    await expect(commandInput).toBeVisible();
    expect(await commandInput.evaluate((element) => getComputedStyle(element).fontSize)).toBe(
      "16px",
    );
    expect((await commandInput.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");

    await expectNoOverflow(page);
  });
}

async function gotoApp(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("interrupted by another navigation")
      ) {
        throw error;
      }
    }

    if (new URL(page.url()).pathname === path) {
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      return;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Unable to settle navigation on ${path}; last URL was ${page.url()}`);
}

async function expectEmbeddedSearch(input: Locator) {
  await expect(input).toBeVisible({ timeout: 20_000 });
  expect(await input.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
  const inputBox = await input.boundingBox();
  expect(inputBox?.height).toBeGreaterThanOrEqual(44);

  const shell = input.locator("..");
  await expect(shell).toHaveClass(/bg-\[var\(--surface-panel-muted\)\]/);
  await expect(shell).not.toHaveClass(/border/);
  expect((await shell.boundingBox())?.height).toBeGreaterThanOrEqual(44);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
