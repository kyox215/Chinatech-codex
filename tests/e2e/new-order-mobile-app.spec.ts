import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { translateMessage as tr } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Synthetic fixture only.");
const root = process.env.NEW_ORDER_V9_EVIDENCE_DIR;
async function shot(page: Page, name: string) {
  if (!root) return;
  mkdirSync(root, { recursive: true });
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
  });
  await page.screenshot({ path: `${root}/${name}.png`, animations: "disabled" });
}
async function start(page: Page, locale: AppLocale, width = 390, height = 844) {
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: locale, url: String(test.info().project.use.baseURL) },
    ]);
  await page.setViewportSize({ width, height });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-new-order-mobile-app]")).toBeVisible();
}
const customer = {
  customer: {
    id: "v9-customer-a",
    name: "Demo Customer A",
    phone_e164: "2025550100",
    phone_raw: "2025550100",
    contact_phones: [],
    consent_marketing: false,
    consent_sms: false,
  },
  exactMatch: true,
  phoneMatchKind: "exact_primary",
  nameMatchKind: "exact",
  historyDevices: [
    {
      id: "v9-device-a",
      customer_id: "v9-customer-a",
      source: "customer_device",
      device_id: "v9-device-a",
      brand: "Apple",
      model: "iPhone 15 Pro",
      serial_or_imei: "490154203237518",
    },
  ],
};
for (const [locale, width, height] of [
  ["zh-CN", 390, 844],
  ["it-IT", 320, 350],
  ["en", 430, 932],
] as const) {
  test(`one editor retains drafts and returns focus ${locale} ${width}x${height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/repairdesk/customers/intake-search", (route) =>
      route.fulfill({
        json: {
          data: [
            customer,
            {
              ...customer,
              customer: { ...customer.customer, id: "v9-customer-b", name: "Demo Customer B" },
              historyDevices: [],
            },
          ],
        },
      }),
    );
    await start(page, locale, width, height);
    await expect(
      page.locator('[data-new-order-field="device-custody"] [aria-pressed="true"]'),
    ).toHaveCount(0);
    await page.locator('[data-mobile-edit="customer"]').click();
    const editor = page.locator("[data-new-order-mobile-panel]").locator("xpath=..");
    await expect(
      editor.getByRole("button", { name: tr(locale, "common.close"), exact: true }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.matches("input,textarea"))).toBe(
      false,
    );
    const phone = page.getByRole("combobox", {
      name: tr(locale, "orders2b1.new.lookup.phoneAria"),
    });
    await phone.click();
    await page.keyboard.type("2025550100");
    // Select while the dock is still open: pointerdown must not move the option before click.
    const option = page.getByRole("option", { name: /Demo Customer A/ });
    await expect(page.getByRole("option")).toHaveCount(2);
    await option.click();
    await expect(page.locator("[data-new-order-mobile-panel]")).toHaveCount(0);
    await expect(page.locator('[data-mobile-edit="customer"]')).toContainText("Demo Customer A");
    await expect(page.locator('[data-mobile-edit="customer"]')).toBeFocused();
    await page.locator('[data-mobile-edit="device"]').click();
    await page.locator("#new-order-device-brand").fill("Retained brand");
    await editor
      .getByRole("button", { name: tr(locale, "orders2b1.new.historyModels"), exact: true })
      .click();
    await expect(page.locator('[data-new-order-mobile-panel="history"]')).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await editor
      .getByRole("button", { name: tr(locale, "orders2b1.new.lookup.backResults"), exact: true })
      .click();
    await expect(page.locator("#new-order-device-brand")).toHaveValue("Retained brand");
    await editor
      .getByRole("button", { name: tr(locale, "orders2b1.new.historyModels"), exact: true })
      .click();
    await editor.getByRole("button", { name: /Apple iPhone 15 Pro/ }).click();
    await expect(page.locator("#new-order-device-model")).toHaveValue("iPhone 15 Pro");
    await shot(page, `device-editor-${locale}-${width}x${height}`);
    const done = editor.getByRole("button", {
      name: tr(locale, "orders2b1.keypad.done"),
      exact: true,
    });
    const close = editor.getByRole("button", { name: tr(locale, "common.close"), exact: true });
    for (const control of [done, close]) {
      await expect
        .poll(async () => {
          const box = await control.boundingBox();
          return Boolean(box && box.y >= 0 && box.height >= 44 && box.y + box.height <= height + 1);
        })
        .toBe(true);
    }
    await done.click();
    await expect(page.locator('[data-mobile-edit="device"]')).toContainText("Apple iPhone 15 Pro");
    await page.locator('[data-new-order-field="device-custody"] button').first().click();
    await page.locator('[data-mobile-edit="notes"]').click();
    await page
      .getByRole("textbox", { name: tr(locale, "orders.newFlow.notes"), exact: true })
      .fill("Synthetic retained note");
    await close.click();
    await expect(editor).toContainText(tr(locale, "orders.newFlow.discardEdit"));
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await editor.getByRole("button", { name: tr(locale, "orders.newFlow.keepEditing") }).click();
    await expect(
      page.getByRole("textbox", { name: tr(locale, "orders.newFlow.notes"), exact: true }),
    ).toHaveValue("Synthetic retained note");
    await done.click();
    await page.locator('[data-mobile-edit="settings"]').click();
    await expect(editor.locator('[data-new-order-setting="operator"]')).toContainText(/./);
    await done.click();
    await page.locator("[data-fault-category]").first().getByRole("button").first().click();
    await page
      .getByRole("button", { name: tr(locale, "orders2b1.new.addCustomItem"), exact: true })
      .click();
    await page
      .getByRole("textbox", { name: tr(locale, "orders2b1.new.customItem"), exact: true })
      .fill("Labor");
    await page.evaluate(() => scrollTo(0, 0));
    if (height > 400) await shot(page, `main-two-quotes-${locale}-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

test("scanner replaces the device editor and returns its draft", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Synthetic unavailable", "NotAllowedError");
    };
  });
  await start(page, "zh-CN");
  await page.locator('[data-mobile-edit="device"]').click();
  await page.locator("#new-order-device-brand").fill("Apple");
  await page.locator("#new-order-device-model").fill("Kept draft");
  await page
    .getByRole("button", { name: tr("zh-CN", "inventory2b4.scanner.title"), exact: true })
    .click();
  await expect(page.locator("[data-new-order-mobile-panel]")).toHaveCount(0);
  const scanner = page.getByRole("dialog");
  await expect(scanner).toHaveCount(1);
  await expect(scanner).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-new-order-mobile-panel="device"]')).toBeVisible();
  await expect(page.locator("#new-order-device-model")).toHaveValue("Kept draft");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement?.matches("input,textarea"))).toBe(false);
  await shot(page, "scanner-return-device-390");
});

