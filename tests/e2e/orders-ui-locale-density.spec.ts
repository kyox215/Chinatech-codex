import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { localeDisplayNames, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3182";
const baseOrigin = new URL(baseURL).origin;
const evidenceDir = resolve("artifacts/orders-locale-density-20260908");
const locales = ["zh-CN", "it-IT", "en"] as const;
const widths = [390, 430, 768, 1280] as const;
const readPosts = new Set([
  "/api/repairdesk/orders/queue-summary",
  "/api/repairdesk/orders/list-page",
  "/api/repairdesk/order/get",
  "/api/repairdesk/customers/search",
  "/api/repairdesk/customers/list-page",
  "/api/repairdesk/inventory/summary",
]);

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Requires the local mock app.");
test.beforeEach(() => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
});

async function prepare(page: Page, locale: AppLocale) {
  const blocked: string[] = [];
  const errors: string[] = [];
  await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.origin === baseOrigin &&
      (["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
        (request.method() === "POST" && readPosts.has(url.pathname)))
    ) {
      await route.fallback();
      return;
    }
    blocked.push(`${request.method()} ${url.pathname}`);
    await route.abort("blockedbyclient");
  });
  return { blocked, errors };
}

async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
}

async function fullText(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(
    await locator.evaluate((element) => ({
      fits: element.scrollWidth <= element.clientWidth + 1,
      ellipsis: getComputedStyle(element).textOverflow === "ellipsis",
    })),
  ).toEqual({ fits: true, ellipsis: false });
}

async function screenshot(page: Page, name: string) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: resolve(evidenceDir, `${name}.png`), animations: "disabled" });
}

