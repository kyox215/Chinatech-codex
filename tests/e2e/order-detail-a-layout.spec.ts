import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { translateMessage as tr } from "@/shared/i18n/messages";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Uses only synthetic local orders.");
const evidenceDir = process.env.ORDER_DETAIL_A_EVIDENCE_DIR;
const locales = ["zh-CN", "it-IT", "en"] as const;
test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});
async function capture(page: Page, name: string, fullPage = false) {
  const path = evidenceDir ? `${evidenceDir}/${name}.png` : test.info().outputPath(`${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  // Framer layout indicators run outside CSS animation handling; wait for their geometry to settle.
  await page.evaluate(async () => {
    let previous = "";
    let stableFrames = 0;
    for (let frame = 0; frame < 90 && stableFrames < 6; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const indicator = document.querySelector(
        '[data-order-detail-tabs] [aria-selected="true"] > span',
      );
      const rect = indicator?.getBoundingClientRect();
      const current = rect
        ? [rect.x, rect.y, rect.width, rect.height].map((value) => value.toFixed(2)).join(",")
        : "none";
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
    }
  });
  await page.screenshot({
    path,
    fullPage,
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
}
async function ready(page: Page, locale: (typeof locales)[number], width = 390, height = 844) {
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: locale, url: String(test.info().project.use.baseURL) },
    ]);
  await page.setViewportSize({ width, height });
  await page.goto("/orders/ord_1");
  await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
  await page.waitForLoadState("networkidle");
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth + 1),
  );
  expect(await page.locator("button button, button a, a button").count()).toBe(0);
}

for (const locale of locales)
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    test(`A order layout ${locale} ${width}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await ready(page, locale, width, width === 320 ? 568 : width < 768 ? 844 : 1000);
      await noOverflow(page);
      if (width < 1024) {
        const identity = page.locator('[data-mobile-order-identity="true"]');
        const customer = identity.getByRole("button", {
          name: tr(locale, "orders2b2.overview.customerInfo"),
          exact: true,
        });
        await expect(customer).toHaveAccessibleDescription("张伟 +8613800000000 whatsapp");
        const summaryId = await customer.getAttribute("aria-describedby");
        expect(summaryId).toBeTruthy();
        await expect(page.locator(`[id="${summaryId}"]`)).toHaveCount(1);
        const fault = page.locator('[data-mobile-order-fault="true"]');
        const people = page.locator('[data-mobile-order-people="true"]');
        const quote = page.locator("#mobile-order-quote");
        await expect(identity.locator('[data-order-device-custody="true"]')).toHaveCount(1);
        if (width >= 390)
          expect(
            (await identity.locator('[data-order-custody-mode="compact"]').boundingBox())!.height,
          ).toBeLessThanOrEqual(48);
        const workspace = await page
          .locator('[data-order-detail-layout="workbench"]')
          .boundingBox();
        if (workspace!.width < 680)
          await expect(quote.locator('[data-mobile-payment-summary="true"]')).toBeVisible();
        else await expect(quote.locator("[data-order-workbench-amount]")).toHaveCount(3);
        const identitySurface =
          workspace!.width >= 680 ? identity.locator("[data-order-workbench-customer]") : identity;
        const boxes = await Promise.all(
          [identitySurface, fault, people, quote].map((x) => x.boundingBox()),
        );
        if (workspace!.width < 680) {
          for (let i = 1; i < boxes.length; i++)
            expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height);
        } else {
          // The stable compact renderer has three summary regions followed by repair/support rows.
          const device = await identity
            .locator(".order-workbench-mobile-device-summary")
            .boundingBox();
          expect(device).not.toBeNull();
          expect(device!.x).toBeGreaterThanOrEqual(boxes[0]!.x + boxes[0]!.width);
          expect(boxes[3]!.x).toBeGreaterThanOrEqual(device!.x + device!.width);
          expect(Math.abs(device!.y - boxes[0]!.y)).toBeLessThan(1);
          expect(boxes[1]!.y).toBeGreaterThanOrEqual(
            Math.max(
              boxes[0]!.y + boxes[0]!.height,
              device!.y + device!.height,
              boxes[3]!.y + boxes[3]!.height,
            ),
          );
          expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height);
          expect(Math.abs(boxes[3]!.y - boxes[0]!.y)).toBeLessThan(1);
        }
        const tabs = page.locator('[data-order-detail-tabs="true"] [role="tab"]');
        expect(await tabs.count()).toBe(3);
        const widths = await tabs.evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width),
        );
        if (workspace!.width < 680)
          expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
        else
          expect(
            await tabs.evaluateAll((nodes) =>
              nodes.every((node) => node.getBoundingClientRect().height >= 44),
            ),
          ).toBe(true);
        const header = await page.locator('[data-mobile-order-header="true"]').boundingBox();
        const dock = await page.locator('[data-mobile-order-action-dock="true"]').boundingBox();
        if (locale === "zh-CN" && width === 390) {
          // Unified 24px badges occupy two rows; safe-area padding belongs to the
          // floating shell, not the dense content card. Keep both geometries explicit.
          const headerDensity = await page
            .locator('[data-mobile-order-header="true"]')
            .evaluate((node) => {
              const card = node.querySelector(":scope > section")!;
              const style = getComputedStyle(node);
              return {
                cardHeight: card.getBoundingClientRect().height,
                shellPadding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
              };
            });
          expect(headerDensity.cardHeight).toBeLessThanOrEqual(168);
          expect(header!.height).toBeCloseTo(
            headerDensity.cardHeight + headerDensity.shellPadding,
            1,
          );
          const measurements = {
            viewport: { width, height: 844 },
            header,
            headerDensity,
            identity: boxes[0],
            fault: boxes[1],
            people: boxes[2],
            quote: boxes[3],
            dock,
          };
          if (evidenceDir) {
            mkdirSync(evidenceDir, { recursive: true });
            writeFileSync(
              `${evidenceDir}/layout-measurements.json`,
              JSON.stringify(measurements, null, 2),
            );
          }
          await capture(page, `order-layout-initial-${locale}-${width}`);
          // Direct fields remain readable touch controls. The phone uses ordinary
          // document scrolling, so verify the complete quote clears the fixed dock.
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const quoteEnd = await quote.boundingBox();
          expect(quoteEnd!.y + quoteEnd!.height).toBeLessThanOrEqual(dock!.y);
          await noOverflow(page);
        }
        await capture(page, `order-layout-${locale}-${width}`);
        if (width === 320) {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const end = await quote.boundingBox();
          expect(end!.y + end!.height).toBeLessThanOrEqual(dock!.y);
          await capture(page, `order-scroll-end-${locale}-${width}`);
        }
      } else {
        await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
        await expect(page.locator('[data-mobile-order-page="true"]')).toHaveCount(0);
        await capture(page, `order-desktop-${locale}-${width}`);
      }
      expect(errors).toEqual([]);
    });
  }