test("new-customer intent has an in-panel return and late search cannot reopen a closed editor", async ({
  page,
}) => {
  let notifyLateRequest!: () => void;
  let releaseLateRequest!: () => void;
  const lateRequestStarted = new Promise<void>((resolve) => {
    notifyLateRequest = resolve;
  });
  const lateRequestReleased = new Promise<void>((resolve) => {
    releaseLateRequest = resolve;
  });
  await page.route("**/api/repairdesk/customers/intake-search", async (route) => {
    const body = route.request().postDataJSON() as { phone?: string };
    if (body.phone === "2025550101") {
      notifyLateRequest();
      await lateRequestReleased;
      await route.fulfill({ json: { data: [customer] } });
      return;
    }
    await route.fulfill({ json: { data: [] } });
  });
  await start(page, "en");
  await page.locator('[data-mobile-edit="customer"]').click();
  await page.locator("[data-phone-keypad-trigger]").click();
  await page.keyboard.type("2025550100");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: tr("en", "orders2b1.new.results.createCurrent"), exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: tr("en", "orders2b1.new.lookup.backExisting"), exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: tr("en", "orders2b1.new.lookup.backExisting"), exact: true })
    .click();
  await page.locator("[data-phone-keypad-trigger]").click();
  await page.keyboard.press("Backspace");
  await page.keyboard.type("1");
  await page.keyboard.press("Enter");
  await lateRequestStarted;
  await page.getByRole("button", { name: tr("en", "orders2b1.keypad.done"), exact: true }).click();
  await expect(page.locator("[data-new-order-mobile-panel]")).toHaveCount(0);
  await page.locator('[data-mobile-edit="device"]').click();
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("customers/intake-search") &&
      candidate.request().postDataJSON().phone === "2025550101",
  );
  releaseLateRequest();
  await response;
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(page.locator('[data-new-order-mobile-panel="device"]')).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: tr("en", "common.close"), exact: true }),
  ).toBeFocused();
});
