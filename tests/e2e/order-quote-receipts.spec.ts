import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { translateMessage as tr } from "@/shared/i18n/messages";
import { setKeyboardDeviceViewport } from "./input-keypad-helpers";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires isolated synthetic fixtures.",
);

async function fillAmount(page: Page, field: Locator, amount: string) {
  if (await field.evaluate((node) => node.tagName === "INPUT")) {
    await field.fill(amount);
    await field.blur();
    return;
  }
  await field.click();
  const keypad = page.locator("[data-money-keypad]").filter({ visible: true });
  await keypad.locator('[data-money-keypad-key="clear"]').click();
  for (const key of amount) await keypad.locator(`[data-money-keypad-key="${key}"]`).click();
  await keypad.locator("[data-money-keypad-done]").click();
}

for (const locale of ["zh-CN", "it-IT", "en"] as const) {
  for (const width of [390, 768, 1440]) {
    test(`receipts ${locale} ${width}: preview, minimum, retained failure and retry`, async ({
      page,
    }) => {
      const height = width === 768 ? 1024 : 900;
      await setKeyboardDeviceViewport(page, { width, height });
      await page.context().addCookies([
        {
          name: "repairdesk_locale",
          value: locale,
          url: String(test.info().project.use.baseURL),
        },
      ]);
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.route("**/api/repairdesk/order/get", async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        Object.assign(payload.data.order, {
          updated_at: "2026-09-17T10:00:00.000Z",
          quotation_amount: 100,
          deposit_amount: 20,
          balance_amount: 30,
          diagnosis_result: "Synthetic receipt preview",
          fault_prices: [
            {
              line_id: "00000000-0000-4000-8000-000000000311",
              name: "Synthetic repair",
              price: 100,
              currency_code: "EUR",
            },
          ],
        });
        await route.fulfill({ response, json: payload });
      });
      const requests: { input: Record<string, unknown> }[] = [];
      await page.route("**/api/repairdesk/order/publish-quote", async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
          status: 503,
          json: { error: "Synthetic unavailable response", code: "UNAVAILABLE" },
        });
      });
      await page.goto(width < 1024 ? "/orders/ord_47/task" : "/orders/ord_47");
      const trigger = page.getByRole("button", {
        name: tr(locale, width < 1024 ? "orders2b1.task.diagnoseQuote" : "orders2b1.quote.title"),
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: tr(locale, "orders2b1.quote.title"),
        exact: true,
      });
      const metric = (key: "orders2b1.quote.received" | "orders2b1.quote.balance") =>
        dialog.getByText(tr(locale, key), { exact: true }).locator("..");
      const amount = dialog.getByLabel(tr(locale, "orders2b1.quote.itemAmount", { index: 1 }), {
        exact: true,
      });
      const publish = dialog.getByRole("button", {
        name: tr(locale, "orders2b1.quote.publish"),
        exact: true,
      });
      await expect(metric("orders2b1.quote.received")).toContainText("€70.00");
      await expect(metric("orders2b1.quote.balance")).toContainText("€30.00");
      await fillAmount(page, amount, "120");
      await expect(metric("orders2b1.quote.balance")).toContainText("€50.00");
      await expect(publish).toBeEnabled();
      await metric("orders2b1.quote.received").scrollIntoViewIfNeeded();
      const receiptLabels = dialog.getByText(tr(locale, "orders2b1.quote.received"), {
        exact: true,
      });
      expect(await receiptLabels.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(
        true,
      );
      const path = `${process.env.DIRECT_EDIT_EVIDENCE_DIR ?? test.info().outputDir}/receipts-${locale}-${width}-preview.png`;
      mkdirSync(dirname(path), { recursive: true });
      await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
      await page.screenshot({ path });
      await fillAmount(page, amount, "69.99");
      await expect(
        dialog.getByText(tr(locale, "orders2b1.quote.missing.received"), { exact: true }),
      ).toBeVisible();
      await expect(publish).toBeDisabled();
      expect(requests).toHaveLength(0);
      await fillAmount(page, amount, "70");
      await expect(metric("orders2b1.quote.balance")).toContainText("€0.00");
      await expect(publish).toBeEnabled();
      await fillAmount(page, amount, "120");
      await publish.click();
      await expect(
        dialog.getByText(tr(locale, "orders2b1.quote.saveFailed"), { exact: true }),
      ).toBeVisible();
      await expect(amount).toBeDisabled();
      await expect(metric("orders2b1.quote.balance")).toContainText("€50.00");
      await publish.click();
      await expect.poll(() => requests.length).toBe(2);
      expect(requests[1]).toEqual(requests[0]);
      expect(requests[0].input.expected_updated_at).toBe("2026-09-17T10:00:00.000Z");
      expect(Object.keys(requests[0].input).sort()).toEqual(
        ["diagnosis_result", "expected_updated_at", "fault_prices", "idempotency_key"].sort(),
      );
      await expect(
        dialog.getByText(tr(locale, "orders2b1.quote.saveFailed"), { exact: true }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: tr(locale, "common.cancel"), exact: true }).click();
      await dialog
        .getByRole("button", { name: tr(locale, "orders.faultEditor.keep"), exact: true })
        .click();
      await expect(metric("orders2b1.quote.balance")).toContainText("€50.00");
      await dialog.getByRole("button", { name: tr(locale, "common.cancel"), exact: true }).click();
      await dialog
        .getByRole("button", { name: tr(locale, "orders.faultEditor.confirmDiscard"), exact: true })
        .click();
      await expect(dialog).toBeHidden();
      await trigger.click();
      await expect(metric("orders2b1.quote.balance")).toContainText("€30.00");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(pageErrors).toEqual([]);
    });
  }
}
