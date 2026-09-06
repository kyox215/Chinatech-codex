import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { translateMessage as tr } from "@/shared/i18n/messages";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
test.skip(!enabled, "Requires the local synthetic business fixture.");
const baseURL = () => String(test.info().project.use.baseURL);
const screenshotDir = process.env.COMPACT_EDIT_EVIDENCE_DIR;
const locales = ["zh-CN", "it-IT", "en"] as const;

async function screenshot(page: Page, name: string) {
  const path = screenshotDir
    ? `${screenshotDir}/${name}.png`
    : test.info().outputPath(`${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  // Capture settled CSS/Framer states, rather than the first visible animation frame.
  await page.waitForTimeout(300);
  await page.screenshot({ path, fullPage: false });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
async function bottomEditor(page: Page, editor: Locator, width: number, height: number) {
  await expect(editor).toBeVisible();
  await expect
    .poll(async () => {
      const rect = await editor.boundingBox();
      return Boolean(
        rect &&
        rect.x >= -1 &&
        rect.y >= -1 &&
        rect.x + rect.width <= width + 1 &&
        Math.abs(rect.y + rect.height - height) <= 2,
      );
    })
    .toBe(true);
  await noOverflow(page);
}

for (const locale of locales)
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    test(`compact A ${locale} ${width}px`, async ({ page }) => {
      test.setTimeout(60000);
      const height = width < 768 ? 844 : 1000;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .context()
        .addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL() }]);
      await page.setViewportSize({ width, height });
      await page.goto("/orders/ord_1");
      await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
      await noOverflow(page);
      if (width < 1024) {
        const tabs = page.locator('[data-order-detail-tabs="true"] [role="tab"]');
        await expect(tabs).toHaveCount(3);
        const widths = await tabs.evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width),
        );
        expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
        await page.locator('[data-order-detail-tab="photos"]').click();
        await expect(page.locator('[data-order-detail-tab="photos"]')).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.locator('[data-order-detail-photo-slots="true"]')).toBeVisible();
        await screenshot(page, `order-photos-${locale}-${width}`);
        await page.locator('[data-order-detail-tab="overview"]').click();
        const quote = page.locator("#mobile-order-quote");
        await quote
          .getByRole("button", { name: tr(locale, "orders2b2.overview.quoteItems") })
          .click();
        const editor = page.locator("#mobile-order-finance-editor");
        await bottomEditor(page, editor, width, height);
        const grid = editor.locator('[data-fault-diagnosis-picker="true"]');
        await expect(grid.locator("[data-fault-category]")).toHaveCount(12);
        expect(Math.round((await grid.boundingBox())!.height)).toBe(107);
        await screenshot(page, `order-quote-${locale}-${width}`);
        const input = editor
          .getByRole("textbox", { name: tr(locale, "orders2b2.finance.item"), exact: true })
          .first();
        await input.fill("Synthetic retained draft");
        await input.focus();
        await page.keyboard.press("Escape");
        await editor.getByRole("button", { name: tr(locale, "orders.faultEditor.keep") }).click();
        await expect(input).toHaveValue("Synthetic retained draft");
        await expect(input).toBeFocused();
        await page.keyboard.press("Escape");
        await editor
          .getByRole("button", { name: tr(locale, "orders.faultEditor.confirmDiscard") })
          .click();
        await expect(editor).toHaveCount(0);
        await expect(quote).not.toContainText("Synthetic retained draft");
      } else {
        await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
        await expect(page.getByText("屏幕总成", { exact: true }).first()).toBeVisible();
        await screenshot(page, `order-desktop-${locale}-${width}`);
      }
      await page.goto("/orders/new");
      // As in the existing new-order stories, let streaming and store bootstrap settle.
      // Assert one renderer after readiness instead of matching hidden initialization DOM.
      await page.waitForLoadState("networkidle");
      const forms = page.locator('[data-new-order-form="true"]');
      await expect(forms).toHaveCount(1);
      const form = forms.filter({ visible: true });
      await expect(form).toHaveCount(1);
      await expect(form).toBeVisible();
      const grid = form.locator('[data-fault-diagnosis-picker="true"]');
      await expect(grid.locator("[data-fault-category]")).toHaveCount(12);
      expect(Math.round((await grid.boundingBox())!.height)).toBe(107);
      const trigger = grid.locator("[data-fault-category]").first();
      await trigger.click();
      const options = page.getByRole("dialog").filter({ visible: true }).last();
      await expect(options).toBeVisible();
      await expect(options).toHaveCSS("opacity", "1");
      if (width < 1024) await bottomEditor(page, options, width, height);
      await options.getByRole("group").getByRole("button").last().focus();
      await expect(options.getByRole("group").getByRole("button").last()).toBeFocused();
      await screenshot(page, `new-order-options-${locale}-${width}`);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await noOverflow(page);
      expect(errors).toEqual([]);
    });
  }

test("customer long form retains draft and keeps footer reachable at compressed height", async ({
  page,
}) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  await page.setViewportSize({ width: 320, height: 350 });
  await page.goto("/customers/cus_1");
  await expect(page.getByRole("button", { name: "编辑客户资料" }).first()).toBeVisible();
  await page.getByRole("button", { name: "编辑客户资料" }).last().click();
  const editor = page.getByRole("dialog").filter({ visible: true }).last();
  await bottomEditor(page, editor, 320, 350);
  const field = editor.locator("input").first();
  await field.fill("Synthetic retained customer");
  const save = editor.getByRole("button", { name: "保存", exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await screenshot(page, "customer-editor-320x350");
  await page.keyboard.press("Escape");
  await editor.getByRole("button", { name: "继续编辑" }).click();
  await expect(field).toHaveValue("Synthetic retained customer");
  await noOverflow(page);
});

test("pointer opening restores the actual content trigger for order and customer", async ({
  page,
}) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders/ord_1");
  const opener = page
    .locator("#mobile-order-quote")
    .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.quoteItems") });
  await opener.click();
  const editor = page.locator("#mobile-order-finance-editor");
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.goto("/customers/cus_1");
  const customer = page.getByRole("button", { name: "编辑客户资料" }).last();
  await customer.click();
  const customerEditor = page.getByRole("dialog").filter({ visible: true }).last();
  await expect(customerEditor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(customerEditor).toHaveCount(0);
  await expect(customer).toBeFocused();
});
