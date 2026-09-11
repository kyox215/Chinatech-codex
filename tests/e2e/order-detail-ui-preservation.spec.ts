import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Uses only synthetic local orders.");

test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  const readPosts = new Set(
    [
      "order/get",
      "orders/queue-summary",
      "orders/list-page",
      "dashboard/priority-summary",
      "customers/list-page",
      "customers/intake-search",
      "inventory/summary",
    ].map((path) => `/api/repairdesk/${path}`),
  );
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL!).origin) return route.abort();
    if (
      url.pathname.startsWith("/api/") &&
      !["GET", "HEAD"].includes(request.method()) &&
      !readPosts.has(url.pathname)
    )
      return route.fulfill({
        status: 409,
        json: { error: "Synthetic test blocks business writes" },
      });
    return route.continue();
  });
});

for (const [width, height, locale] of [
  [390, 844, "zh-CN"],
  [430, 844, "zh-CN"],
  [640, 768, "zh-CN"],
  [768, 1024, "zh-CN"],
  [820, 1180, "zh-CN"],
  [834, 1194, "zh-CN"],
  [1024, 768, "zh-CN"],
  [1280, 800, "zh-CN"],
  [1440, 1000, "zh-CN"],
  [834, 1194, "it-IT"],
  [1024, 768, "en"],
] as const) {
  test(`shared detail workbench ${locale} ${width}x${height}`, async ({
    page,
    context,
    baseURL,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height });
    await page.goto("/orders/ord_1");
    const detail = page.locator('[data-order-detail-root="true"]');
    await expect(detail).toBeVisible();
    await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
    await expect(detail).toHaveAttribute(
      "data-order-detail-render-mode",
      width < 1024 ? "compact" : "desktop",
    );
    const workspace = detail.locator('[data-order-detail-layout="workbench"]');
    await expect(workspace).toHaveCount(1);
    const available = (await workspace.boundingBox())!.width;
    // Row-layout wrappers use display:contents. Measure the actual three summary surfaces.
    const wide = available >= 680;
    const wideCompact = width < 1024 && wide;
    const left = await workspace
      .locator(
        wide
          ? wideCompact
            ? ".order-workbench-mobile-device-summary"
            : ".order-workbench-device-heading"
          : '[data-order-detail-column="customer-device"]',
      )
      .boundingBox();
    const right = await workspace
      .locator(
        wide
          ? wideCompact
            ? "[data-order-workbench-quote]"
            : '[data-order-panel="finance"]'
          : '[data-order-detail-column="quote"]',
      )
      .boundingBox();
    if (wide) {
      const customer = await workspace
        .locator(wideCompact ? "[data-order-workbench-customer]" : '[data-order-panel="customer"]')
        .boundingBox();
      expect(left!.x).toBeGreaterThan(customer!.x + customer!.width);
      expect(right!.x).toBeGreaterThan(left!.x + left!.width);
      expect(Math.abs(right!.y - customer!.y)).toBeLessThan(1);
      expect(Math.abs(left!.y - customer!.y)).toBeLessThan(1);
      expect(Math.abs(left!.width - customer!.width)).toBeLessThan(1);
      expect(Math.abs(right!.width - customer!.width)).toBeLessThan(1);
    } else {
      expect(Math.abs(right!.x - left!.x)).toBeLessThan(1);
      expect(right!.y).toBeGreaterThanOrEqual(left!.y + left!.height);
    }
    await expect(detail.getByRole("tab")).toHaveCount(3);
    await expect(detail.locator('[data-device-unlock-viewer="true"]')).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({
      path: test.info().outputPath(`detail-${locale}-${width}.png`),
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { visibility: hidden !important; }",
    });
    expect(errors).toEqual([]);
  });
}

