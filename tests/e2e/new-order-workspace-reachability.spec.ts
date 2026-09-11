import { devices, expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires an isolated synthetic RepairDesk preview with no real credentials or drafts.",
);

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1180, height: 650 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];
const dialogSelector = '[data-new-order-dialog="true"]';
const bodySelector =
  '[data-new-order-scroll-body="true"], form[data-new-order-form="true"]:not(:has([data-new-order-scroll-body]))';

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height} workspace`, () => {
    test.use({
      viewport,
      hasTouch: viewport.width < 1280,
      contextOptions: { reducedMotion: "reduce" },
      actionTimeout: 10_000,
      ...(viewport.width < 1280
        ? {
            userAgent: devices[viewport.width < 768 ? "iPhone 13" : "iPad Pro 11"].userAgent,
          }
        : {}),
    });

    test("keeps top, close, every section and submit reachable through scroll and resize", async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const baseURL = String(testInfo.project.use.baseURL);
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === new URL(baseURL).origin
          ? route.continue()
          : route.abort(),
      );
      await page
        .context()
        .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL }]);
      // This test never submits an order; intercept writes defensively even on the synthetic server.
      await page.route("**/api/repairdesk/orders/create", (route) =>
        route.fulfill({
          status: 400,
          json: { error: { message: "Synthetic reachability test: creation disabled" } },
        }),
      );
      await page.goto("/orders", { waitUntil: "domcontentloaded" });
      const opener = page.getByRole("button", { name: "新建工单", exact: true });
      await expect(opener).toBeVisible();
      // Safari intentionally does not focus mouse-clicked buttons. Begin from a
      // keyboard-focused entry to test the explicit return-focus contract.
      await opener.focus();
      await opener.press("Enter");
      const dialog = page.locator(dialogSelector);
      const body = page.locator(bodySelector);
      await expect(dialog.locator('[data-new-order-submit-bar="true"]')).toBeVisible();
      await capture(page, testInfo, "open");
      await assertChromeReachable(page);
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(dialog).toBeFocused();

      // Repeat the open with the lazy editor cached: autofocus must still not scroll to a field.
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await opener.press("Enter");
      await expect(dialog.locator('[data-new-order-submit-bar="true"]')).toBeVisible();
      await expect(dialog).toBeFocused();
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0);

      for (let index = 0; index < 10; index++) {
        await dialog.getByRole("button", { name: "添加自定义项目", exact: true }).click();
      }
      const root = await dialog.locator('[data-new-order-root="true"]').elementHandle();
      const quote = dialog.getByLabel("报价项目 1 金额", { exact: true });
      await expect(quote).toHaveCount(1);
      if (await quote.evaluate((element) => element.tagName === "BUTTON")) {
        await quote.click();
        const keyboard = dialog.locator('[data-virtual-keyboard-dock="true"]');
        await expect(keyboard).toBeVisible();
        await keyboard.getByRole("button", { name: "8", exact: true }).click();
        await keyboard.getByRole("button", { name: "5", exact: true }).click();
        await assertChromeReachable(page);
        await capture(page, testInfo, "keypad");
        await page.keyboard.press("Escape");
        await expect(keyboard).toHaveCount(0);
        await expect(quote).toBeFocused();
      } else {
        await quote.fill("85");
      }
      await body.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await assertChromeReachable(page);
      await capture(page, testInfo, "deep-scroll");
      await expect(dialog.locator('[data-new-order-content-end="true"]')).toBeInViewport();

      for (const section of await dialog.locator("[data-new-order-section]:visible").all()) {
        await section.scrollIntoViewIfNeeded();
        await expect(section).toBeInViewport();
        await assertChromeReachable(page);
      }
      if (viewport.width < 768) {
        for (const panel of ["customer", "device", "settings"] as const) {
          await dialog.locator(`[data-mobile-edit="${panel}"]`).click();
          const sheet = page
            .getByRole("dialog")
            .filter({ has: page.locator(`[data-new-order-mobile-panel="${panel}"]`) });
          await expect(sheet).toBeInViewport();
          await sheet.getByRole("button", { name: "完成", exact: true }).click();
          await expect(sheet).toHaveCount(0);
          await assertChromeReachable(page);
        }
      }

      // Resize the same mounted editor, including portrait/landscape-like tablet transitions.
      const rotated =
        viewport.width < 768
          ? { width: viewport.width, height: 560 }
          : { width: viewport.height, height: viewport.width };
      await page.setViewportSize(rotated);
      await assertChromeReachable(page);
      expect(
        await root!.evaluate(
          (element) => element === document.querySelector('[data-new-order-root="true"]'),
        ),
      ).toBe(true);
      await expect(dialog.getByLabel("报价项目 1 金额", { exact: true })).toHaveCount(1);
      await page.setViewportSize(viewport);
      await body.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await assertChromeReachable(page);
      await capture(page, testInfo, "resized");
      // An unsaved synthetic photo makes the existing leave guard deterministic;
      // autosave may legitimately make text-only drafts clean before close.
      await dialog
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
          name: "synthetic-reachability.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
            "base64",
          ),
        });
      await expect(dialog.locator("[data-photo-state]")).toHaveCount(1);
      // Blur/save completes before requesting a guarded transition. Busy-save
      // suppression is a separate, unchanged business safeguard.
      await dialog.focus();
      await expect(dialog.locator('[data-new-order-offline-status="true"]:visible')).toContainText(
        "本机草稿已保存",
      );
      await dialog.locator('[data-new-order-dialog-close="true"]:visible').click();
      const leaveGuard = page.getByRole("alertdialog", { name: "当前设置尚未保存", exact: true });
      await expect(leaveGuard).toBeVisible();
      await assertHitTarget(leaveGuard.getByRole("button", { name: "取消", exact: true }));
      await leaveGuard.getByRole("button", { name: "取消", exact: true }).click();
      await expect(leaveGuard).toHaveCount(0);
      await assertChromeReachable(page);
      await dialog.locator('[data-new-order-dialog-close="true"]:visible').click();
      await leaveGuard.getByRole("button", { name: "放弃修改", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await opener.press("Enter");
      await expect(dialog.locator('[data-new-order-submit-bar="true"]')).toBeVisible();
      await assertChromeReachable(page);
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(errors).toEqual([]);
    });
  });
}

async function assertChromeReachable(page: Page) {
  const dialog = page.locator(dialogSelector);
  await assertHitTarget(dialog.locator('[data-new-order-dialog-close="true"]:visible'));
  await assertHitTarget(dialog.locator('[data-new-order-submit-bar="true"] button[type="submit"]'));
  const geometry = await page.evaluate((selector) => {
    const dialog = document.querySelector<HTMLElement>(selector)!;
    const rect = dialog.getBoundingClientRect();
    const workspace = dialog.querySelector<HTMLElement>('[data-new-order-root="true"]')!;
    const workspaceRect = workspace.getBoundingClientRect();
    const background = getComputedStyle(dialog).backgroundColor;
    const alphaPart = background.startsWith("rgba(")
      ? background.match(/,\s*([\d.]+)\s*\)$/)?.[1]
      : background.match(/\/\s*([\d.]+)\s*\)$/)?.[1];
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: innerWidth,
      height: innerHeight,
      scrolls: [
        dialog,
        dialog.querySelector("[data-new-order-root]")!,
        dialog.querySelector("form")!,
      ].map((element) => element.scrollTop),
      cornersCovered: [
        [1, 1],
        [innerWidth - 2, 1],
        [1, innerHeight - 2],
        [innerWidth - 2, innerHeight - 2],
      ].every(([x, y]) => dialog.contains(document.elementFromPoint(x, y))),
      backgroundAlpha: background === "transparent" ? 0 : alphaPart ? Number(alphaPart) : 1,
      innerInset: {
        top: workspaceRect.top,
        left: workspaceRect.left,
        bottom: innerHeight - workspaceRect.bottom,
        radius: Number.parseFloat(getComputedStyle(workspace).borderTopLeftRadius),
      },
      orderRowsBlocked: [...document.querySelectorAll<HTMLElement>('main a[href^="/orders/"]')]
        .map((row) => row.getBoundingClientRect())
        .filter((row) => row.width && row.y >= 0 && row.bottom <= innerHeight)
        .every((row) =>
          dialog.contains(document.elementFromPoint(row.x + row.width / 2, row.y + row.height / 2)),
        ),
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  }, dialogSelector);
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1);
  expect(
    geometry.cornersCovered,
    "order list must not be visible or hit-testable behind the workspace",
  ).toBe(true);
  expect(geometry.backgroundAlpha).toBe(1);
  expect(geometry.orderRowsBlocked).toBe(true);
  if (geometry.width >= 1280) {
    expect(geometry.innerInset.top).toBeGreaterThanOrEqual(16);
    expect(geometry.innerInset.left).toBeGreaterThanOrEqual(16);
    expect(geometry.innerInset.bottom).toBeGreaterThanOrEqual(16);
    expect(geometry.innerInset.radius).toBeGreaterThan(0);
  }
  expect(geometry.scrolls).toEqual([0, 0, 0]);
  expect(geometry.pageOverflow).toBe(false);
}

async function assertHitTarget(target: Locator) {
  await expect(target).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
    )
    .toBe(true);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshotPath, animations: "disabled" });
  await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
  const data = await page.locator(dialogSelector).evaluate((dialog) => ({
    viewport: { width: innerWidth, height: innerHeight, visualHeight: visualViewport?.height },
    activeElement: document.activeElement?.tagName,
    nodes: [
      dialog,
      ...dialog.querySelectorAll(
        "[data-new-order-root], [data-new-order-form], [data-new-order-scroll-body], [data-new-order-dialog-close], [data-new-order-submit-bar]",
      ),
    ].map((node) => ({
      attributes: (node as HTMLElement).dataset,
      rect: node.getBoundingClientRect().toJSON(),
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    })),
  }));
  const geometryPath = testInfo.outputPath(`${name}-geometry.json`);
  await writeFile(geometryPath, JSON.stringify(data, null, 2));
  await testInfo.attach(`${name}-geometry`, {
    path: geometryPath,
    contentType: "application/json",
  });
}
