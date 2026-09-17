import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { translateMessage as tr } from "@/shared/i18n/messages";
import { fillPhoneInput, setKeyboardDeviceViewport } from "./input-keypad-helpers";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires the isolated synthetic business fixture.",
);
const samples = [
  { width: 390, height: 844, locale: "zh-CN" },
  { width: 768, height: 1024, locale: "it-IT" },
  { width: 1024, height: 768, locale: "en" },
  { width: 1440, height: 900, locale: "zh-CN" },
] as const;
type Locale = (typeof samples)[number]["locale"];

async function screenshot(page: Page, name: string) {
  const path = process.env.DIRECT_EDIT_EVIDENCE_DIR
    ? `${process.env.DIRECT_EDIT_EVIDENCE_DIR}/${name}.png`
    : test.info().outputPath(`${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}
async function fitsViewport(page: Page, surface: Locator) {
  const metrics = await surface.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(metrics.overflow).toBe(false);
  expect(metrics.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.top).toBeGreaterThanOrEqual(-1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.height + 1);
}
async function openOrder(page: Page, locale: Locale) {
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: locale, url: String(test.info().project.use.baseURL) },
    ]);
  await page.goto("/orders/ord_47");
  await expect(
    page.getByText("R2026047", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
}
async function saveEditor(editor: Locator, locale: Locale) {
  await editor
    .getByRole("button", { name: tr(locale, "orders2b2.hero.save"), exact: true })
    .click();
  await expect(editor).toBeHidden();
}
async function phoneValue(field: Locator) {
  return field.evaluate((node) =>
    node instanceof HTMLInputElement ? node.value : node.textContent?.replace(/\s+/g, ""),
  );
}

for (const [index, sample] of samples.entries()) {
  test(`${sample.width} ${sample.locale}: direct contacts, failures, cancellation and missing unlock`, async ({
    page,
  }) => {
    const locale = sample.locale;
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await setKeyboardDeviceViewport(page, sample);
    await openOrder(page, locale);
    const phoneTrigger =
      sample.width < 1024
        ? page.getByRole("button", {
            name: tr(locale, "orders2b2.overview.customerInfo"),
            exact: true,
          })
        : page.getByRole("button", { name: /^\+[\d\s().-]+$/ }).first();
    await phoneTrigger.click();
    const editor = page.locator('[data-order-identity-editor="customer"]');
    await expect(editor).toBeVisible();
    const main = editor.getByLabel(tr(locale, "customers.form.phone"), { exact: true });
    const newPhone = `+39333${String(Date.now() % 10000000).padStart(7, "0")}${index}`;
    await fillPhoneInput(page, main, newPhone);

    let failedRequest: { input: Record<string, unknown> } | undefined;
    await page.route(
      "**/api/repairdesk/order/patch",
      async (route) => {
        failedRequest = route.request().postDataJSON();
        await route.fulfill({
          status: 503,
          json: { error: "Synthetic save failure", code: "UNAVAILABLE" },
        });
      },
      { times: 1 },
    );
    await editor
      .getByRole("button", { name: tr(locale, "orders2b2.hero.save"), exact: true })
      .click();
    await expect(editor.getByRole("alert")).toBeVisible();
    expect(await phoneValue(main)).toBe(newPhone);
    expect(failedRequest?.input.expected_customer_updated_at).toEqual(expect.any(String));
    await editor
      .getByRole("button", { name: tr(locale, "common.cancel"), exact: true })
      .first()
      .click();
    await expect(editor.locator("[data-editor-discard]")).toBeVisible();
    await editor
      .getByRole("button", { name: tr(locale, "orders.faultEditor.keep"), exact: true })
      .click();
    expect(await phoneValue(main)).toBe(newPhone);
    await screenshot(page, `${sample.width}-${locale}-customer-failure-retained`);
    await fitsViewport(page, editor);
    await saveEditor(editor, locale);
    await phoneTrigger.click();
    expect(await phoneValue(main)).toBe(newPhone);

    await editor
      .getByRole("button", { name: tr(locale, "orders2b2.backupPhone.add"), exact: true })
      .click();
    const backup = editor.getByLabel(`${tr(locale, "orders2b2.backupPhone.label")} 1`, {
      exact: true,
    });
    await fillPhoneInput(page, backup, `+39333000920${index}`);
    await saveEditor(editor, locale);
    await phoneTrigger.click();
    expect(await phoneValue(backup)).toBe(`+39333000920${index}`);
    await editor
      .getByRole("button", { name: `${tr(locale, "orders2b2.backupPhone.delete")} 1`, exact: true })
      .click();
    await saveEditor(editor, locale);
    await phoneTrigger.click();
    await expect(backup).toHaveCount(0);
    await fillPhoneInput(page, main, "+393330009800");
    await page.keyboard.press("Escape");
    await editor
      .getByRole("button", { name: tr(locale, "orders.faultEditor.confirmDiscard"), exact: true })
      .click();
    await expect(editor).toBeHidden();
    await phoneTrigger.click();
    expect(await phoneValue(main)).toBe(newPhone);
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden();

    await page.reload();
    await expect(
      page.getByText(newPhone, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await screenshot(page, `${sample.width}-${locale}-detail-saved`);
    expect(pageErrors).toEqual([]);
  });
  test(`${sample.width} ${sample.locale}: missing unlock can be saved, reopened and cleared`, async ({
    page,
  }) => {
    const locale = sample.locale;
    await setKeyboardDeviceViewport(page, sample);
    await openOrder(page, locale);
    await page
      .getByRole("button", { name: tr(locale, "orders2b2.unlock.add"), exact: true })
      .click();
    const unlock = page.getByRole("dialog", {
      name: tr(locale, "orders2b2.unlock.edit"),
      exact: true,
    });
    await expect(unlock).toBeVisible();
    await screenshot(page, `${sample.width}-${locale}-missing-unlock-entry`);
    await unlock.locator('[data-device-unlock-method="text"]').click();
    await unlock.getByRole("textbox").fill("synthetic-demo-only");
    await saveEditor(unlock, locale);
    await page
      .getByRole("button", { name: tr(locale, "orders2b2.unlock.edit"), exact: true })
      .click();
    await expect(unlock.getByRole("textbox")).toHaveValue("synthetic-demo-only");
    await unlock.locator('[data-device-unlock-method="none"]').click();
    await saveEditor(unlock, locale);
    await expect(
      page.getByRole("button", { name: tr(locale, "orders2b2.unlock.add"), exact: true }),
    ).toBeVisible();
  });
}

test("desktop inline quote protects its draft and hands off only after discard", async ({
  page,
}) => {
  const locale = "en";
  await setKeyboardDeviceViewport(page, { width: 1440, height: 900 });
  await openOrder(page, locale);
  const quoteTrigger = page
    .locator("[data-order-workbench-repairs] button")
    .filter({ hasText: tr(locale, "orders2b2.overview.quoteItems") })
    .first();
  await quoteTrigger.click();
  const editor = page.locator('[data-order-desktop-finance-editor="true"]');
  await expect(editor).toBeVisible();
  expect(
    await editor.evaluate((node) => Boolean(node.closest("[data-order-workbench-repairs]"))),
  ).toBe(true);
  const item = editor.locator("[data-order-quote-text-control] button").first();
  await item.click();
  const popup = page.locator('[data-order-quote-popup="true"]');
  await popup.getByRole("textbox").fill("Synthetic retained quote");
  await popup.getByRole("button", { name: tr(locale, "orders2b2.hero.save"), exact: true }).click();
  await expect(item).toContainText("Synthetic retained quote");
  await expect(page.getByRole("button", { name: "WhatsApp", exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: /^\+[\d\s().-]+$/ })
    .first()
    .click();
  await expect(editor.locator("[data-editor-discard]")).toBeVisible();
  await expect(page.locator("[data-order-identity-editor]")).toHaveCount(0);
  await editor
    .getByRole("button", { name: tr(locale, "orders.faultEditor.keep"), exact: true })
    .click();
  await expect(item).toContainText("Synthetic retained quote");
  await screenshot(page, "1440-en-inline-quote-dirty");
  await editor.getByRole("button", { name: tr(locale, "common.cancel"), exact: true }).click();
  await editor
    .getByRole("button", { name: tr(locale, "orders.faultEditor.confirmDiscard"), exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await quoteTrigger.click();
  await expect(item).not.toContainText("Synthetic retained quote");
  await editor.getByRole("button", { name: tr(locale, "common.cancel"), exact: true }).click();
});

for (const sample of samples) {
  test(`${sample.width}: memo and formal quote use natural bounded dialogs with reachable actions`, async ({
    page,
  }) => {
    await setKeyboardDeviceViewport(page, sample);
    await page
      .context()
      .addCookies([
        { name: "repairdesk_locale", value: "zh-CN", url: String(test.info().project.use.baseURL) },
      ]);
    await page.goto("/memos");
    await page.getByRole("button", { name: "新建备忘", exact: true }).first().click();
    const memo = page.getByRole("dialog", { name: "新建备忘", exact: true });
    await expect(memo).toBeVisible();
    await screenshot(page, `${sample.width}-memo-natural-dialog`);
    await fitsViewport(page, memo);
    const size = (await memo.boundingBox())!;
    if (sample.width >= 768) expect(size.width).toBeLessThanOrEqual(576.1);
    expect(size.height).toBeLessThan(sample.height - 80);
    await expect(memo.getByRole("button", { name: "添加待办", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(memo).toBeHidden();
    if (sample.width < 1024) {
      await page.goto("/orders/ord_47/task");
      await page
        .getByRole("button", { name: tr("zh-CN", "orders2b1.task.diagnoseQuote"), exact: true })
        .click();
    } else {
      await openOrder(page, "zh-CN");
      await page.getByRole("button", { name: "检测与正式报价", exact: true }).click();
    }
    const quote = page.getByRole("dialog", { name: "检测与正式报价", exact: true });
    await expect(quote).toBeVisible();
    await screenshot(page, `${sample.width}-formal-quote-natural-dialog`);
    await fitsViewport(page, quote);
    if (sample.width >= 768) expect((await quote.boundingBox())!.width).toBeLessThanOrEqual(860.1);
    await page.keyboard.press("Escape");
    await expect(quote).toBeHidden();
  });
}

for (const width of [390, 768, 1440]) {
  test(`${width}: formal quote keeps dirty input and replays an uncertain submission`, async ({
    page,
  }) => {
    const locale = "en";
    await setKeyboardDeviceViewport(page, { width, height: width === 768 ? 1024 : 900 });
    await page
      .context()
      .addCookies([
        { name: "repairdesk_locale", value: locale, url: String(test.info().project.use.baseURL) },
      ]);
    await page.goto(width < 1024 ? "/orders/ord_47/task" : "/orders/ord_47");
    const trigger = page.getByRole("button", {
      name: tr(locale, width < 1024 ? "orders2b1.task.diagnoseQuote" : "orders2b1.quote.title"),
      exact: true,
    });
    await trigger.click();
    const quote = page.getByRole("dialog", {
      name: tr(locale, "orders2b1.quote.title"),
      exact: true,
    });
    const diagnosis = quote.getByRole("textbox", {
      name: tr(locale, "orders2b1.quote.diagnosis"),
      exact: true,
    });
    const baseline = await diagnosis.inputValue();
    await diagnosis.fill("Synthetic retained formal diagnosis");
    await page.keyboard.press("Escape");
    await expect(
      quote.getByRole("button", { name: tr(locale, "orders.faultEditor.keep"), exact: true }),
    ).toBeVisible();
    await quote
      .getByRole("button", { name: tr(locale, "orders.faultEditor.keep"), exact: true })
      .click();
    await expect(diagnosis).toHaveValue("Synthetic retained formal diagnosis");
    await expect(diagnosis).toBeFocused();
    const requests: unknown[] = [];
    await page.route("**/api/repairdesk/order/publish-quote", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic unavailable response", code: "UNAVAILABLE" },
      });
    });
    const publish = quote.getByRole("button", {
      name: tr(locale, "orders2b1.quote.publish"),
      exact: true,
    });
    await publish.click();
    await expect(
      quote.getByText(tr(locale, "orders2b1.quote.saveFailed"), { exact: true }),
    ).toBeVisible();
    await expect(diagnosis).toBeDisabled();
    await publish.click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toEqual(requests[0]);
    await expect(
      quote.getByText(tr(locale, "orders2b1.quote.saveFailed"), { exact: true }),
    ).toBeVisible();
    await quote.getByRole("button", { name: tr(locale, "common.cancel"), exact: true }).click();
    await expect(
      quote.getByRole("button", {
        name: tr(locale, "orders.faultEditor.confirmDiscard"),
        exact: true,
      }),
    ).toBeInViewport();
    await fitsViewport(page, quote);
    await screenshot(page, `${width}-formal-quote-retry-discard`);
    await quote
      .getByRole("button", { name: tr(locale, "orders.faultEditor.confirmDiscard"), exact: true })
      .click();
    await expect(quote).toBeHidden();
    await trigger.click();
    await expect(diagnosis).toHaveValue(baseline);
    await page.keyboard.press("Escape");
    await expect(quote).toBeHidden();
  });
}
