import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_ORDER_TRANSITION_SCROLL === "1";
const viewports = [
  { width: 1024, height: 600 },
  { width: 1280, height: 720 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_TRANSITION_SCROLL=1 for this regression.");

test.describe("order transition panel vertical scrolling", () => {
  for (const viewport of viewports) {
    test(`keeps other reason and confirmation reachable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      await gotoReady(page, "/orders");

      const desktopList = page.locator('[data-order-desktop-list="true"]');
      await expect(desktopList).toBeVisible();
      const row = await firstVisible(desktopList.locator('[data-order-row="true"]'));
      await row.click();

      const detail = page.getByRole("dialog", { name: "工单详情" });
      await expect(detail).toBeVisible();
      await clickFirstVisible(detail.getByRole("button", { name: "流转" }));

      const panel = detail.locator('[data-order-desktop-transition-panel="true"]');
      await expect(panel).toBeVisible();
      await expect(panel).toBeFocused();
      const scrollOwner = detail.locator('[data-order-detail-scroll="true"]');
      await expect(scrollOwner).toHaveCount(1);
      await clickFirstVisible(panel.getByRole("button", { name: /已取消|取消工单/ }));
      await clickFirstVisible(panel.getByRole("button", { name: /查看全部/ }));
      await panel.getByRole("radio", { name: /其他原因/ }).click();

      const note = panel.locator('[data-order-other-reason="true"]');
      const confirm = panel.getByRole("button", { name: "确认流转" });
      await expect(note).toBeVisible();
      await expectManualScroll(page, scrollOwner);
      await note.scrollIntoViewIfNeeded();
      await confirm.scrollIntoViewIfNeeded();
      await expectRectInsideScroller(note, scrollOwner);
      await expectRectInsideScroller(confirm, scrollOwner);
      await note.fill("短窗口滚动回归验证");
      await expect(confirm).toBeEnabled();

      const scrollState = await scrollOwner.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      }));
      expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
      expect(scrollState.scrollTop).toBeGreaterThan(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `transition-inline-other-${viewport.width}x${viewport.height}.png`,
        ),
      });

      await clickFirstVisible(panel.getByRole("button", { name: "收起状态流转" }));
      await expect(detail.getByRole("button", { name: "流转", exact: true })).toBeFocused();
      await clickFirstVisible(detail.getByRole("button", { name: "更多工单操作" }));
      await clickFirstVisible(page.getByRole("menuitem", { name: "取消工单" }));
      const cancelOverlay = page.locator('[data-order-cancel-overlay="true"]');
      await expect(cancelOverlay).toBeVisible();
      await clickFirstVisible(cancelOverlay.getByRole("button", { name: /查看全部/ }));
      await cancelOverlay.getByRole("radio", { name: /其他原因/ }).click();
      const overlayScrollOwner = cancelOverlay.locator('[data-order-action-scroll-body="true"]');
      const overlayNote = cancelOverlay.locator('[data-order-other-reason="true"]');
      const overlayConfirm = cancelOverlay.getByRole("button", { name: "确认取消" });
      const overlayScrolled = await expectManualScroll(page, overlayScrollOwner);
      if (viewport.height <= 600) expect(overlayScrolled).toBe(true);
      await overlayNote.scrollIntoViewIfNeeded();
      await overlayConfirm.scrollIntoViewIfNeeded();
      await expectRectInsideScroller(overlayNote, overlayScrollOwner);
      await expectRectInsideViewport(overlayConfirm);
      await page.screenshot({
        path: testInfo.outputPath(`cancel-overlay-other-${viewport.width}x${viewport.height}.png`),
      });
    });
  }

  test("keeps the mobile other reason reachable in a short viewport", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 500 });
    await gotoReady(page, "/orders/ord_47");

    await clickFirstVisible(page.getByRole("button", { name: "流转" }));
    const sheet = page.getByRole("dialog", { name: "状态流转" });
    await expect(sheet).toBeVisible();
    await clickFirstVisible(sheet.getByRole("button", { name: /已取消|取消工单/ }));
    await clickFirstVisible(sheet.getByRole("button", { name: /查看全部/ }));
    await sheet.getByRole("radio", { name: /其他原因/ }).click();

    const scrollOwner = sheet.locator('[data-order-transition-scroll-body="true"]');
    const note = sheet.locator('[data-order-other-reason="true"]');
    const confirm = sheet.getByRole("button", { name: "确认流转" });
    await expectManualScroll(page, scrollOwner);
    await note.scrollIntoViewIfNeeded();
    await confirm.scrollIntoViewIfNeeded();
    await expectRectInsideScroller(note, scrollOwner);
    await expectRectInsideScroller(confirm, scrollOwner);
    await note.fill("移动短窗口滚动回归验证");
    await expect(confirm).toBeEnabled();

    const geometry = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      return { top: rect.top, bottom: rect.bottom, viewportTop, viewportHeight };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.viewportTop - 1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportTop + geometry.viewportHeight + 1);
    await page.screenshot({ path: testInfo.outputPath("transition-other-mobile-390x500.png") });
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

async function expectManualScroll(page: Page, scroller: Locator) {
  const canScroll = await scroller.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  if (!canScroll) return false;
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await scroller.hover({ position: { x: 20, y: 20 } });
  for (let index = 0; index < 4; index += 1) {
    await page.mouse.wheel(0, 700);
  }
  await expect
    .poll(() =>
      scroller.evaluate(
        (element) => element.scrollTop >= element.scrollHeight - element.clientHeight - 1,
      ),
    )
    .toBe(true);
  return true;
}

async function firstVisibleIndex(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await locator
        .nth(index)
        .isVisible()
        .catch(() => false)
    )
      return index;
  }
  return -1;
}

async function expectRectInsideScroller(target: Locator, scroller: Locator) {
  const result = await target.evaluate(
    (element, scrollElement) => {
      const rect = element.getBoundingClientRect();
      const scrollRect = (scrollElement as HTMLElement).getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        scrollTop: scrollRect.top,
        scrollBottom: scrollRect.bottom,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight,
        viewportTop: window.visualViewport?.offsetTop ?? 0,
      };
    },
    await scroller.elementHandle(),
  );

  expect(result.top).toBeGreaterThanOrEqual(result.scrollTop - 1);
  expect(result.bottom).toBeLessThanOrEqual(result.scrollBottom + 1);
  expect(result.top).toBeGreaterThanOrEqual(result.viewportTop - 1);
  expect(result.bottom).toBeLessThanOrEqual(result.viewportTop + result.viewportHeight + 1);
}

async function expectRectInsideViewport(target: Locator) {
  const result = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportTop: window.visualViewport?.offsetTop ?? 0,
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
    };
  });
  expect(result.top).toBeGreaterThanOrEqual(result.viewportTop - 1);
  expect(result.bottom).toBeLessThanOrEqual(result.viewportTop + result.viewportHeight + 1);
}