for (const state of ["empty", "readonly", "exception", "long"] as const) {
  test(`A order layout ${state} keeps content and actions`, async ({ page }) => {
    await page.route("**/api/repairdesk/order/get", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const order = payload.data.order;
      if (state === "empty")
        Object.assign(order, {
          fault_prices: [],
          quotation_amount: 0,
          deposit_amount: 0,
          balance_amount: 0,
          issue_description: "",
          diagnosis_result: "",
          technician_name: "",
        });
      if (state === "readonly") {
        Object.assign(order, { finance_redacted: true });
        for (const key of Object.keys(payload.data.capabilities))
          payload.data.capabilities[key] = false;
      }
      if (state === "exception")
        Object.assign(order, {
          status: "cancelled",
          workflow_status: "closed",
          device_custody_status: "with_shop",
          delivered_at: null,
        });
      if (state === "long")
        Object.assign(order, {
          public_no: "DEMO-ORDINE-CON-IDENTIFICATIVO-MOLTO-LUNGO-20260906",
          customer_name_snapshot: "Cliente dimostrativo con nome e cognome molto lunghi",
          technician_name: "Tecnico dimostrativo con nome e cognome molto lunghi",
          warranty_text: "Garanzia dimostrativa con condizioni dettagliate",
          accessory_notes: "Custodia protettiva dimostrativa e accessori completi",
          fault_prices: [
            {
              name: "Sostituzione dimostrativa del componente con descrizione molto lunga",
              price: 80,
            },
          ],
          issue_description:
            "Descrizione dimostrativa del guasto con dettagli completi da verificare nel pannello di modifica.",
        });
      await route.fulfill({ response, json: payload });
    });
    await ready(page, "it-IT", 320, 568);
    await noOverflow(page);
    if (state === "readonly") {
      await expect(page.locator("#mobile-order-quote")).toHaveCount(0);
      await expect(
        page.locator("[data-mobile-order-identity]").getByRole("button", {
          name: tr("it-IT", "orders2b2.overview.customerInfo"),
          exact: true,
        }),
      ).toBeDisabled();
      await expect(page.locator("[data-mobile-order-identity]")).toContainText(
        "Apple iPhone 15 Pro",
      );
    }
    if (state === "exception") {
      await expect(page.locator('[data-order-custody-mode="expanded"]')).toBeVisible();
      await expect(
        page.getByText(tr("it-IT", "orders2b2.custody.returnPending"), { exact: true }),
      ).toBeVisible();
    }
    if (state === "long") {
      const name = page
        .locator("[data-mobile-order-identity]")
        .getByRole("button", { name: tr("it-IT", "orders2b2.overview.customerInfo"), exact: true });
      expect(await name.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    }
    await capture(page, `order-${state}-it-320`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await capture(page, `order-${state}-end-it-320`);
  });
}

test("A editors preserve page geometry, focus and failed quote draft", async ({ page }) => {
  await ready(page, "zh-CN");
  const main = page.locator("#order-detail-mobile-panel-overview");
  const initial = await main.boundingBox();
  const people = page.locator("[data-mobile-order-people]").getByRole("button", { name: /负责人/ });
  await people.click();
  let dialog = page.getByRole("dialog", { name: "负责人", exact: true });
  await expect(dialog).toBeVisible();
  await capture(page, "order-assignee-editor");
  await page.keyboard.press("Escape");
  await expect(people).toBeFocused();
  const supplier = page.getByRole("button", {
    name: tr("zh-CN", "orders2b2.supplier.title"),
    exact: true,
  });
  await supplier.click();
  dialog = page.getByRole("dialog", { name: tr("zh-CN", "orders2b2.supplier.title"), exact: true });
  await expect(dialog).toBeVisible();
  await capture(page, "order-supplier-editor");
  await page.keyboard.press("Escape");
  await expect(supplier).toBeFocused();
  const fault = page.getByRole("button", {
    name: tr("zh-CN", "orders.faultEditor.title"),
    exact: true,
  });
  await fault.click();
  dialog = page.getByRole("dialog", { name: tr("zh-CN", "orders.faultEditor.title"), exact: true });
  await expect(dialog).toBeVisible();
  await capture(page, "order-fault-editor");
  await page.keyboard.press("Escape");
  await expect(fault).toBeFocused();
  const quote = page
    .locator("#mobile-order-quote")
    .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.quoteItems"), exact: true });
  await quote.click();
  const editor = page.locator("#mobile-order-finance-editor");
  await expect(editor).toBeVisible();
  await capture(page, "order-quote-editor");
  expect((await main.boundingBox())!.height).toBe(initial!.height);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const input = editor
    .getByRole("button", { name: tr("zh-CN", "orders2b2.finance.item"), exact: true })
    .nth(0);
  await input.click();
  const quotePopup = page.locator('[data-order-quote-popup="true"]');
  await expect(quotePopup).toBeFocused();
  await quotePopup.getByRole("textbox").fill("DEMO retained failed draft");
  await quotePopup.getByRole("button", { name: "保存", exact: true }).click();
  await expect(quotePopup).toHaveCount(0);
  await expect(input).toBeFocused();
  let attempts = 0;
  await page.route("**/api/repairdesk/order/finance", async (route) => {
    attempts++;
    await route.fulfill({
      status: 500,
      json: { error: { code: "INTERNAL_ERROR", message: "Synthetic local save failure" } },
    });
  });
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect.poll(() => attempts).toBe(1);
  await expect(editor.getByRole("alert")).toHaveText(
    tr("zh-CN", "orders2b2.error.unavailable", {
      operation: tr("zh-CN", "orders2b2.operation.finance"),
    }),
  );
  await expect(input).toContainText("DEMO retained failed draft");
  await capture(page, "order-quote-save-failure");
  await page.keyboard.press("Escape");
  await editor
    .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.confirmDiscard") })
    .click();
  await expect(quote).toBeFocused();
  await expect(main).not.toContainText("DEMO retained failed draft");
  await page.locator("#order-detail-mobile-tab-photos").click();
  await expect(page.locator("[data-order-detail-photo-slots]")).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await capture(page, "order-photos");
  await page.locator("#order-detail-mobile-tab-records").click();
  await expect(page.locator("[data-order-records-timeline]")).toBeVisible();
  await capture(page, "order-history");
  await noOverflow(page);
});

// These scenarios intercept the local fixture only; no business mutation reaches a server.
for (const state of [
  "receive",
  "deliver",
  "return",
  "unknown",
  "correction",
  "readonly",
] as const) {
  test(`status action ${state} preserves confirmation and narrow labels`, async ({ page }) => {
    let writes = 0;
    await page.route("**/api/repairdesk/order/custody", async (route) => {
      writes++;
      await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } });
    });
    await page.route("**/api/repairdesk/order/get", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      Object.assign(payload.data.order, {
        status:
          state === "return"
            ? "cancelled"
            : state === "correction"
              ? "completed"
              : payload.data.order.status,
        workflow_status:
          state === "return" || state === "correction"
            ? "closed"
            : payload.data.order.workflow_status,
        workflow_bucket:
          state === "return"
            ? "cancelled"
            : state === "correction"
              ? "done"
              : payload.data.order.workflow_bucket,
        exception_status: null,
        device_custody_status:
          state === "unknown"
            ? null
            : ["deliver", "return", "correction"].includes(state)
              ? "with_shop"
              : "with_customer",
        delivered_at: null,
      });
      Object.assign(payload.data.capabilities, {
        canEditIntake: state !== "readonly",
        canCorrect: state !== "readonly",
        canConfirmCancelledReturn: state !== "readonly",
        canReopen: state === "correction",
        canVoid: false,
      });
      await route.fulfill({ response, json: payload });
    });
    await ready(page, "it-IT", 320, 568);
    const card = page.locator('[data-order-device-custody="true"]:visible');
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `status-${state}-full-it-320`, true);
    await card.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    await noOverflow(page);
    const actions = card.getByRole("button");
    await expect(actions).toHaveCount(state === "return" ? 2 : 1);
    const custodyTrigger = card.locator("[data-order-custody-trigger]");
    await expect(custodyTrigger).toHaveAccessibleName(tr("it-IT", "orders2b2.overview.custody"));
    if (state === "readonly") {
      await expect(custodyTrigger).toBeDisabled();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(writes).toBe(0);
    }
    await capture(page, `status-${state}-it-320`);

    if (state !== "readonly") {
      const action =
        state === "return"
          ? card.getByRole("button", {
              name: tr("it-IT", "orders2b2.custody.confirmReturned"),
              exact: true,
            })
          : custodyTrigger;
      await action.focus();
      await expect(action).toBeFocused();
      await capture(page, `status-${state}-focus-it-320`);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(writes).toBe(0);
      if (state !== "return") {
        await expect(dialog.locator("[data-order-custody-option]")).toHaveCount(2);
        await expect(
          dialog.getByRole("button", {
            name: tr("it-IT", "orders2b2.custody.confirmSave"),
            exact: true,
          }),
        ).toHaveCount(0);
        if (state === "unknown") {
          await dialog.locator('[data-order-custody-option="with_shop"]').click();
          expect(writes).toBe(0);
          await expect(dialog.getByRole("textbox")).toBeVisible();
          await expect(
            dialog.getByRole("button", {
              name: tr("it-IT", "orders2b2.custody.confirmSave"),
              exact: true,
            }),
          ).toBeDisabled();
        }
      }
      const clippedButtons = await dialog
        .locator("button:visible")
        .evaluateAll(
          (nodes) =>
            nodes.filter(
              (node) =>
                node.scrollWidth > node.clientWidth + 1 ||
                node.scrollHeight > node.clientHeight + 1,
            ).length,
        );
      expect(clippedButtons).toBe(0);
      await capture(page, `status-${state}-confirmation-it-320`);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(action).toBeFocused();
    }
  });
}

