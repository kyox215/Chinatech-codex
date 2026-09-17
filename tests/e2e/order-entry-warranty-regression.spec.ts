import { mkdirSync } from "node:fs";
import { devices, expect, test, type Page } from "@playwright/test";

import { translateMessage } from "@/shared/i18n/messages";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires an isolated localhost synthetic fixture; writes are intercepted.",
);

const evidenceDir = process.env.ORDER_ENTRY_WARRANTY_EVIDENCE_DIR;

test.beforeAll(async ({ request, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  // Compile both real routes before checking UI; the dev recovery guard can reload a cold route.
  for (const path of ["/orders/new", "/orders/ord_1"]) {
    expect((await request.get(path)).ok()).toBe(true);
  }
});

async function capture(page: Page, name: string) {
  if (!evidenceDir) return;
  mkdirSync(evidenceDir, { recursive: true });
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: `${evidenceDir}/${name}.png`, animations: "disabled" });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
]) {
  test.describe(`${viewport.width}px order entry warranty`, () => {
    test.use({
      viewport,
      hasTouch: viewport.width < 1440,
      contextOptions: { reducedMotion: "reduce" },
      ...(viewport.width < 1440
        ? { userAgent: devices[viewport.width < 768 ? "iPhone 13" : "iPad Pro 11"].userAgent }
        : {}),
    });

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      test(`${locale}: constrained quote draft and localized warranty`, async ({
        page,
        context,
        baseURL,
      }) => {
        test.setTimeout(90_000);
        expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
        await context.route("**/*", (route) =>
          new URL(route.request().url()).origin === new URL(baseURL!).origin
            ? route.continue()
            : route.abort(),
        );
        await context.route("**/api/repairdesk/orders/create", (route) =>
          route.fulfill({ status: 400, json: { error: "Synthetic fixture: no creation" } }),
        );
        await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
        const t = (
          key: Parameters<typeof translateMessage>[1],
          values?: Parameters<typeof translateMessage>[2],
        ) => translateMessage(locale, key, values);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));

        await page.goto("/orders/new", { waitUntil: "domcontentloaded" });
        await page
          .getByRole("button", { name: t("orders2b1.new.addCustomItem"), exact: true })
          .click();
        const trigger = page.getByRole("button", {
          name: t("orders2b1.new.customItem"),
          exact: true,
        });
        await trigger.click();
        const popup = page.locator('[data-order-quote-popup="true"]');
        const input = popup.getByRole("textbox");
        await expect(popup).toBeFocused();
        await expect(input).toHaveAttribute("maxlength", "120");
        await input.fill("A".repeat(121));
        await expect(input).toHaveValue("A".repeat(120));
        await expect(input).toHaveAccessibleDescription(
          t("orders.notes.characterCount", { count: "120/120" }),
        );
        const save = popup.getByRole("button", { name: t("orders2b2.hero.save"), exact: true });
        await expect(save).toBeInViewport();
        await noOverflow(page);
        await capture(page, `quote-limit-${locale}-${viewport.width}`);
        if (viewport.width === 820) {
          await page.setViewportSize({ width: viewport.height, height: viewport.width });
          await expect(input).toHaveValue("A".repeat(120));
          await expect(save).toBeInViewport();
          await noOverflow(page);
          await capture(page, `quote-limit-${locale}-1180`);
          await page.setViewportSize(viewport);
        }
        await input.press("Enter");
        await expect(popup).toHaveCount(0);
        await expect(trigger).toContainText("A".repeat(120));
        await expect(trigger).toBeFocused();
        await trigger.click();
        await input.fill("Unsaved change");
        await popup.getByRole("button", { name: t("common.cancel"), exact: true }).click();
        await expect(trigger).toContainText("A".repeat(120));
        await trigger.click();
        await input.fill("Synthetic service");
        await save.click();
        await trigger.click();
        await expect(input).toHaveValue("Synthetic service");
        await input.press("Escape");
        await expect(popup).toHaveCount(0);
        await expect(trigger).toBeFocused();

        const mobileSettings = page.locator('[data-mobile-edit="settings"]');
        const mobile = (await mobileSettings.count()) > 0;
        if (mobile) {
          await expect(mobileSettings).toContainText(t("orders2b2.warranty.months", { months: 6 }));
          await mobileSettings.click();
        } else {
          const expand = page.getByRole("button", {
            name: t("orders2b1.new.settings"),
            exact: true,
          });
          if (await expand.isVisible()) await expand.click();
        }
        const warranty = page.locator('[data-new-order-setting="warranty"]');
        const picker = warranty.getByRole("combobox");
        await expect(picker).toContainText(t("orders2b2.warranty.months", { months: 6 }));
        await picker.click();
        const labels = [
          t("orders2b2.warranty.none"),
          ...[3, 6, 12].map((months) => t("orders2b2.warranty.months", { months })),
          t("orders2b2.warranty.twoYears"),
        ];
        const options = page.getByRole("option");
        await expect(options).toHaveCount(5);
        for (const [index, label] of labels.entries())
          await expect(options.nth(index)).toContainText(label);
        await capture(page, `warranty-options-${locale}-${viewport.width}`);
        await page
          .getByRole("option", { name: t("orders2b2.warranty.twoYears"), exact: true })
          .click();
        await warranty.getByRole("textbox").fill("Synthetic extended warranty");
        await expect(picker).toContainText(t("orders2b2.warranty.twoYears"));
        if (mobile) {
          await page.getByRole("button", { name: t("orders2b1.keypad.done"), exact: true }).click();
          await expect(mobileSettings).toContainText(t("orders2b2.warranty.twoYears"));
        }
        if (locale !== "zh-CN")
          await expect(page.locator("body")).not.toContainText(/个月|两年|无保修/);
        await noOverflow(page);
        await page.evaluate(() => scrollTo(0, 0));
        await capture(page, `new-order-${locale}-${viewport.width}`);
        await page.waitForLoadState("networkidle");
        await page.close();

        const detailPage = await context.newPage();
        detailPage.on("pageerror", (error) => errors.push(error.message));
        await detailPage.route("**/api/repairdesk/order/get", async (route) => {
          const response = await route.fetch();
          const json = await response.json();
          Object.assign(json.data.order, {
            warranty_months: 24,
            warranty_text: "两年",
            customer_name: "Synthetic customer",
            customer_phone: "+12025550100",
          });
          if (json.data.customer)
            Object.assign(json.data.customer, {
              name: "Synthetic customer",
              phone_e164: "+12025550100",
              phone_raw: "+12025550100",
              contact_phones: [],
            });
          json.data.events = [];
          json.data.messages = [];
          await route.fulfill({ response, json });
        });
        await detailPage.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
        await expect(
          detailPage.getByText(t("orders2b2.warranty.twoYears"), { exact: true }).first(),
        ).toBeVisible({ timeout: 15_000 });
        if (locale !== "zh-CN")
          await expect(detailPage.locator("body")).not.toContainText(/个月|两年|无保修/);
        await noOverflow(detailPage);
        await capture(detailPage, `order-detail-${locale}-${viewport.width}`);
        await detailPage.waitForLoadState("networkidle");
        await detailPage.reload({ waitUntil: "domcontentloaded" });
        await expect(
          detailPage.getByText(t("orders2b2.warranty.twoYears"), { exact: true }).first(),
        ).toBeVisible({ timeout: 15_000 });
        await detailPage.waitForLoadState("networkidle");
        expect(errors).toEqual([]);
      });
    }
  });
}
