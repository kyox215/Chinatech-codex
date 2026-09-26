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
    const total = page.locator(
      '[data-order-workbench-money-summary] [data-order-workbench-amount="total"] dd:visible',
    );
    await expect(total).toHaveCount(1);
    await expect(total).toContainText("€");
    expect(await total.evaluate((node) => Boolean(node.closest('[aria-hidden="true"]')))).toBe(
      false,
    );
    const trigger = page.locator("[data-order-finance-summary-trigger]:visible");
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAccessibleName("报价处理");
    await expect(trigger).toContainText((await total.textContent())!);
    await expect(page.locator(".order-workbench-quote-total:visible")).toHaveCount(0);
    await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
  });
}

test("desktop finance editor keeps its live total and draft across disclosure and resize", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/repairdesk/order/{patch,finance,update}", async (route) => {
    writes++;
    await route.abort();
  });
  await openDetail(page, 1440);
  const trigger = page.locator("[data-order-finance-summary-trigger]:visible");
  await trigger.click();
  const editor = page.locator("[data-order-desktop-finance-editor]");
  await expect(editor).toBeVisible();
  const total = editor.locator("[data-order-workspace-money-strip] > div").first();
  await expect(total).toBeVisible();
  const beforeTotal = (await total.textContent())!;
  const amount = editor.getByLabel("报价项目 1 金额");
  const oldAmount = Number(await amount.inputValue());
  await amount.fill(String(oldAmount + 5));
  await expect(total).not.toHaveText(beforeTotal);
  const currentValue = (await total.textContent())!;
  const disclosure = page.locator(".order-workbench-disclosure:visible").first();
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await disclosure.locator("summary").click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await page.setViewportSize({ width: 834, height: 1000 });
  await expect(amount).toHaveValue(String(oldAmount + 5));
  await expect(total).toBeVisible();
  await expect(total).toHaveText(currentValue);
  await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(amount).toHaveValue(String(oldAmount + 5));
  await amount.focus();
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "继续编辑", exact: true }).click();
  await expect(amount).toHaveValue(String(oldAmount + 5));
  await expect(amount).toBeFocused();
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(amount).toHaveValue(String(oldAmount));
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
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
  const trigger = page.locator("[data-order-repair-edit-trigger]:visible");
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
  await expect(page.locator("[data-order-workbench-money-summary]:visible")).toHaveCount(0);
  await expect(page.locator("[data-order-finance-summary-trigger]:visible")).toHaveCount(0);
  expect(writes).toBe(0);
});

test("list dialog opens its scoped finance editor and restores the summary trigger", async ({
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
        const card = node.querySelector(".order-workbench-device-heading")!.getBoundingClientRect();
        const quote = node.querySelector('[data-order-panel="finance"]')!.getBoundingClientRect();
        return quote.x > card.right && Math.abs(quote.y - card.y) < 1;
      }),
    )
    .toBe(true);
  const trigger = detail.locator("[data-order-finance-summary-trigger]:visible");
  await trigger.click();
  const editor = detail.locator("[data-order-desktop-finance-editor]");
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("报价项目 1 金额")).toHaveCount(1);
  await expect(detail.locator('[data-order-detail-layout="workbench"]')).toBeVisible();
  await editor.getByRole("button", { name: "取消", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(trigger).toBeFocused();
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
  await expect(
    page.locator('[data-order-workbench-money-summary] [data-order-workbench-amount="total"] dd'),
  ).toBeVisible();
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