for (const width of [834, 1440]) {
  for (const state of ["empty", "readonly", "cancelled", "long"] as const) {
    test(`workbench preserves ${state} at ${width}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL! }]);
      await page.route("**/api/repairdesk/order/get", async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        const order = payload.data.order;
        Object.assign(order, { device_unlock_method: "pin", device_unlock_value: "7593" });
        if (state === "empty")
          Object.assign(order, {
            fault_prices: [],
            quotation_amount: 0,
            deposit_amount: 0,
            balance_amount: 0,
            issue_description: "",
            diagnosis_result: "",
          });
        if (state === "readonly") {
          order.finance_redacted = true;
          for (const key of Object.keys(payload.data.capabilities))
            payload.data.capabilities[key] = false;
        }
        if (state === "cancelled")
          Object.assign(order, {
            status: "cancelled",
            workflow_status: "closed",
            workflow_bucket: "cancelled",
            device_custody_status: "with_shop",
            delivered_at: null,
          });
        if (state === "long")
          Object.assign(order, {
            customer_name: "Cliente dimostrativo con nome e cognome molto lunghi",
            customer_name_snapshot: "Cliente dimostrativo con nome e cognome molto lunghi",
            technician_name: "Tecnico dimostrativo con nome e cognome molto lunghi",
            device_snapshot: {
              ...order.device_snapshot,
              device_notes:
                "Note sul dispositivo dimostrativo con descrizione completa degli accessori",
            },
            accessory_notes: "Custodia protettiva dimostrativa e accessori completi",
            fault_prices: [
              {
                name: "Sostituzione del componente con descrizione dimostrativa molto lunga",
                price: 80,
              },
            ],
            quotation_amount: 80,
            deposit_amount: 24,
            balance_amount: 56,
            issue_description:
              "Descrizione dimostrativa del guasto con dettagli completi da verificare nel pannello di modifica.",
            diagnosis_result:
              "Diagnosi dimostrativa con dettagli tecnici completi conservati e consultabili.",
          });
        await route.fulfill({ response, json: payload });
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/orders/ord_1");
      const detail = page.locator('[data-order-detail-root="true"]');
      await expect(detail).toBeVisible();
      await expect(detail.locator('[data-order-detail-layout="workbench"]')).toBeVisible();
      const unlock = detail.locator('[data-device-unlock-viewer="true"]');
      await expect(unlock).toBeVisible();
      await expect(unlock).not.toContainText("7593");
      await expect(unlock.locator("[data-device-unlock-reveal]")).toBeVisible();
      if (state === "readonly") {
        await expect(detail.locator("#mobile-order-quote, [data-order-quote-row]")).toHaveCount(0);
        await expect(detail.locator("[data-order-quote-text-control]")).toHaveCount(0);
      }
      if (state === "cancelled")
        await expect(detail.locator('[data-order-custody-mode="expanded"]')).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: test.info().outputPath(`detail-${state}-${width}.png`),
        fullPage: true,
        animations: "disabled",
        style: "nextjs-portal { visibility: hidden !important; }",
      });
    });
  }
}

for (const surface of ["page", "dialog"] as const) {
  test(`one diagnosis draft owner in ${surface} editing`, async ({ page, context, baseURL }) => {
    let mutations = 0;
    await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
    await page.route("**/api/repairdesk/order/{patch,finance}", async (route) => {
      mutations += 1;
      await route.abort();
    });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(surface === "page" ? "/orders/ord_1" : "/orders");
    if (surface === "dialog") {
      const row = page.locator('[data-order-desktop-list="true"] [data-order-row="true"]').first();
      await expect(row).toBeVisible();
      await row.click();
    }
    const detail = page.locator(
      `[data-order-detail-root="true"][data-order-detail-surface="${surface}"]`,
    );
    await expect(detail).toBeVisible();
    await detail
      .locator("[data-order-secondary-actions]")
      .getByRole("button", { name: "更多工单操作", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
    const diagnosis = detail.locator('textarea[aria-label="诊断结果"]');
    await expect(diagnosis).toHaveCount(1);
    await expect(diagnosis).toBeVisible();
    await diagnosis.fill("DEMO diagnosis cancelled draft");
    await expect(diagnosis).toHaveValue("DEMO diagnosis cancelled draft");
    await detail.getByRole("button", { name: "取消", exact: true }).click();
    await expect(diagnosis).toHaveCount(0);
    await expect(detail).not.toContainText("DEMO diagnosis cancelled draft");
    expect(mutations).toBe(0);
  });
}

test("readonly desktop notes stay fully readable when the workspace narrows", async ({
  page,
  context,
  baseURL,
}) => {
  const issue = "送修说明只读全文。".repeat(28);
  const deviceNotes = "设备外观备注完整内容。".repeat(24);
  let writes = 0;
  await page.route("**/api/repairdesk/order/{patch,finance,update}", async (route) => {
    writes += 1;
    await route.abort();
  });
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
  await page.route("**/api/repairdesk/order/get", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.order.issue_description = issue;
    payload.data.order.device_snapshot = {
      ...payload.data.order.device_snapshot,
      device_notes: deviceNotes,
    };
    if (payload.data.device) payload.data.device.device_notes = deviceNotes;
    for (const key of Object.keys(payload.data.capabilities))
      payload.data.capabilities[key] = false;
    await route.fulfill({ response, json: payload });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/orders/ord_1");
  const detail = page.locator('[data-order-detail-root="true"]');
  await expect(detail).toBeVisible();
  const notesDisclosure = detail.locator(".order-workbench-device-support details");
  await expect(notesDisclosure.locator("summary")).toBeVisible();
  await notesDisclosure.locator("summary").click();
  const issueDisclosure = detail.locator('[data-order-panel="issue"] .order-workbench-full-text');
  await expect(issueDisclosure.locator("summary")).toBeVisible();
  await issueDisclosure.locator("summary").click();
  for (const width of [1440, 834]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(detail).toHaveAttribute("data-order-detail-render-mode", "desktop");
    for (const text of [issueDisclosure.locator("p"), notesDisclosure.locator("p")]) {
      await expect(text).toBeVisible();
      const box = await text.evaluate((node) => ({
        clamp: getComputedStyle(node).webkitLineClamp,
        height: node.clientHeight,
        scrollHeight: node.scrollHeight,
      }));
      expect(box.clamp).toBe("none");
      expect(box.scrollHeight).toBeLessThanOrEqual(box.height + 1);
    }
    await noOverflow(page);
  }
  expect(writes).toBe(0);
});

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth + 1),
  );
  await expect(page.locator("button button, button a, a button")).toHaveCount(0);
}
