import { mkdirSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

const screenshotDir = "screenshots/TASK-20260708-003-new-order-dropdowns";
const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for new order mobile touch checks.");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("new order dropdown arrows distinguish touch scroll from tap", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", "CDP touch drag verification is Chromium-only.");
  mkdirSync(screenshotDir, { recursive: true });

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('[data-new-order-form="true"]')).toBeVisible();

  const brandTrigger = page.getByRole("button", { name: "选择品牌" });
  await tapTriggerAndExpectMenu(page, brandTrigger, /Apple/);
  await page.getByRole("menuitem", { name: "Apple" }).click();

  const modelTrigger = page.getByRole("button", { name: "选择型号" });
  await tapTriggerAndExpectMenu(page, modelTrigger, /iPhone/);
  await page
    .getByRole("menuitem", { name: /iPhone/ })
    .first()
    .click();

  const faultTrigger = page.getByRole("button", { name: "展开屏幕细分选项" });
  await tapTriggerAndExpectMenu(page, faultTrigger, /外屏碎裂/);

  await expectTouchDragDoesNotOpen(page, brandTrigger, /Apple/);
  await expectTouchDragDoesNotOpen(page, modelTrigger, /iPhone/);
  await expectTouchDragDoesNotOpen(page, faultTrigger, /外屏碎裂/);

  await expectNoPageOverflow(page);
  await page.screenshot({
    path: `${screenshotDir}/new-order-mobile-dropdown-touch-safe.png`,
    fullPage: true,
  });
});

async function expectTouchDragDoesNotOpen(page: Page, trigger: Locator, optionText: RegExp) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await centerTriggerInViewport(page, trigger);
  await dispatchTouchDrag(page, trigger, -56);
  await page.waitForTimeout(160);

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByText(optionText)).toHaveCount(0);
}

async function tapTriggerAndExpectMenu(page: Page, trigger: Locator, optionText: RegExp) {
  await centerTriggerInViewport(page, trigger);
  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();

  await dispatchTouchTap(
    page,
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menu").getByText(optionText).first()).toBeVisible();
}

async function dispatchTouchTap(page: Page, x: number, y: number) {
  const session = await page.context().newCDPSession(page);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function dispatchTouchDrag(page: Page, trigger: Locator, deltaY: number) {
  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const startY = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  const session = await page.context().newCDPSession(page);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX, y: startY + deltaY * 0.5 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX, y: startY + deltaY }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function centerTriggerInViewport(page: Page, trigger: Locator) {
  await trigger.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
  });
  await page.waitForTimeout(120);
  await expect(trigger).toBeVisible();
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