for (const needsReason of [false, true])
  test(`status action receive ${needsReason ? "unknown" : "ordinary"} keeps pending guard, failure draft and version payload`, async ({
    page,
  }) => {
    const expectedVersion = "2026-09-02T08:00:00.000Z";
    await page.route("**/api/repairdesk/order/get", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      Object.assign(payload.data.order, {
        device_custody_status: needsReason ? null : "with_customer",
        updated_at: expectedVersion,
      });
      await route.fulfill({ response, json: payload });
    });
    await ready(page, "zh-CN");
    const card = page.locator('[data-order-device-custody="true"]:visible');
    const action = card.getByRole("button", {
      name: tr("zh-CN", "orders2b2.overview.custody"),
      exact: true,
    });
    await action.click();
    const dialog = page.getByRole("dialog");
    const reason = dialog.getByRole("textbox");
    let attempts = 0;
    let requestBody: { id: string; input: Record<string, unknown> } | undefined;
    let release: () => void = () => {};
    const heldResponse = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/repairdesk/order/custody", async (route) => {
      attempts++;
      requestBody = route.request().postDataJSON();
      await heldResponse;
      await route.fulfill({
        status: needsReason ? 500 : 409,
        json: {
          error: "Synthetic local custody failure",
          code: needsReason ? "INTERNAL_ERROR" : "ORDER_WRITE_CONFLICT",
        },
      });
    });
    await expect(dialog.locator("[data-order-custody-option]")).toHaveCount(2);
    expect(attempts).toBe(0);
    await dialog.locator('[data-order-custody-option="with_shop"]').click();
    if (needsReason) {
      expect(attempts).toBe(0);
      await reason.fill("DEMO custody reason retained");
      await dialog
        .getByRole("button", { name: tr("zh-CN", "orders2b2.custody.confirmSave"), exact: true })
        .click();
    } else {
      await expect(reason).toHaveCount(0);
      await expect(
        dialog.getByRole("button", {
          name: tr("zh-CN", "orders2b2.custody.confirmSave"),
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await expect.poll(() => attempts).toBe(1);
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    if (needsReason) await expect(reason).toBeDisabled();
    await expect(card.locator("button")).toBeDisabled();
    for (const option of await dialog.locator("[data-order-custody-option]").all())
      await expect(option).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await capture(page, `status-receive-${needsReason ? "unknown" : "ordinary"}-pending-zh-390`);
    expect(requestBody).toMatchObject({
      id: "ord_1",
      input: { device_custody_status: "with_shop", expected_updated_at: expectedVersion },
    });
    if (needsReason) expect(requestBody?.input.reason).toBe("DEMO custody reason retained");
    else expect(requestBody?.input.reason).toBeUndefined();
    expect(requestBody?.input.idempotency_key).toMatch(/^[0-9a-f-]{36}$/i);
    release();
    await expect(dialog).toHaveAttribute("aria-busy", "false");
    if (needsReason) await expect(reason).toHaveValue("DEMO custody reason retained");
    await expect(dialog.locator('[data-order-custody-option="with_shop"]')).toHaveAttribute(
      "data-custody-target",
      "true",
    );
    await expect(dialog.getByRole("alert")).toContainText(
      tr("zh-CN", needsReason ? "orders2b2.error.unavailable" : "orders2b2.error.conflict", {
        operation: tr("zh-CN", "orders2b2.operation.custody"),
      }),
    );
    await capture(page, `status-receive-${needsReason ? "unknown" : "ordinary"}-failure-zh-390`);
    expect(attempts).toBe(1);
    await page.keyboard.press("Escape");
    if (needsReason)
      await dialog
        .getByRole("button", {
          name: tr("zh-CN", "orders.faultEditor.confirmDiscard"),
          exact: true,
        })
        .click();
    await expect(dialog).toHaveCount(0);
    await expect(action).toBeFocused();
  });

for (const locale of locales) {
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    test(`status presentation ${locale} ${width} stays reachable and flat`, async ({ page }) => {
      await ready(page, locale, width, width < 768 ? 844 : 1000);
      const card = page.locator('[data-order-device-custody="true"]:visible');
      await card.scrollIntoViewIfNeeded();
      const action = card.getByRole("button");
      await expect(action).toHaveAccessibleName(tr(locale, "orders2b2.overview.custody"));
      const metrics = await action.evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
          border: style.borderTopWidth,
          shadow: style.boxShadow,
          wrap: style.whiteSpace,
          clipped: node.scrollWidth > node.clientWidth + 1,
        };
      });
      expect(metrics.height).toBeGreaterThanOrEqual(44);
      expect(metrics.border).toBe("0px");
      expect(metrics.wrap).toBe("normal");
      expect(metrics.clipped).toBe(false);
      expect(metrics.shadow === "none" || !metrics.shadow.match(/rgba?\((?!0, 0, 0, 0\))/)).toBe(
        true,
      );
      if (width < 1024) expect((await card.boundingBox())!.height).toBeLessThanOrEqual(48);
      await noOverflow(page);
      await capture(page, `status-presentation-${locale}-${width}`);
      await action.focus();
      await expect(action).toBeFocused();
      const focusedShadow = await action.evaluate((node) => getComputedStyle(node).boxShadow);
      expect(focusedShadow).not.toBe(metrics.shadow);
      await action.press("Enter");
      const confirmation = page.getByRole("dialog");
      await expect(confirmation).toBeVisible();
      await expect(confirmation.locator("[data-order-custody-option]")).toHaveCount(2);
      await expect(confirmation.locator('[data-order-custody-option="with_shop"]')).toBeEnabled();
      await expect(
        confirmation.locator('[data-order-custody-option="with_customer"]'),
      ).toBeDisabled();
      await expect(
        confirmation.locator('[data-order-custody-option="with_customer"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        confirmation.getByRole("button", {
          name: tr(locale, "orders2b2.custody.confirmSave"),
          exact: true,
        }),
      ).toHaveCount(0);
      await noOverflow(page);
      if (width >= 1024) await capture(page, `status-confirmation-${locale}-${width}`);
      await page.keyboard.press("Escape");
      await expect(action).toBeFocused();
    });
  }
}

