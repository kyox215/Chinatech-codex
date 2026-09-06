import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { translateMessage as tr } from "@/shared/i18n/messages";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Uses only synthetic local orders.");
const evidenceDir = process.env.ORDER_DETAIL_A_EVIDENCE_DIR;
const locales = ["zh-CN", "it-IT", "en"] as const;
async function capture(page: Page, name: string) {
  const path = evidenceDir ? `${evidenceDir}/${name}.png` : test.info().outputPath(`${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled" });
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
          ).toBeLessThanOrEqual(44);
        await expect(quote.locator('[data-mobile-payment-summary="true"]')).toBeVisible();
        const boxes = await Promise.all(
          [identity, fault, people, quote].map((x) => x.boundingBox()),
        );
        for (let i = 1; i < boxes.length; i++)
          expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height);
        const tabs = page.locator('[data-order-detail-tabs="true"] [role="tab"]');
        expect(await tabs.count()).toBe(3);
        const widths = await tabs.evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width),
        );
        expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
        const header = await page.locator('[data-mobile-order-header="true"]').boundingBox();
        const dock = await page.locator('[data-mobile-order-action-dock="true"]').boundingBox();
        if (locale === "zh-CN" && width === 390) {
          expect(header!.height).toBeLessThanOrEqual(168);
          expect(boxes[3]!.y + boxes[3]!.height).toBeLessThan(dock!.y);
          const measurements = {
            viewport: { width, height: 844 },
            header,
            identity: boxes[0],
            fault: boxes[1],
            people: boxes[2],
            quote: boxes[3],
            dock,
          };
          if (evidenceDir)
            writeFileSync(
              `${evidenceDir}/layout-measurements.json`,
              JSON.stringify(measurements, null, 2),
            );
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
    .getByRole("textbox", { name: tr("zh-CN", "orders2b2.finance.item"), exact: true })
    .nth(0);
  await input.fill("DEMO retained failed draft");
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
  await expect(input).toHaveValue("DEMO retained failed draft");
  await capture(page, "order-quote-save-failure");
  await page.keyboard.press("Escape");
  await editor
    .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.confirmDiscard") })
    .click();
  await expect(quote).toBeFocused();
  await expect(main).not.toContainText("DEMO retained failed draft");
  await page.locator("#order-detail-mobile-tab-photos").click();
  await expect(page.locator("[data-order-detail-photo-slots]")).toBeVisible();
  await capture(page, "order-photos");
  await page.locator("#order-detail-mobile-tab-records").click();
  await expect(page.locator("[data-order-records-timeline]")).toBeVisible();
  await capture(page, "order-history");
  await noOverflow(page);
});
