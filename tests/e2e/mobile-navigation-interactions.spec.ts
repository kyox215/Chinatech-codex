import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set a RepairDesk E2E bypass flag for mobile interaction checks.");

test.describe("mobile navigation interaction reliability", () => {
  test.use({ isMobile: true, hasTouch: true });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`${viewport.width}px keeps account controls interactive after nested menu navigation`, async ({
      page,
    }, testInfo) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setViewportSize(viewport);
      await gotoWithStableStoreShell(page, "/buyback");

      const listMenuTrigger = page.locator(
        '[data-sidebar="trigger"][aria-label="打开导航菜单"]:visible',
      );
      await expect(listMenuTrigger).toHaveCount(1);
      await expectCenterHitsControl(listMenuTrigger);
      await tapCenter(page, listMenuTrigger);

      const navigationDialog = page.getByRole("dialog", { name: "导航菜单" });
      await expect(navigationDialog).toBeVisible();

      const accountMenuTrigger = navigationDialog.locator(
        '[data-sidebar="footer"] [data-sidebar="menu-button"]',
      );
      await expect(accountMenuTrigger).toHaveCount(1);
      await expectCenterHitsControl(accountMenuTrigger);
      await tapCenter(page, accountMenuTrigger);

      const settingsLink = page.locator('[role="menu"] a[href="/settings"]');
      await expect(settingsLink).toHaveCount(1);
      await expect(page.locator('[role="menu"] a[href="/account"]')).toHaveCount(1);
      await expect(page.locator('[role="menu"] a[href="/platform"]')).toHaveCount(0);
      await expect(settingsLink).toBeVisible();
      await tapCenter(page, settingsLink);

      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
      await expect(page.locator('[data-app-bar-context="true"]')).toHaveText("设置");
      await expect(navigationDialog).toBeHidden();

      expect(
        await page.evaluate(() => document.body.style.pointerEvents),
        "nested Radix layers must release the document pointer lock after navigation",
      ).not.toBe("none");

      const accountPageMenuTrigger = page.locator(
        '[data-sidebar="trigger"][aria-label="打开导航菜单"]:visible',
      );
      await expect(accountPageMenuTrigger).toHaveCount(1);
      await expectCenterHitsControl(accountPageMenuTrigger);
      await tapCenter(page, accountPageMenuTrigger);
      await expect(page.getByRole("dialog", { name: "导航菜单" })).toBeVisible();

      const captureEvidence =
        process.env.REPAIRDESK_CAPTURE_TASK_SCREENSHOT === "1" && viewport.width === 390;
      if (captureEvidence) {
        await page.waitForTimeout(250);
        await hideNextDevIndicator(page);
        await page.screenshot({
          path: `screenshots/TASK-20260712-002-mobile-interaction-click-reliability/account-menu-open-${testInfo.project.name}-390.png`,
        });
      }

      await page.touchscreen.tap(viewport.width - 4, Math.round(viewport.height / 2));
      await expect(page.getByRole("dialog", { name: "导航菜单" })).toBeHidden();

      if (captureEvidence) {
        await page.screenshot({
          path: `screenshots/TASK-20260712-002-mobile-interaction-click-reliability/account-page-${testInfo.project.name}-390.png`,
          fullPage: true,
        });
      }

      await gotoWithStableStoreShell(page, "/account");
      const displayName = page.getByLabel("显示名称", { exact: true });
      await expect(displayName).toBeVisible();
      await expectCenterHitsControl(displayName);
      await displayName.fill("移动端交互测试");
      await expect(displayName).toHaveValue("移动端交互测试");
      await expectEnabledAccountControlsReachable(page);

      const passwordButton = page.getByRole("button", { name: "更新密码" });
      await expect(passwordButton).toBeEnabled();
      await expectCenterHitsControl(passwordButton);
      await tapCenter(page, passwordButton);
      await expect(page.getByText("请输入当前密码", { exact: true })).toBeVisible();

      const overflow = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
      expect(pageErrors).toEqual([]);
    });
  }

  test("quick action modal handoff releases its pointer lock", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithStableStoreShell(page, "/account");
    await expect(page.getByRole("heading", { name: "账号资料" })).toBeVisible();

    const quickActionTrigger = page.getByRole("button", { name: "打开快捷操作" });
    await expectCenterHitsControl(quickActionTrigger);
    await tapCenter(page, quickActionTrigger);

    const quickActionDialog = page.getByRole("dialog", { name: "快捷操作" });
    await expect(quickActionDialog).toBeVisible();
    const globalSearchAction = quickActionDialog.getByRole("button", { name: /全局搜索/ });
    await expectCenterHitsControl(globalSearchAction);
    await tapCenter(page, globalSearchAction);

    await expect(quickActionDialog).toBeHidden();
    await expect(page.getByPlaceholder("输入命令、搜索工单或客户…")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("输入命令、搜索工单或客户…")).toBeHidden();
    expect(await page.evaluate(() => document.body.style.pointerEvents)).not.toBe("none");
    await expectCenterHitsControl(quickActionTrigger);
    expect(pageErrors).toEqual([]);
  });
});

async function gotoWithStableStoreShell(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('[data-app-bar="true"]')).toContainText("Demo Repair Store");
}

async function tapCenter(page: Page, locator: Locator) {
  let centerX = 0;
  let centerY = 0;
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box, "touch target should have a bounding box").not.toBeNull();
    if (box) {
      centerX = box.x + box.width / 2;
      centerY = box.y + box.height / 2;
    }
  }).toPass({ timeout: 5_000 });
  await page.touchscreen.tap(centerX, centerY);
}

async function expectCenterHitsControl(locator: Locator) {
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded();
    const result = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const target = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return {
        hitsSelf: target === element || element.contains(target),
        targetTag: target?.tagName ?? null,
        targetText: target?.textContent?.trim().slice(0, 80) ?? null,
      };
    });

    expect(result.hitsSelf, `control center should hit itself: ${JSON.stringify(result)}`).toBe(
      true,
    );
  }).toPass({ timeout: 5_000 });
}

async function expectEnabledAccountControlsReachable(page: Page) {
  const controls = page.locator(
    [
      "main button:not([disabled])",
      "main a[href]",
      "main input:not([disabled])",
      "main textarea:not([disabled])",
      "main select:not([disabled])",
    ].join(","),
  );
  const count = await controls.count();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (await control.isVisible()) await expectCenterHitsControl(control);
  }
}

async function hideNextDevIndicator(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("nextjs-portal").forEach((portal) => {
      portal.style.display = "none";
    });
  });
}
