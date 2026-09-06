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
  // Hide only Next development instrumentation, never business controls.
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
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
        expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
          false,
        );
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
      const main = grid.locator("[data-fault-category]").first().getByRole("button").first();
      await main.click();
      await expect(main).toHaveAttribute("aria-pressed", "true");
      const trigger = grid.locator("[data-fault-category-expand]").first();
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

for (const width of [320, 390, 768]) {
  test(`A13 scoped editors and supplier ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const height = width === 320 ? 568 : width === 390 ? 844 : 1000;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page
      .context()
      .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
    await page.setViewportSize({ width, height });
    await page.route("**/api/repairdesk/options", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.suppliers = [
        {
          id: "a13-supplier-one",
          name: "Synthetic Parts",
          short_name: "Synthetic Parts",
          color: "var(--primary)",
        },
        {
          id: "a13-supplier-two",
          name: "Synthetic Components",
          short_name: "SC",
          color: "var(--primary)",
        },
      ];
      await route.fulfill({ response, json: body });
    });
    await page.goto("/orders/ord_1");
    await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toBe("");
    await page
      .locator("#mobile-order-quote")
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.quoteItems") })
      .click();
    const editor = page.locator("#mobile-order-finance-editor");
    await bottomEditor(page, editor, width, height);
    expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
      false,
    );
    await editor.getByRole("button", { name: tr("zh-CN", "orders2b2.finance.add") }).click();
    const emptyRow = editor.locator("[data-order-workspace-quote-row]").last();
    await expect(emptyRow.locator("[data-money-keypad-trigger]")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await emptyRow.getByRole("textbox").fill("Synthetic incomplete quote");
    await expect(emptyRow.locator("[data-money-keypad-trigger]")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await emptyRow
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.deleteItem") })
      .click();
    const battery = editor.locator('[data-fault-category="battery"]').getByRole("button").first();
    await battery.click();
    const newPrice = editor
      .locator("[data-order-workspace-quote-row]")
      .last()
      .locator("[data-money-keypad-trigger]");
    await expect(newPrice).toHaveAttribute("aria-invalid", "true");
    await expect(editor.getByRole("alert")).toContainText(
      tr("zh-CN", "orders2b2.finance.completeItem"),
    );
    await newPrice.click();
    await editor.locator('[data-money-keypad-key="0"]').click();
    await editor.locator("[data-money-keypad-done]").click();
    await expect(newPrice).not.toHaveAttribute("aria-invalid", "true");
    await expect(newPrice).toContainText("0");
    await battery.click();
    const price = editor.locator("[data-money-keypad-trigger]").first();
    await price.click();
    const keypad = editor.locator("[data-virtual-keyboard-host] [data-money-keypad]");
    await expect(keypad).toBeVisible();
    await keypad.locator('[data-money-keypad-key="clear"]').click();
    await keypad.locator('[data-money-keypad-key="1"]').click();
    await keypad.locator('[data-money-keypad-key="."]').click();
    await keypad.locator('[data-money-keypad-key="5"]').click();
    await expect(keypad).toContainText("1.5");
    await expect(keypad.locator("[data-money-keypad-done]")).toBeInViewport();
    await noOverflow(page);
    await screenshot(page, `a13-quote-keypad-${width}`);
    await page.keyboard.press("Escape");
    await expect(keypad).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(price).toBeFocused();
    await expect(price).toContainText("1.5");
    await price.click();
    await editor.locator("[data-money-keypad-done]").click();
    await expect(editor).toBeVisible();
    await expect(price).toBeFocused();
    const name = editor
      .getByRole("textbox", { name: tr("zh-CN", "orders2b2.finance.item"), exact: true })
      .first();
    await price.click();
    await name.click();
    await expect(name).toBeFocused();
    await expect(keypad).toHaveCount(0);
    await page.keyboard.press("Escape");
    await editor.getByRole("button", { name: tr("zh-CN", "orders.faultEditor.keep") }).click();
    await expect(price).toContainText("1.5");
    await page.keyboard.press("Escape");
    await editor
      .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.confirmDiscard") })
      .click();
    await expect(editor).toHaveCount(0);

    await page.locator("[data-order-supplier-trigger]").filter({ visible: true }).last().click();
    const supplier = page.getByRole("dialog").filter({ visible: true }).last();
    const manage = supplier.getByRole("link", { name: "编辑供应商列表（新页面）" });
    await expect(manage).toHaveAttribute("href", "/settings?section=suppliers");
    await expect(manage).toHaveAttribute("target", "_blank");
    await expect(manage).toHaveAttribute("rel", "noopener noreferrer");
    await screenshot(page, `a13-supplier-picker-${width}`);
    await page.keyboard.press("Escape");
    await page.goto("/customers/cus_1");
    await expect(page.getByRole("button", { name: "编辑客户资料" })).toHaveCount(1);
    await page.getByRole("button", { name: "编辑客户资料" }).click();
    const customer = page.getByRole("dialog").filter({ visible: true }).last();
    await bottomEditor(page, customer, width, height);
    expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
      false,
    );
    await customer.locator("#customer-edit-phone").click();
    const phoneKeypad = customer.locator("[data-phone-keypad]");
    await expect(phoneKeypad).toBeVisible();
    await expect(phoneKeypad.locator("[data-phone-keypad-done]")).toBeInViewport();
    await screenshot(page, `a13-customer-keypad-${width}`);
    await phoneKeypad.locator("[data-phone-keypad-done]").click();
    const save = customer.getByRole("button", { name: "保存", exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("A13 customer tablet and desktop each expose one editing surface", async ({ page }) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/customers/cus_1");
    const trigger = page.getByRole("button", { name: "编辑客户资料" });
    await expect(trigger).toHaveCount(1);
    await expect(page.locator('[data-ui="customer-detail-mobile-header"]')).toBeVisible({
      visible: width < 1024,
    });
    await expect(page.locator('[data-ui="customer-detail-desktop-hero"]')).toBeVisible({
      visible: width >= 1024,
    });
    await expect(page.locator('[data-app-bar="true"]')).toBeVisible({
      visible: width >= 1024,
    });
    await trigger.click();
    const editor = page.getByRole("dialog").filter({ visible: true });
    await expect(editor).toHaveCount(1);
    await expect(editor).toBeVisible();
    await noOverflow(page);
    await page.keyboard.press("Escape");
  }
});

for (const width of [320, 390, 430, 768]) {
  test(`A14 aligned quote identity and notes ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    const height = width === 320 ? 568 : width === 768 ? 1000 : 844;
    await page
      .context()
      .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/orders/ord_1");
    await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
    await page
      .locator("#mobile-order-quote")
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.quoteItems") })
      .click();
    const quote = page.locator("#mobile-order-finance-editor");
    await bottomEditor(page, quote, width, height);
    const rows = quote.locator('[data-order-workspace-quote-row="true"]');
    for (const row of await rows.all()) {
      const rects = await row.evaluate((node) =>
        Array.from(node.children)
          .slice(0, 3)
          .map((child) => {
            const control =
              child.querySelector(
                "input, [data-money-keypad-trigger], [data-money-keypad-native-input], button",
              ) ?? child;
            const rect = control.getBoundingClientRect();
            return { y: rect.y, height: rect.height };
          }),
      );
      expect(
        Math.max(...rects.map((r) => r.y)) - Math.min(...rects.map((r) => r.y)),
      ).toBeLessThanOrEqual(1);
      rects.forEach((r) => expect(r.height).toBe(36));
    }
    const tiles = await quote
      .locator("[data-order-workspace-money-strip] > div")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.max(...tiles) - Math.min(...tiles)).toBeLessThanOrEqual(1);
    if (width === 390) await screenshot(page, "a14-quote-390");
    await page.keyboard.press("Escape");
    await expect(quote).toHaveCount(0);

    await page
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.deviceIssue"), exact: true })
      .click();
    const device = page.locator('[data-order-identity-editor="device"]');
    await bottomEditor(page, device, width, height);
    const close = device
      .getByRole("button", { name: "取消", exact: true })
      .filter({ has: page.locator("svg.lucide-x") });
    await device
      .locator("[data-editor-body]")
      .evaluate((node) => (node.scrollTop = node.scrollHeight));
    const closeRect = (await close.boundingBox())!;
    expect(closeRect.width).toBeGreaterThanOrEqual(44);
    expect(closeRect.height).toBeGreaterThanOrEqual(44);
    expect(
      await close.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    const footerButtons = device.locator("[data-editor-footer] > button");
    const footerRects = await footerButtons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { y: r.y, width: r.width, height: r.height };
      }),
    );
    expect(Math.abs(footerRects[0]!.y - footerRects[1]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(footerRects[0]!.width - footerRects[1]!.width)).toBeLessThanOrEqual(1);
    footerRects.forEach((r) => expect(r.height).toBeGreaterThanOrEqual(44));
    await device.locator("[data-editor-body]").evaluate((node) => (node.scrollTop = 0));
    if (width === 390) {
      await expect(
        device.getByRole("heading", { name: tr("zh-CN", "orders2b1.new.deviceInfo"), exact: true }),
      ).toBeVisible();
      await screenshot(page, "a14-device-390");
      const camera = device.getByRole("button").filter({ has: page.locator("svg.lucide-camera") });
      await camera.click();
      const capture = page.getByRole("dialog").filter({
        has: page.getByRole("heading", {
          name: tr("zh-CN", "inventory2b4.scanner.title"),
          exact: true,
        }),
      });
      await expect(capture).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(capture).toHaveCount(0);
      await expect(camera).toBeFocused();
      await expect(device).toBeVisible();
    }
    await close.click();
    await expect(device).toHaveCount(0);

    await page
      .getByRole("button", { name: tr("zh-CN", "orders.faultEditor.title"), exact: true })
      .click();
    const notes = page
      .getByRole("dialog")
      .filter({ has: page.locator('[data-order-fault-editor="true"]') });
    await expect(notes.getByRole("textbox")).toHaveCount(1);
    await expect(notes.getByRole("textbox")).toHaveAccessibleName(
      tr("zh-CN", "orders.notes.label"),
    );
    await expect(notes.getByText(tr("zh-CN", "orders.faultEditor.references"))).toHaveCount(0);
    if (width === 390) await screenshot(page, "a14-notes-390");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: tr("zh-CN", "orders2b2.overview.customerInfo"), exact: true })
      .click();
    const customer = page.locator('[data-order-identity-editor="customer"]');
    await bottomEditor(page, customer, width, height);
    await expect(customer.locator("[data-customer-identity-review]")).toBeVisible();
    await expect(
      customer.getByText(tr("zh-CN", "orders.faultEditor.dirty"), { exact: true }),
    ).toHaveCount(0);
    await expect(customer.locator("[data-customer-identity-results]")).toBeVisible();
    await expect(customer.getByRole("option")).toHaveCount(0);
    if (width === 390) {
      const phone = customer.locator("[data-phone-keypad-trigger]");
      await phone.click();
      await page.locator('[data-phone-keypad-key="clear"]').click();
      for (const digit of "13800000000")
        await page.locator(`[data-phone-keypad-key="${digit}"]`).click();
      await page.locator("[data-phone-keypad-done]").click();
      await expect(customer.getByRole("listitem")).toHaveCount(1);
      await expect(customer.getByRole("listitem").first()).toContainText("13800000000");
      await screenshot(page, "a14-customer-390");
    }
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

