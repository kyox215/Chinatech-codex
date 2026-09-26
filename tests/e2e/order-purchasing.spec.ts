import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { orderPurchasingCopy } from "../../src/features/orders/model/order-purchasing-i18n";
import { runEvidencePath } from "./helpers/evidence";

const enabled =
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1" &&
  process.env.REPAIRDESK_ORDER_PURCHASING_ENABLED === "1";
test.skip(!enabled, "Requires isolated synthetic purchasing server.");
const screenshots = runEvidencePath("screenshots/order-purchasing");
const scenarios = [
  { name: "phone-zh", width: 390, height: 844, locale: "zh-CN", touch: true },
  { name: "ipad-portrait-it", width: 768, height: 1024, locale: "it-IT", touch: true },
  { name: "ipad-landscape-en", width: 1024, height: 768, locale: "en", touch: true },
  { name: "desktop-en", width: 1440, height: 1000, locale: "en", touch: false },
] as const;
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function fillMoney(page: Page, label: string, value: string) {
  const input = page.getByRole("textbox", { name: label, exact: true });
  if (await input.count()) {
    await input.fill(value);
    await input.press("Tab");
    return;
  }
  await page.getByRole("button", { name: label, exact: true }).click();
  const keypad = page.locator('[data-money-keypad="true"]');
  await keypad.locator('[data-money-keypad-key="clear"]').click();
  for (const character of value)
    await keypad.locator(`[data-money-keypad-key="${character}"]`).click();
  await keypad.locator('[data-money-keypad-done="true"]').click();
}
for (const scenario of scenarios) {
  test.describe(scenario.name, () => {
    test.use({
      viewport: { width: scenario.width, height: scenario.height },
      hasTouch: scenario.touch,
      ...(scenario.touch
        ? {
            userAgent:
              scenario.width < 500
                ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
                : "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
          }
        : {}),
    });
    test("purchase cost, save, reload, supplier batch and arrival", async ({ page, baseURL }) => {
      test.setTimeout(120_000);
      const copy = orderPurchasingCopy(scenario.locale);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .context()
        .addCookies([{ name: "repairdesk_locale", value: scenario.locale, url: baseURL! }]);
      await page.goto("/orders", { waitUntil: "domcontentloaded" });
      await page.locator('[data-order-presentation-control="board"]').click();
      const board = page.locator('[data-order-purchasing-board="true"]');
      await expect(board).toBeVisible();
      const order = board.locator("[data-purchase-order]").first();
      const orderId = await order.getAttribute("data-purchase-order");
      const run = Date.now().toString(36);
      const names = [`Screen ${scenario.name} ${run}`, `Battery ${scenario.name} ${run}`];
      for (const name of names) {
        await order.getByRole("button", { name: copy.add, exact: true }).click();
        const editor = page.locator('[data-order-purchasing-editor="true"]');
        await editor.getByRole("textbox", { name: copy.part, exact: true }).fill(name);
        await editor
          .getByRole("combobox", { name: copy.supplier, exact: true })
          .selectOption({ index: 1 });
        await editor.getByRole("button", { name: copy.saveOrder, exact: true }).click();
        await expect(editor.getByRole("alert")).toBeVisible();
        await fillMoney(page, copy.cost, "12.50");
        await editor.getByRole("textbox", { name: copy.quantity, exact: true }).fill("2");
        await noOverflow(page);
        mkdirSync(screenshots, { recursive: true });
        if (name === names[0])
          await page.screenshot({
            path: `${screenshots}/${scenario.name}-editor.png`,
            fullPage: false,
          });
        await editor.getByRole("button", { name: copy.saveOrder, exact: true }).click();
        await expect(editor).toBeHidden();
        await expect(order.locator("[data-purchase-line]").filter({ hasText: name })).toContainText(
          copy.ordered,
        );
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator('[data-order-presentation-control="board"]').click();
      const reopened = board.locator(`[data-purchase-order="${orderId}"]`);
      for (const name of names) {
        const row = reopened.locator("[data-purchase-line]").filter({ hasText: name });
        await expect(row).toContainText(/12[,.]50/);
        await row.getByRole("checkbox").check();
      }
      const batch = board.locator('[data-purchasing-batch="true"]');
      await expect(batch).toBeInViewport();
      await batch.getByRole("button", { name: copy.batchSupplier, exact: true }).click();
      const editor = page.locator('[data-order-purchasing-editor="true"]');
      await expect(editor.getByRole("textbox", { name: copy.cost, exact: true })).toHaveCount(0);
      await editor
        .getByRole("combobox", { name: copy.supplier, exact: true })
        .selectOption({ index: 1 });
      const supplierName = await editor
        .getByRole("combobox", { name: copy.supplier, exact: true })
        .locator("option:checked")
        .innerText();
      await editor.getByRole("button", { name: copy.save, exact: true }).click();
      await expect(editor).toBeHidden();
      for (const name of names)
        await expect(
          reopened.locator("[data-purchase-line]").filter({ hasText: name }),
        ).toContainText(supplierName);
      for (const name of names)
        await reopened
          .locator("[data-purchase-line]")
          .filter({ hasText: name })
          .getByRole("checkbox")
          .check();
      await batch.getByRole("button", { name: copy.batchArrived, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: copy.apply, exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      for (const name of names)
        await expect(
          reopened.locator("[data-purchase-line]").filter({ hasText: name }),
        ).toContainText(copy.arrived);
      await noOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${screenshots}/${scenario.name}-board.png`, fullPage: false });
      if (scenario.name === "ipad-portrait-it") {
        await page.setViewportSize({ width: 1024, height: 768 });
        await noOverflow(page);
        await expect(reopened).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  });
}
