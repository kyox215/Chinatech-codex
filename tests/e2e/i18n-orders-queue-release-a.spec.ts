import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { CACHE_TIMES } from "@/lib/query-performance";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
if (process.env.CI && !enabled) {
  throw new Error("Release A i18n CI requires REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = resolve(
  process.env.REPAIRDESK_I18N_EVIDENCE_DIR ?? "test-results/i18n-orders-queue-release-a",
);
const writesByPage = new WeakMap<Page, string[]>();

function isForbiddenWrite(method: string, requestUrl: string) {
  const url = new URL(requestUrl, baseURL);
  if (url.origin !== new URL(baseURL).origin) return false;
  if (!url.pathname.startsWith("/api/repairdesk/")) return false;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (
    method === "POST" &&
    [
      "/api/repairdesk/orders/queue-summary",
      "/api/repairdesk/dashboard/priority-summary",
      "/api/repairdesk/order/get",
    ].includes(url.pathname)
  ) {
    return false;
  }
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for Release A mock UI checks.");

test.beforeEach(async ({ page }) => {
  const writes: string[] = [];
  writesByPage.set(page, writes);
  page.on("request", (request) => {
    if (isForbiddenWrite(request.method(), request.url())) writes.push(request.url());
  });
});

test("write detector permits read-only queue summary and catches mutations", () => {
  expect(isForbiddenWrite("POST", `${baseURL}/api/repairdesk/order/batch-transition`)).toBe(true);
  expect(isForbiddenWrite("POST", `${baseURL}/api/repairdesk/orders/queue-summary`)).toBe(false);
  expect(isForbiddenWrite("POST", `${baseURL}/api/repairdesk/dashboard/priority-summary`)).toBe(
    false,
  );
  expect(isForbiddenWrite("POST", `${baseURL}/api/repairdesk/order/get`)).toBe(false);
  expect(isForbiddenWrite("GET", `${baseURL}/api/repairdesk/order/batch-transition`)).toBe(false);
});

test("dashboard Release A copy stays localized across desktop to mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  const desktopQuickStart = page.locator('[data-ui="dashboard-quick-start-desktop"]');
  await expect(desktopQuickStart).toBeVisible();
  await expect(desktopQuickStart.getByText("Nuovo ordine rapido", { exact: true })).toBeVisible();
  await expect(page.getByText("Cosa gestire ora", { exact: true })).toBeVisible();
  const priorityFilter = page.locator('[data-dashboard-priority-filter="overdue"]');
  await priorityFilter.click();
  await expect(priorityFilter).toHaveAttribute("aria-pressed", "true");
  const initialUrl = page.url();
  await page.evaluate(() => {
    Object.assign(window, { __repairDeskDashboardLocaleIdentity: "same-document" });
  });
  await page.locator('[data-language-switcher-trigger="true"]:visible').click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(page.url()).toBe(initialUrl);
  expect(
    await page.evaluate(() => Reflect.get(window, "__repairDeskDashboardLocaleIdentity")),
  ).toBe("same-document");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-ui="dashboard-quick-start-mobile"]')).toBeVisible();
  await expect(page.getByText("Quick order", { exact: true })).toBeVisible();
  await expect(page.getByText("Process next", { exact: true })).toBeVisible();
  await expect(page.locator('[data-dashboard-priority-filter="overdue"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoHorizontalOverflow(page);
  expect(writesByPage.get(page)).toEqual([]);
});

test("it-IT desktop Orders queue renders localized mock UI without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
  await expect(page.getByRole("heading", { name: "Ordini di riparazione" })).toBeVisible();
  await expect(page.getByText("Da gestire ora", { exact: true })).toBeVisible();
  await expect(page.locator('[data-order-desktop-list="true"]')).toBeVisible();
  await expect(page.locator('[data-order-row="true"]').first()).toBeVisible();
  const queueLabels = await page.locator("[data-order-queue-stage]").allTextContents();
  expect(queueLabels.every((label) => !/[一-龥]/.test(label))).toBe(true);
  await expectNoHorizontalOverflow(page);
  const lastOrderRow = page.locator('[data-order-row="true"]').last();
  await expect
    .poll(() => lastOrderRow.evaluate((element) => getComputedStyle(element).opacity), {
      timeout: 5_000,
    })
    .toBe("1");
  await page.screenshot({
    path: resolve(evidenceDir, "italian-orders-queue-desktop-1440.png"),
  });
  expect(writesByPage.get(page)).toEqual([]);
});

test("en mobile Orders filters dialog renders localized mock UI without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-order-mobile-card="true"]').first()).toBeVisible();
  const filter = page.getByRole("button", { name: /filter orders/i });
  await filter.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveText(/Filter repair orders/);
  await expect(dialog).toContainText(
    "Filters only change the current list; they do not modify orders.",
  );
  for (const label of ["Order type", "Payment status", "Needs priority", "Assignee"]) {
    await expect(dialog).toContainText(label);
  }
  for (const label of ["Quote overdue", "Pickup overdue"]) {
    const button = dialog.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
  }
  await expect(dialog.getByRole("button", { name: "Close filters" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(evidenceDir, "english-orders-filter-mobile-390.png"),
  });
  expect(writesByPage.get(page)).toEqual([]);
});

test("zh-CN Orders read failure uses safe localized error copy", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL }]);
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "SERVER_SECRET_ERROR" }),
    }),
  );
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(page.locator('[data-ui="order-list-error-state"]')).toContainText(
    /订单暂时无法加载|工单加载失败/,
  );
  await expect(page.locator("body")).not.toContainText("SERVER_SECRET_ERROR");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(evidenceDir, "chinese-orders-read-error-tablet-768.png"),
  });
  expect(writesByPage.get(page)).toEqual([]);
});