for (const width of [1024, 1440]) {
  test(`A14 desktop new quote ${width}px`, async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL() }]);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/orders/new");
    await page.waitForLoadState("networkidle");
    const form = page.locator('[data-new-order-form="true"]').filter({ visible: true });
    await form.locator("[data-fault-category]").first().getByRole("button").first().click();
    const rows = form.locator("[data-order-workspace-quote-row]");
    await expect(rows.first()).toBeVisible();
    await noOverflow(page);
    await screenshot(page, `a14-new-quote-${width}`);
  });
}

test("A14 Italian short-height keypad keeps close save and done reachable", async ({ page }) => {
  await page.context().addCookies([{ name: "repairdesk_locale", value: "it-IT", url: baseURL() }]);
  await page.setViewportSize({ width: 320, height: 350 });
  await page.goto("/orders/ord_1");
  await page
    .locator("#mobile-order-quote")
    .getByRole("button", { name: tr("it-IT", "orders2b2.overview.quoteItems") })
    .click();
  const editor = page.locator("#mobile-order-finance-editor");
  const price = editor.locator("[data-money-keypad-trigger]").first();
  await price.click();
  const keypad = editor.locator("[data-money-keypad]");
  await keypad.locator('[data-money-keypad-key="clear"]').click();
  await keypad.locator('[data-money-keypad-key="1"]').click();
  const close = editor.getByRole("button").filter({ has: page.locator("svg.lucide-x") });
  const save = editor
    .locator("[data-editor-footer]")
    .getByRole("button", { name: tr("it-IT", "orders2b2.hero.save"), exact: true });
  const done = keypad.locator("[data-money-keypad-done]");
  await done.scrollIntoViewIfNeeded();
  for (const control of [close, save, done]) {
    await expect(control).toBeInViewport();
    expect(
      await control.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
    ).toBe(true);
  }
  await screenshot(page, "a14-keypad-it-320x350");
  await page.keyboard.press("Escape");
  await expect(keypad).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(price).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    editor.getByRole("button", { name: tr("it-IT", "orders.faultEditor.keep") }),
  ).toBeVisible();
  await editor.getByRole("button", { name: tr("it-IT", "orders.faultEditor.keep") }).click();
  await expect(price).toContainText("1");
  await noOverflow(page);
});
