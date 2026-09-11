import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Uses synthetic localhost orders only.",
);

test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
});

for (const width of [820, 1440]) {
  test(`workbench has one readable quote total at ${width}`, async ({ page }) => {
    await openDetail(page, width);
    const total = page.locator(".order-workbench-quote-total:visible");
    await expect(total).toHaveCount(1);
    await expect(total).toContainText("€");
    expect(
      await total.evaluate((node) => Boolean(node.closest('[aria-hidden="true"], button'))),
    ).toBe(false);
    const firstTile =
      width < 1024
        ? page.locator("[data-mobile-payment-summary] > div > div").first()
        : page
            .locator('[data-order-panel="finance"] [data-order-workspace-money-strip] > div')
            .first();
    await expect(firstTile).toBeHidden();
    await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
  });
}

test("desktop editing keeps the live total and draft across read-only disclosure toggles", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/repairdesk/order/{patch,finance}", async (route) => {
    writes++;
    await route.abort();
  });
  await openDetail(page, 1440);
  await page
    .locator("[data-order-hero]")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  const panel = page.locator('[data-order-panel="finance"]');
  const total = panel.getByText("编辑后总额", { exact: true }).locator("..");
  await expect(total).toBeVisible();
  const beforeTotal = (await total.textContent())!;
  const amount = page.getByLabel("报价项目 1 金额");
  const oldAmount = Number(await amount.inputValue());
  await amount.fill(String(oldAmount + 5));
  await expect(total).not.toHaveText(beforeTotal);
  const currentValue = (await total.textContent())!;
  const customer = page.locator('input[aria-label="客户"]').first();
  await customer.fill("DEMO retained display draft");
  const keyInfo = page.locator('[data-order-detail-column="customer-device"] > details').first();
  await keyInfo.locator("summary").click();
  await keyInfo.locator("summary").click();
  await page.setViewportSize({ width: 834, height: 1000 });
  await expect(customer).toHaveValue("DEMO retained display draft");
  await expect(total).toBeVisible();
  await expect(total).toHaveText(currentValue);
  await expect(page.locator('textarea[aria-label="诊断结果"]')).toHaveCount(1);
  await page
    .locator("[data-order-hero]")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  expect(writes).toBe(0);
});

for (const [width, height] of [
  [1440, 1000],
  [820, 1180],
  [768, 1024],
] as const) {
  test(`common workbench actions are in the first viewport at ${width}`, async ({ page }) => {
    await openDetail(page, width);
    await page.setViewportSize({ width, height });
    const dock = page.locator(
      width < 1024 ? "[data-mobile-order-action-dock]" : "[data-order-action-dock]",
    );
    const box = (await dock.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await expect(dock.getByRole("button", { name: "流转", exact: true })).toBeVisible();
    for (const button of await dock.locator("button").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("iPad repair shortcut returns focus to the same trigger", async ({ page }) => {
  await openDetail(page, 820);
  const trigger = page.locator("[data-order-workbench-repairs] button");
  await expect(trigger).toBeVisible();
  expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  await expect(page.locator("#mobile-order-finance-editor")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-order-finance-editor")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("iPad supplementary fields remain fully readable without edit permission", async ({
  page,
}) => {
  let writes = 0;
  const note = "只读设备备注完整保留。".repeat(30);
  await page.route("**/api/repairdesk/order/{patch,finance,update}", async (route) => {
    writes++;
    await route.abort();
  });
  await page.route("**/api/repairdesk/order/get", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.order.device_snapshot = {
      ...payload.data.order.device_snapshot,
      device_notes: note,
    };
    payload.data.order.finance_redacted = true;
    for (const key of Object.keys(payload.data.capabilities))
      payload.data.capabilities[key] = false;
    await route.fulfill({ response, json: payload });
  });
  await openDetail(page, 820);
  const details = page.locator(".order-workbench-tablet-details");
  await details.locator("summary").click();
  const text = details.getByText(note, { exact: true });
  await expect(text).toBeVisible();
  expect(await text.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  await expect(details.getByText("客户签名", { exact: true })).toBeVisible();
  await expect(details.getByText("备用联系电话", { exact: true })).toBeVisible();
  await expect(details.locator("[data-order-key-info-grid]")).toBeVisible();
  await expect(page.locator(".order-workbench-quote-total:visible")).toHaveCount(0);
  expect(writes).toBe(0);
});

test("list dialog uses the same read-only workbench before entering its existing editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/orders");
  await page.locator("[data-order-desktop-list] [data-order-row]").first().click();
  const detail = page.locator('[data-order-detail-surface="dialog"]');
  await expect(detail.locator('[data-order-detail-layout="workbench"]')).toBeVisible();
  // Measure both cards in one animation frame while the existing Dialog entrance settles.
  await expect
    .poll(() =>
      detail.evaluate((node) => {
        const card = node.querySelector(".order-workbench-device-card")!.getBoundingClientRect();
        const quote = node.querySelector('[data-order-panel="finance"]')!.getBoundingClientRect();
        return quote.x > card.right && Math.abs(quote.y - card.y) < 1;
      }),
    )
    .toBe(true);
  await detail.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(detail.locator('[data-order-detail-layout="new-order-aligned"]')).toBeVisible();
  await expect(detail.locator('textarea[aria-label="诊断结果"]')).toHaveCount(1);
  await detail.getByRole("button", { name: "取消", exact: true }).click();
  await expect(detail.locator('[data-order-detail-layout="workbench"]')).toBeVisible();
});

test("dark theme keeps device and quote text readable", async ({ page }) => {
  await openDetail(page, 1440);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const colors = await page.locator(".order-workbench-model").evaluate((node) => ({
    ink: getComputedStyle(node).color,
    card: getComputedStyle(node.closest("[data-order-panel]")!).backgroundColor,
  }));
  expect(colors.ink).not.toBe(colors.card);
  await expect(page.locator(".order-workbench-quote-total")).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("detail-dark-1440.png"),
    fullPage: true,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
});

async function openDetail(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/orders/ord_1");
  await expect(page.locator("[data-order-detail-root]")).toBeVisible();
}
