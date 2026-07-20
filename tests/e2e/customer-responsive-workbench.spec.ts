import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for customer workbench checks.");

test.describe("customer responsive workbench", () => {
  for (const viewport of viewports) {
    test(`keeps the simple list and detail workbench at ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      await gotoCustomers(page);

      const visibleGroups = page.locator('[aria-label="客户分组"]:visible button');
      await expect(visibleGroups).toHaveCount(4);
      await expectNoPageOverflow(page);

      if (viewport.width >= 1024) {
        await expect(page.locator("table")).toBeVisible();
      } else {
        await expect(page.locator('[data-ui="customer-mobile-name"]').first()).toBeVisible();
        await expect(page.locator("table")).not.toBeVisible();
      }

      await openCustomerDetail(page, viewport.width);
      const visibleTabs = page.locator('[role="tablist"][aria-label="客户详情分组"]:visible');
      await expect(visibleTabs.getByRole("tab")).toHaveCount(5);
      await expect(page.locator('[role="tabpanel"]:visible')).toHaveAttribute("aria-label", /.+/);

      if (viewport.width < 1024) {
        await expect(page.getByRole("link", { name: "新建工单" })).toBeVisible();
        await expect(page.getByRole("button", { name: "发消息" })).toBeVisible();
        await expect(page.getByRole("button", { name: "加待办" })).toBeVisible();
        await expect(page.getByRole("button", { name: "打开快捷操作" })).toHaveCount(0);
      }

      const tabsBeforeScroll = await visibleTabs.boundingBox();
      await scrollDetailContent(page);
      const tabsAfterScroll = await visibleTabs.boundingBox();
      expect(tabsBeforeScroll).not.toBeNull();
      expect(tabsAfterScroll).not.toBeNull();
      expect(Math.abs((tabsAfterScroll?.y ?? 0) - (tabsBeforeScroll?.y ?? 0))).toBeLessThanOrEqual(
        1,
      );
      await expect(visibleTabs).toBeVisible();
      await expectNoPageOverflow(page);
    });
  }

  test("restores the selected group through the URL", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoCustomers(page);
    await page.getByRole("button", { name: /要跟进/ }).click();
    await expect(page).toHaveURL(/\/customers\?group=followup/);
    await page.reload();
    await expect(page.getByRole("button", { name: /要跟进/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("returns from mobile detail to the same customer group", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/customers?group=active", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /处理中/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await openCustomerDetail(page, 390);
    await page.getByRole("button", { name: "返回客户列表" }).click();
    await expect(page).toHaveURL(/\/customers\?group=active/);
    await expect(page.getByRole("button", { name: /处理中/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

async function gotoCustomers(page: Page) {
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("main input:visible")).toBeVisible({
    timeout: 30_000,
  });
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function openCustomerDetail(page: Page, width: number) {
  if (width >= 1024) {
    await page
      .getByRole("button", { name: /^查看客户 / })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    return;
  }
  await page.locator('a[aria-label^="打开客户详情："]').first().click();
  await expect(page).toHaveURL(/\/customers\/[^?]+/);
}

async function scrollDetailContent(page: Page) {
  await page.locator('[role="tabpanel"]:visible').evaluate((panel) => {
    let node = panel.parentElement;
    while (node) {
      const style = window.getComputedStyle(node);
      if (/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        node.scrollTop = node.scrollHeight;
        return;
      }
      node = node.parentElement;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
}