test("compact terminal status keeps desktop correction, reopen and dangerous menu separate", async ({
  page,
}) => {
  await page.route("**/api/repairdesk/order/get", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    Object.assign(payload.data.order, {
      status: "completed",
      workflow_status: "closed",
      workflow_bucket: "done",
      device_custody_status: "with_shop",
      delivered_at: null,
    });
    Object.assign(payload.data.capabilities, { canCorrect: true, canReopen: true, canVoid: true });
    await route.fulfill({ response, json: payload });
  });
  await ready(page, "it-IT", 1024, 900);
  const terminal = page.locator('[data-order-terminal-actions="true"]:visible');
  await capture(page, "status-terminal-compact-it-1024");
  for (const key of ["orders2b2.terminal.correct", "orders2b2.terminal.reopen"] as const) {
    const action = terminal.getByRole("button", { name: tr("it-IT", key), exact: true });
    await action.focus();
    await expect(action).toBeFocused();
    await action.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const more = terminal.getByRole("button", {
    name: tr("it-IT", "orders2b2.terminal.more"),
    exact: true,
  });
  await more.focus();
  await expect(more).toBeFocused();
  await capture(page, "status-terminal-focus-it-1024");
  await more.press("Enter");
  const destructive = page.getByRole("menuitem", {
    name: tr("it-IT", "orders2b2.terminal.void"),
    exact: true,
  });
  await expect(destructive).toBeVisible();
  await destructive.focus();
  await expect(destructive).toBeFocused();
  await capture(page, "status-terminal-danger-menu-it-1024");
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await noOverflow(page);
});

