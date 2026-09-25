import { devices, expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import type { FaultPriceItem } from "@/lib/repairdesk/types";
import { translateMessage } from "@/shared/i18n/messages";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires an isolated localhost synthetic preview; all save responses are intercepted.",
);

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test.describe(`${viewport.width}px shared quotation`, () => {
    test.use({
      viewport,
      hasTouch: viewport.width < 1280,
      contextOptions: { reducedMotion: "reduce" },
      ...(viewport.width < 1280
        ? { userAgent: devices[viewport.width < 768 ? "iPhone 13" : "iPad Pro 11"].userAgent }
        : {}),
    });

    for (const locale of ["zh-CN", "en", "it-IT"] as const) {
      test(`${locale}: shared rows, invalid draft, cancel, save and reopen`, async ({
        page,
        context,
        baseURL,
      }, testInfo) => {
        test.setTimeout(90_000);
        expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
        await context.route("**/*", (route) =>
          new URL(route.request().url()).origin === new URL(baseURL!).origin
            ? route.continue()
            : route.abort(),
        );
        await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
        const t = (key: Parameters<typeof translateMessage>[1]) => translateMessage(locale, key);
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));

        // Reuse the real new-order entry and quote primitives with local draft values only.
        const creation = await context.newPage();
        await creation.route("**/api/repairdesk/orders/create", (route) =>
          route.fulfill({ status: 400, json: { error: "Synthetic test: no order creation" } }),
        );
        await creation.goto("/orders/new", { waitUntil: "domcontentloaded" });
        const newQuote = creation.locator('[data-new-order-section="quotation"]');
        await newQuote.locator('[data-fault-category="battery"] > button').first().click();
        await setMoney(creation, moneyControl(newQuote).first(), "85");
        await expect(newQuote.locator("[data-order-workspace-quote-row]")).toHaveCount(1);
        await expect(newQuote.locator("[data-order-workspace-money-strip] > div")).toHaveCount(3);
        await newQuote.scrollIntoViewIfNeeded();
        await assertNoOverflow(creation);
        await capture(creation, testInfo, "new-order");
        await creation.close();

        const openingVersion = "2026-09-12T10:00:00.000Z";
        let version = openingVersion;
        let faults: FaultPriceItem[] = [
          {
            line_id: "10000000-0000-4000-8000-000000000001",
            name: "SYNTHETIC / Repair with an intentionally long description for the quote editor",
            note: "Stored note remains unchanged",
            price: 85,
          },
          {
            line_id: "10000000-0000-4000-8000-000000000002",
            name: "SYNTHETIC / Inspection",
            price: 60,
          },
        ];
        let deposit = 15;
        const saveRequests: Array<{
          input: {
            expected_updated_at: string;
            finance?: { fault_prices: FaultPriceItem[]; deposit_amount: number };
            fault_prices?: FaultPriceItem[];
            deposit_amount?: number;
          };
        }> = [];
        let failNextSave = locale === "en" && viewport.width === 1440;
        let releaseSave: (() => void) | undefined;
        await page.route("**/api/repairdesk/order/get", async (route) => {
          const response = await route.fetch();
          const json = await response.json();
          const total = faults.reduce((sum, fault) => sum + fault.price, 0);
          Object.assign(json.data.order, {
            fault_prices: faults,
            quotation_amount: total,
            deposit_amount: deposit,
            balance_amount: total - deposit,
            updated_at: version,
            finance_redacted: false,
          });
          await route.fulfill({ response, json });
        });
        await page.route("**/api/repairdesk/order/{patch,finance}", async (route) => {
          const request = route.request().postDataJSON();
          saveRequests.push(request);
          if (failNextSave) {
            failNextSave = false;
            await new Promise<void>((resolve) => {
              releaseSave = resolve;
            });
            await route.fulfill({ status: 503, json: { error: "Synthetic save failure" } });
            return;
          }
          const finance = request.input.finance ?? request.input;
          faults = finance.fault_prices;
          deposit = finance.deposit_amount;
          version = "2026-09-12T10:01:00.000Z";
          await route.fulfill({ json: { data: { id: "ord_1", updated_at: version } } });
        });

        await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
        const trigger =
          viewport.width < 680
            ? page
                .locator("#mobile-order-quote")
                .getByRole("button", { name: t("orders2b2.overview.quoteItems"), exact: true })
            : page.locator('[data-order-finance-summary-trigger="true"]:visible');
        await trigger.click();
        const editor = page.locator(
          '[data-order-desktop-finance-editor="true"], #mobile-order-finance-editor',
        );
        await expect(editor).toBeVisible();
        const firstAmount = moneyControl(
          editor.locator("[data-order-workspace-quote-row]").first(),
        );
        const strip = editor.locator("[data-order-workspace-money-strip]");
        await expect(strip.locator(":scope > div")).toHaveCount(3);
        await setMoney(page, firstAmount, "");
        await expect(firstAmount).toHaveAttribute("aria-invalid", "true");
        await expect(editor.getByRole("alert").first()).toHaveText(
          t("orders2b2.finance.completeItem"),
        );
        if (locale !== "zh-CN") {
          await expect(page.locator("body")).not.toContainText("请补全报价项目名称和金额。");
        }
        await expect(
          editor.getByRole("button", { name: t("orders2b2.hero.save"), exact: true }),
        ).toBeDisabled();
        await strip.scrollIntoViewIfNeeded();
        await assertNoOverflow(page);
        await capture(page, testInfo, "detail-invalid");

        await setMoney(page, firstAmount, "95.50");
        const beforeResize = await firstAmount.elementHandle();
        if (viewport.width === 820 || viewport.width === 1180) {
          await page.setViewportSize({ width: viewport.height, height: viewport.width });
          expect(await firstAmount.evaluate((element, old) => element === old, beforeResize)).toBe(
            true,
          );
          await expectAmount(firstAmount, "95.50");
          await assertNoOverflow(page);
          await capture(page, testInfo, "detail-rotated");
          await page.setViewportSize(viewport);
        }

        // Cancel uses the existing same-modal discard guard and restores the original trigger.
        await editor
          .getByRole("button", { name: t("common.cancel"), exact: true })
          .last()
          .click();
        await editor
          .getByRole("button", { name: t("orders.faultEditor.confirmDiscard"), exact: true })
          .click();
        await expect(editor).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(saveRequests).toHaveLength(0);
        await trigger.click();
        await expectAmount(firstAmount, "85");

        await setMoney(page, firstAmount, "95.50");
        const save = editor.getByRole("button", { name: t("orders2b2.hero.save"), exact: true });
        await strip.scrollIntoViewIfNeeded();
        await expect(save).toBeInViewport();
        await assertNoOverflow(page);
        await capture(page, testInfo, "detail-ready");
        await save.click();
        if (locale === "en" && viewport.width === 1440) {
          await expect.poll(() => Boolean(releaseSave)).toBe(true);
          await expect(firstAmount).toBeDisabled();
          await expect(
            editor.getByRole("button", { name: t("orders2b2.hero.saving"), exact: true }),
          ).toBeDisabled();
          await page.keyboard.press("Escape");
          await expect(editor).toBeVisible();
          expect(saveRequests).toHaveLength(1);
          await capture(page, testInfo, "detail-save-pending");
          releaseSave!();
          await expect(editor.getByRole("alert").first()).toBeVisible();
          await expectAmount(firstAmount, "95.50");
          await capture(page, testInfo, "detail-save-error");
          await save.click();
        }
        await expect(editor).toHaveCount(0);
        const saved = saveRequests.at(-1)!;
        expect(saved.input.expected_updated_at).toBe(openingVersion);
        expect(faults[0]).toMatchObject({
          line_id: "10000000-0000-4000-8000-000000000001",
          price: 95.5,
          note: "Stored note remains unchanged",
        });
        expect(deposit).toBe(15);
        await trigger.click();
        await expectAmount(firstAmount, "95.5");
        await expect(strip).toContainText(t("orders2b1.money.total"));
        await expect(strip).toContainText(t("orders2b1.money.deposit"));
        await expect(strip).toContainText(t("orders2b1.money.balance"));
        await page.keyboard.press("Escape");
        await expect(editor).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(pageErrors).toEqual([]);
      });
    }
  });
}

function moneyControl(scope: Locator) {
  return scope.locator(
    '[data-money-keypad-trigger="true"], [data-money-keypad-native-input="true"] input',
  );
}

async function setMoney(page: Page, field: Locator, value: string) {
  if (await field.evaluate((element) => element.tagName === "INPUT")) {
    await field.fill(value);
    await field.blur();
    return;
  }
  await field.click();
  const dock = page.locator('[data-virtual-keyboard-dock="true"]:visible');
  await dock.locator('[data-money-keypad-key="clear"]').click();
  for (const digit of value) await dock.locator(`[data-money-keypad-key="${digit}"]`).click();
  await dock.locator('[data-money-keypad-done="true"]').click();
  await expect(dock).toHaveCount(0);
}

async function expectAmount(field: Locator, value: string) {
  if (await field.evaluate((element) => element.tagName === "INPUT")) {
    await expect(field).toHaveValue(value);
  } else {
    await expect(field).toContainText(value);
  }
}

async function assertNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <=
        window.innerWidth + 1,
    ),
  ).toBe(true);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
    style: "nextjs-portal { visibility: hidden !important; }",
  });
}
