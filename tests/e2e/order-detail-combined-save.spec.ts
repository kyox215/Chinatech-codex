import { expect, test, type Locator } from "@playwright/test";

import { getRepairServiceCatalogItem } from "@/entities/order/model/repair-service-catalog";
import { translateMessage } from "@/shared/i18n/messages";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_EDIT_SAVE === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_EDIT_SAVE=1 for combined order save checks.");
test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});

test("customer and quote groups save only their own fields with the latest order version", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60_000);
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
  await page.setViewportSize({ width: 1280, height: 800 });

  const requestOrder: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (request.url().includes("/api/repairdesk/order/patch")) requestOrder.push("routine");
    if (request.url().includes("/api/repairdesk/order/finance")) requestOrder.push("finance");
  });

  // The legacy synthetic fixture uses display labels that predate catalog validation.
  // Normalize this test's GET copy only; production data, schema and save behavior stay unchanged.
  await page.route("**/api/repairdesk/order/get", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.order.fault_prices = payload.data.order.fault_prices.map(
      (item: { catalog_key?: string; name: string }) => ({
        ...item,
        name: getRepairServiceCatalogItem(item.catalog_key)?.name ?? item.name,
      }),
    );
    await route.fulfill({ response, json: payload });
  });

  const initialResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/repairdesk/order/get"),
  );
  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  const initialPayload = await (await initialResponsePromise).json();
  const detail = page.locator('[data-order-detail-root="true"][data-order-detail-surface="page"]');
  await expect(detail).toBeVisible();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  await detail.getByRole("button", { name: "客户信息", exact: true }).click();
  const customer = page.locator('[data-order-identity-editor="customer"]');
  const updatedName = `Mock scoped save verification ${Date.now()}`;
  await customer.getByRole("textbox", { name: "姓名", exact: true }).fill(updatedName);
  const routineResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/repairdesk/order/patch"),
  );
  await customer.getByRole("button", { name: "保存", exact: true }).click();
  const routineResponse = await routineResponsePromise;
  expect(routineResponse.ok(), await routineResponse.text()).toBe(true);
  const routineRequest = routineResponse.request().postDataJSON();
  expect(routineRequest.input.expected_updated_at).toBe(initialPayload.data.order.updated_at);
  expect(routineRequest.input.expected_customer_updated_at).toBe(
    initialPayload.data.customer.updated_at,
  );
  expect(routineRequest.input.changes).toEqual({ customer_name: updatedName });
  expect(routineRequest.input).not.toHaveProperty("finance");
  const routineResult = await routineResponse.json();
  await expect(customer).toBeHidden();

  await detail.locator("[data-order-repair-edit-trigger]").click();
  const quoteEditor = page.locator("[data-order-desktop-finance-editor]");
  const quoteInput = quoteEditor.getByLabel("报价项目 1 金额");
  const currentPrice =
    Number((await quoteInput.inputValue()).replace(/[^0-9,.]/g, "").replace(",", ".")) || 75;
  const updatedPrice = (currentPrice + 1).toFixed(2);
  await quoteInput.fill(updatedPrice);
  const financeResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/repairdesk/order/finance"),
  );
  await quoteEditor.getByRole("button", { name: "保存", exact: true }).click();
  const financeResponse = await financeResponsePromise;
  expect(financeResponse.ok(), await financeResponse.text()).toBe(true);
  expect(requestOrder).toEqual(["routine", "finance"]);
  const financeRequest = financeResponse.request().postDataJSON();
  expect(financeRequest.input.expected_updated_at).toBe(routineResult.data.updated_at);
  expect(financeRequest.input).not.toHaveProperty("changes");
  expect(financeRequest.input).not.toHaveProperty("expected_customer_updated_at");
  expect(financeRequest.input.fault_prices[0].price).toBe(Number(updatedPrice));
  const savedLineIds = financeRequest.input.fault_prices.map(
    (item: { line_id: string }) => item.line_id,
  );
  expect(new Set(savedLineIds).size).toBe(savedLineIds.length);
  initialPayload.data.order.fault_prices.forEach((item: { line_id?: string }, index: number) => {
    if (item.line_id) expect(savedLineIds[index]).toBe(item.line_id);
    else expect(savedLineIds[index]).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  });
  expect(financeRequest.input.deposit_amount).toBe(initialPayload.data.order.deposit_amount);
  await expect(
    page.getByText(translateMessage("zh-CN", "orders2b2.success.finance")),
  ).toBeVisible();
  await expect(quoteEditor).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.querySelector("[data-nextjs-dialog], .vite-error-overlay")
          ? "ERROR_OVERLAY"
          : "OK",
      ),
    )
    .toBe("OK");

  await detail.screenshot({
    path: test.info().outputPath("order-detail-combined-save-desktop.png"),
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(detail).toBeVisible();
  await expect.poll(() => hasVisibleMatch(detail.getByText(updatedName))).toBe(true);
  await expect
    .poll(() => hasVisibleMatch(detail.getByText(new RegExp(updatedPrice.replace(".", "[.,]")))))
    .toBe(true);
});

async function hasVisibleMatch(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await locator
        .nth(index)
        .isVisible()
        .catch(() => false)
    )
      return true;
  }
  return false;
}