test("Orders language switch preserves search URL document and scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(page.locator('[data-order-row="true"]').first()).toBeVisible();
  const queueFilter = page.locator('[data-order-desktop-flow-rail="true"] button').nth(1);
  await expect(queueFilter).toBeVisible();
  await queueFilter.click();
  await expect(queueFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-order-row="true"]').first()).toBeVisible();

  const search = page.getByRole("textbox", {
    name: "Cerca ordine, cliente, telefono o IMEI",
  });
  await expect(search).toBeVisible();
  await search.fill("R");
  await expect(search).toHaveValue("R");
  await page.waitForTimeout(500);
  const selectedCheckbox = page.locator('[data-order-row="true"]').first().getByRole("checkbox");
  await selectedCheckbox.check();
  await expect(selectedCheckbox).toBeChecked();

  await page.evaluate(() => {
    Object.assign(window, { __repairDeskOrdersLocaleIdentity: "same-document" });
    const spacer = document.createElement("div");
    spacer.dataset.i18nOrdersScrollFixture = "true";
    spacer.style.height = "1200px";
    document.body.append(spacer);
    window.scrollTo({ top: 240, behavior: "auto" });
  });
  const initialUrl = page.url();
  const initialFilterPressed = await queueFilter.getAttribute("aria-pressed");
  const initialScrollY = await page.evaluate(() => window.scrollY);
  expect(initialScrollY).toBeGreaterThan(0);

  await page
    .locator('[data-language-switcher-trigger="true"]:visible')
    .dispatchEvent("pointerdown", { button: 0, ctrlKey: false, pointerType: "mouse" });
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("textbox", { name: "Search order, customer, phone, or IMEI" }),
  ).toHaveValue("R");
  await expect(page.locator('[data-order-row="true"]').first().getByRole("checkbox")).toBeChecked();
  await expect(queueFilter).toHaveAttribute("aria-pressed", initialFilterPressed ?? "false");
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => Reflect.get(window, "__repairDeskOrdersLocaleIdentity"))).toBe(
    "same-document",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);
  expect(writesByPage.get(page)).toEqual([]);
});

test("Orders pagination remains on page two after switching language", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL }]);
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body?.data?.list || typeof body.data.list !== "object") {
      throw new Error("Unexpected queue-summary response envelope");
    }
    const pageSize = Number(body.data.list.pageSize) || 20;
    body.data.list.pageCount = 2;
    body.data.list.total = Math.max(Number(body.data.list.total) || 0, pageSize * 2);
    await route.fulfill({ response, json: body });
  });
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(page.locator('[data-order-row="true"]').first()).toBeVisible();
  const allOrdersView = page.getByRole("button", { name: "Tutti gli ordini", exact: true });
  await allOrdersView.click();
  await expect(allOrdersView).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-order-row="true"]').first()).toBeVisible();
  const nextPage = page.getByRole("button", { name: "Pagina successiva", exact: true });
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  const initialUrl = page.url();
  await page.locator('[data-language-switcher-trigger="true"]:visible').click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "All orders", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  expect(page.url()).toBe(initialUrl);
  expect(writesByPage.get(page)).toEqual([]);
});

test("Orders offline with no cache uses localized availability copy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
  });
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(
    page.getByText("Offline: no orders are available in cache.", { exact: false }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(writesByPage.get(page)).toEqual([]);
});

test("Orders cached data reports a localized refresh failure after reconnect", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
  let requestCount = 0;
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "CONTROLLED_REFRESH_FAILURE" }),
    });
  });
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  const firstRow = page.locator('[data-order-row="true"]').first();
  await expect(firstRow).toBeVisible();
  await page.waitForTimeout(CACHE_TIMES.hotList + 250);
  await page.context().setOffline(true);
  await expect(
    page.getByText("Offline: showing the latest available data.", { exact: true }),
  ).toBeVisible();
  await expect(firstRow).toBeVisible();
  await page.context().setOffline(false);
  await expect(
    page.getByText("Order refresh failed; showing the last data.", { exact: true }),
  ).toBeVisible();
  await expect(firstRow).toBeVisible();
  await expect(page.locator("body")).not.toContainText("CONTROLLED_REFRESH_FAILURE");
  expect(writesByPage.get(page)).toEqual([]);
});

test("Orders permissions response hides restricted controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL }]);
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body?.data?.options?.permissions) {
      throw new Error("Unexpected queue-summary permissions envelope");
    }
    body.data.options.permissions = Object.fromEntries(
      Object.keys(body.data.options.permissions).map((key) => [key, false]),
    );
    await route.fulfill({ response, json: body });
  });
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await hideNextDevIndicator(page);
  await expect(page.locator('[data-order-desktop-list="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "All history", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bulk transition", exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Filter orders/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("External supplier");
  await expectNoHorizontalOverflow(page);
  expect(writesByPage.get(page)).toEqual([]);
});

async function hideNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal,[data-nextjs-dialog],#__next-build-watcher{display:none!important}",
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