test("status presentation it-IT 320 keeps wider font metrics inside the compact row", async ({
  page,
}) => {
  await ready(page, "it-IT", 320, 844);
  await page.evaluate(() => document.fonts.ready);
  // A slightly wider font crosses the old flex-wrap boundary (only ~6px spare).
  // Deterministic spacing exercises that geometry on every OS without requiring a local font.
  await page.addStyleTag({
    content:
      "[data-order-device-custody], [data-order-device-custody] * { letter-spacing: .35px !important; }",
  });
  const card = page.locator('[data-order-device-custody="true"]:visible');
  const action = card.getByRole("button", {
    name: tr("it-IT", "orders2b2.overview.custody"),
    exact: true,
  });
  const metrics = await card.evaluate((node) => {
    const action = node.querySelector("button")!;
    return {
      rowHeight: node.getBoundingClientRect().height,
      actionHeight: action.getBoundingClientRect().height,
      font: getComputedStyle(action).fontFamily,
      letterSpacing: getComputedStyle(action).letterSpacing,
      rowWidth: node.getBoundingClientRect().width,
      actionWidth: action.getBoundingClientRect().width,
      clipped:
        action.scrollWidth > action.clientWidth + 1 ||
        action.scrollHeight > action.clientHeight + 1,
    };
  });
  await test.info().attach("custody-wider-font-metrics", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  expect(metrics.rowHeight).toBeLessThanOrEqual(48);
  expect(metrics.actionHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.clipped).toBe(false);
  await noOverflow(page);
  await capture(page, "status-wider-font-it-320");
  await action.focus();
  await expect(action).toBeFocused();
  await action.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(action).toBeFocused();
});
