import { expect, test, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.skip(!enabled, "Set a RepairDesk E2E bypass flag for responsive route checks.");

const mobileInteractionsOnly = process.env.REPAIRDESK_E2E_MOBILE_INTERACTIONS === "1";
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 834, height: 1112 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
].filter(({ width }) => !mobileInteractionsOnly || width <= 430);

const routes = [
  "/",
  "/orders",
  "/orders/new",
  "/customers",
  "/buyback",
  "/inventory",
  "/messages",
  "/settings",
  "/account",
  "/platform",
];

const extendedMobileRoutes = [
  { path: "/orders/ord_1", ready: '[data-order-detail-root="true"]' },
  { path: "/orders/ord_1/task", ready: '[data-order-task-header="true"]' },
  { path: "/customers/cus_1", ready: "main" },
  { path: "/inventory/new", ready: "main" },
  { path: "/finance", ready: "main" },
  { path: "/memos", ready: "main" },
  { path: "/settings/closed-stores", ready: "main" },
  { path: "/login", ready: "main" },
  { path: "/forgot-password", ready: "main" },
  { path: "/reset-password", ready: "main" },
  { path: "/onboarding", ready: "main" },
  { path: "/register/complete", ready: "main" },
  { path: "/invite/complete", ready: "main" },
  { path: "/auth/confirm", ready: "main" },
  { path: "/offline", ready: "main" },
  { path: "/r", ready: "main" },
  { path: "/kiosk", ready: "main" },
] as const;

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

test.describe("responsive overflow guard", () => {
  for (const locale of ["it-IT", "en"] as const) {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
    ]) {
      test(`localized messages summary stays inside its mobile header in ${locale} at ${viewport.width}px`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page
          .context()
          .addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
        await gotoRouteReady(page, "/messages", "main");

        await expect(page.locator('[data-ui="repair-os-header-stepper"]')).toHaveCount(0);
        const summary = page.locator('[data-ui="repair-os-header-underline-nav"]');
        await expect(summary).toBeVisible();
        const geometry = await summary.evaluate((element) => {
          const container = element.getBoundingClientRect();
          const items = Array.from(element.children).map((child) => {
            const rect = child.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          });
          return {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            items,
            left: container.left,
            right: container.right,
          };
        });

        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
        expect(geometry.items).toHaveLength(3);
        for (const item of geometry.items) {
          expect(item.left).toBeGreaterThanOrEqual(geometry.left);
          expect(item.right).toBeLessThanOrEqual(geometry.right);
        }
        await expectNoPageOverflow(page);
      });
    }
  }

  for (const viewport of viewports) {
    test(`primary routes fit within ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);

      for (const route of routes) {
        await gotoRouteReady(page, route, "main");
        await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
        await expectNoPageOverflow(page);
      }
    });
  }

  for (const viewport of viewports.filter(({ width }) => width <= 430)) {
    test(`extended route inventory fits within ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);

      for (const route of extendedMobileRoutes) {
        await gotoRouteReady(page, route.path, route.ready);
        await expectNoPageOverflow(page);
      }
    });
  }

  test("mobile editable controls keep the iOS zoom guard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ["/orders/new", "/inventory/new"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page
        .locator("input, textarea, select")
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });
      const fontSizes = await page
        .locator("input:visible, textarea:visible, select:visible")
        .evaluateAll((elements) =>
          elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
        );
      expect(fontSizes.length, `${route} visible editable controls`).toBeGreaterThan(0);
      for (const fontSize of fontSizes)
        expect(fontSize, `${route} input font size`).toBeGreaterThanOrEqual(16);
    }
  });

  test("representative mobile actions follow semantic touch tiers and keep overlay footer reachable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/orders/ord_1/task", { waitUntil: "domcontentloaded" });
    await page
      .locator('[data-order-task-header="true"]')
      .waitFor({ state: "visible", timeout: 30_000 });
    await expectTargetSizes(
      page.locator(
        '[data-order-task-header="true"] button:visible, [data-order-task-actions="true"] button:visible, [data-order-task-transition-panel="true"] button:visible',
      ),
      "order task actions",
    );

    await page.goto("/inventory/new", { waitUntil: "domcontentloaded" });
    const intake = page.locator("main").last();
    await intake.locator("input").first().waitFor({ state: "visible", timeout: 30_000 });
    await expectTargetSizes(intake.locator("button:visible"), "inventory intake actions");
    await expectTargetSizes(
      intake.locator("input:visible, select:visible"),
      "inventory intake fields",
      38,
    );

    const saveButton = intake.getByRole("button", { name: "保存并查看商品" });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
    const saveBox = await saveButton.boundingBox();
    expect(saveBox).not.toBeNull();
    expect((saveBox?.y ?? 0) + (saveBox?.height ?? 0)).toBeLessThanOrEqual(844);
  });

  test("orders detail dialog keeps page width stable", async ({ page }) => {
    test.skip(mobileInteractionsOnly, "The interaction gate only runs the mobile route matrix.");
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/orders");
    await page.waitForLoadState("networkidle");

    const firstOrder = page
      .locator('[data-order-desktop-list="true"] [data-order-row="true"]')
      .first();
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

    await dialog.getByRole("tab", { name: /历史记录/ }).click();
    await expect(dialog.locator('[data-order-records-workspace="true"]')).toBeVisible();
    await page.waitForTimeout(250);
    const recordsBox = await dialog.boundingBox();
    expect(recordsBox).not.toBeNull();
    expect(Math.abs((recordsBox?.width ?? 0) - (overviewBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((recordsBox?.height ?? 0) - (overviewBox?.height ?? 0))).toBeLessThanOrEqual(1);
    await expectNoPageOverflow(page);
  });
});

async function expectTargetSizes(
  locator: ReturnType<Page["locator"]>,
  label: string,
  minimum = 24,
) {
  const sizes = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: Math.round(rect.height), width: Math.round(rect.width) };
    }),
  );
  expect(sizes.length, `${label} visible controls`).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.height, `${label} height`).toBeGreaterThanOrEqual(minimum);
    expect(size.width, `${label} width`).toBeGreaterThanOrEqual(minimum);
  }
}

async function gotoRouteReady(
  page: Page,
  path: string,
  readySelector: string,
  expectedPath = path,
) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  expect(new URL(page.url()).pathname, `${path} reaches its declared screen`).toBe(expectedPath);
  await page.locator(readySelector).first().waitFor({ state: "visible", timeout: 30_000 });
}