for (const locale of locales) {
  for (const width of widths) {
    test(`orders controls ${locale} ${width}px`, async ({ page }) => {
      const evidence = await prepare(page, locale);
      await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
      await page.goto("/orders", { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(
        page.locator(width < 1024 ? "[data-order-mobile-list]" : "[data-order-desktop-list]"),
      ).toBeVisible();
      if (width < 1024) {
        const queue = page.locator("[data-order-queue-trigger]");
        const range = page.locator("[data-order-range-trigger]");
        const sort = page.locator("[data-order-sort-description] > span").first();
        await fullText(queue.locator("span").first());
        await fullText(range.locator("span").first());
        await fullText(sort);
        expect((await queue.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect((await range.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        const input = page.getByRole("textbox", {
          name: translateMessage(locale, "orders.searchLabel"),
        });
        expect(await input.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
        expect(
          await input.evaluate((element) => getComputedStyle(element, "::placeholder").fontSize),
        ).toBe("13px");
        await screenshot(page, `orders-${locale}-${width}`);

        await queue.click();
        const dialog = page.getByRole("dialog", {
          name: translateMessage(locale, "orders.workQueues"),
        });
        const choices = dialog.locator("[data-order-queue-option]");
        await expect(choices).toHaveCount(7);
        for (const option of await choices.all()) {
          await fullText(option.locator("span").nth(1));
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(queue).toBeFocused();

        if (locale === "it-IT" && width === 390) {
          for (const key of ["ordered", "arrived_notified", "repaired_notified", "all"]) {
            await queue.click();
            await page.locator(`[data-order-queue-option="${key}"]`).click();
            await expect(queue).toHaveAttribute("aria-busy", "false");
            await fullText(queue.locator("span").first());
          }
          for (const value of ["archive", "all", "active"] as const) {
            await range.click();
            await page
              .getByRole("dialog")
              .getByRole("button", {
                name: translateMessage(locale, `orders.range.${value}`),
                exact: true,
              })
              .click();
            await fullText(range.locator("span").first());
          }
          await input.fill("Synthetic-no-result-731");
          await input.press("Enter");
          await expect(input).toHaveValue("Synthetic-no-result-731");
          await page
            .getByRole("button", {
              name: translateMessage(locale, "orders.clearSearch"),
              exact: true,
            })
            .click();
          await expect(input).toHaveValue("");
          await noOverflow(page);
        }
      } else {
        await screenshot(page, `orders-${locale}-${width}`);
      }
      await noOverflow(page);
      expect(evidence.blocked).toEqual([]);
      expect(evidence.errors).toEqual([]);
    });
  }
}

for (const locale of locales) {
  test(`selected quote ${locale} keeps canonical names and custom text`, async ({ page }) => {
    test.setTimeout(60_000);
    const evidence = await prepare(page, locale);
    const saved: Array<{
      input: {
        fault_prices: Array<{ name: string; catalog_key?: string; note?: string; price: number }>;
      };
    }> = [];
    await page.route("**/api/repairdesk/order/get", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      Object.assign(payload.data.order, {
        status: "diagnosing",
        workflow_status: "active",
        workflow_bucket: "diagnosing",
        record_state: "active",
        deleted_at: null,
        finance_redacted: false,
        customer_name: "Synthetic UI customer",
        customer_name_snapshot: "Synthetic UI customer",
        customer_phone: "+390000000000",
        contact_phones: [],
        public_no: "SYNTHETIC-LOCALE-001",
        issue_description: "Synthetic screen repair",
        device_snapshot: {
          brand: "Apple",
          model: "iPhone 15",
          serial_or_imei: "",
          device_notes: "",
        },
        updated_at: "2026-09-08T00:00:00.000Z",
        device_custody_status: "with_shop",
        quotation_amount: 140,
        deposit_amount: 10,
        balance_amount: 130,
        fault_prices: [
          {
            line_id: "00000000-0000-4000-8000-000000000711",
            catalog_key: "display:main",
            name: "屏幕",
            note: "Display",
            price: 120,
          },
          {
            line_id: "00000000-0000-4000-8000-000000000712",
            name: "自定义项目 Ω",
            note: "原始备注 Ω",
            price: 20,
          },
        ],
      });
      payload.data.customer = null;
      payload.data.device = null;
      payload.data.events = [];
      payload.data.messages = [];
      payload.data.attachments = [];
      payload.data.capabilities = { ...payload.data.capabilities, canAdjustFinance: true };
      await route.fulfill({ response, json: payload });
    });
    await page.route("**/api/repairdesk/order/finance", async (route) => {
      saved.push(route.request().postDataJSON());
      await route.fulfill({ json: { data: { updated_at: "2026-09-08T00:01:00.000Z" } } });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/orders/ord_1", { waitUntil: "networkidle" });

    const openEditor = async (currentLocale: AppLocale) => {
      await page
        .locator("#mobile-order-quote")
        .getByRole("button", {
          name: translateMessage(currentLocale, "orders2b2.overview.quoteItems"),
          exact: true,
        })
        .click();
      return page.getByRole("dialog", {
        name: translateMessage(currentLocale, "orders2b2.overview.quoteItems"),
        exact: true,
      });
    };
    let editor = await openEditor(locale);
    const name = editor.locator("[data-order-quote-text-control] button").first();
    await expect(name).toHaveText(locale === "zh-CN" ? "屏幕" : "Display");
    await expect(editor).toContainText("自定义项目 Ω");
    for (const width of [390, 430, 768]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
      await noOverflow(page);
      await screenshot(page, `quote-${locale}-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await name.click();
    const popup = page.locator("[data-order-quote-popup]");
    await expect(popup.getByRole("textbox")).toHaveValue("屏幕");
    await popup
      .getByRole("button", { name: translateMessage(locale, "orders2b2.hero.save"), exact: true })
      .click();
    await expect(popup).toHaveCount(0);
    await expect(name).toBeFocused();
    await editor
      .getByRole("button", { name: translateMessage(locale, "common.cancel"), exact: true })
      .last()
      .click();
    await expect(editor).toHaveCount(0);
    expect(saved).toEqual([]);

    if (locale === "it-IT") {
      for (const nextLocale of ["en", "zh-CN", "it-IT"] as const) {
        // Detail intentionally hides AppBar; switch via the existing Orders shell.
        await page.setViewportSize({ width: 1280, height: 960 });
        await page.goto("/orders", { waitUntil: "networkidle" });
        await page.locator('[data-language-switcher-trigger="true"]:visible').first().click();
        await page.getByRole("menuitemradio", { name: localeDisplayNames[nextLocale] }).click();
        await expect(page.locator("html")).toHaveAttribute("lang", nextLocale);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/orders/ord_1", { waitUntil: "networkidle" });
        await expect(page.locator("#mobile-order-quote")).toContainText(
          nextLocale === "zh-CN" ? "屏幕" : "Display",
        );
        await expect(page.locator("#mobile-order-quote")).toContainText("自定义项目 Ω");
      }
    }
    editor = await openEditor(locale);
    await editor
      .getByRole("button", {
        name: locale === "zh-CN" ? "电池" : locale === "it-IT" ? "Batteria" : "Battery",
        exact: true,
      })
      .click();
    const names = editor.locator("[data-order-quote-text-control] button");
    await expect(names.last()).toHaveText(
      locale === "zh-CN" ? "电池" : locale === "it-IT" ? "Batteria" : "Battery",
    );
    await editor
      .getByRole("button", {
        name: translateMessage(locale, "orders2b2.finance.amount"),
        exact: true,
      })
      .last()
      .click();
    const keypad = page.locator("[data-money-keypad]");
    await keypad.getByRole("button", { name: "3", exact: true }).click();
    await keypad.getByRole("button", { name: "0", exact: true }).click();
    await page.locator("[data-money-keypad-done]").click();
    await editor
      .getByRole("button", { name: translateMessage(locale, "orders2b2.hero.save"), exact: true })
      .click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0]!.input.fault_prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalog_key: "display:main",
          name: "屏幕",
          price: 120,
          note: "Display",
        }),
        expect.objectContaining({ name: "自定义项目 Ω", price: 20, note: "原始备注 Ω" }),
        expect.objectContaining({ catalog_key: "battery:main", name: "电池", price: 30 }),
      ]),
    );
    expect(evidence.blocked).toEqual([]);
    expect(evidence.errors).toEqual([]);
  });
}
