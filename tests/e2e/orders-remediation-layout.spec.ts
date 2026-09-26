import { expect, test, devices } from "@playwright/test";
import { translateMessage as tr } from "../../src/shared/i18n/messages";
import { localeDisplayNames } from "../../src/shared/i18n/locales";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Synthetic local business fixture only.",
);
for (const [width, height, locale] of [
  [390, 844, "zh-CN"],
  [820, 1180, "it-IT"],
  [1180, 820, "en"],
  [1440, 1000, "zh-CN"],
] as const) {
  test.describe(`${width} ${locale}`, () => {
    test.use({
      viewport: { width, height },
      hasTouch: width < 1200,
      ...(width === 390 ? { userAgent: devices["iPhone 13"].userAgent } : {}),
      contextOptions: { reducedMotion: "reduce" },
    });
    test("keeps issue entry visible and touch targets usable, then preserves it through language switch", async ({
      page,
      baseURL,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .context()
        .addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
      await page.goto("/orders/new");
      let issue;
      if (width === 390) {
        const trigger = page.locator('[data-mobile-edit="notes"]');
        await expect(trigger).toContainText(tr(locale, "orders2b2.overview.issue"));
        const issueBox = (await trigger.boundingBox())!;
        const quoteBox = (await page
          .locator('[data-new-order-section="quotation"]')
          .boundingBox())!;
        expect(issueBox.y).toBeLessThan(quoteBox.y);
        await trigger.click();
        issue = page.locator('[data-new-order-mobile-panel="notes"] textarea');
        await issue.fill("SYNTHETIC reported screen fault");
        await page
          .getByRole("dialog")
          .filter({ has: issue })
          .getByRole("button", { name: tr(locale, "orders2b1.keypad.done"), exact: true })
          .click();
      } else {
        issue = page.locator("#new-order-reported-issue");
        await expect(issue).toBeVisible();
        await issue.fill("SYNTHETIC reported screen fault");
      }
      for (const button of await page.locator("[data-fault-category-expand]:visible").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({
        path: info.outputPath(`new-${width}-${locale}.png`),
        fullPage: true,
        style: "nextjs-portal{visibility:hidden}",
      });
      const nextLocale = locale === "en" ? "it-IT" : "en";
      if (width < 1024) {
        // Focused touch intake deliberately hides shell navigation. Resize to expose
        // its existing desktop language control, without leaving or remounting the draft.
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await page.locator("[data-language-switcher-trigger]:visible").click();
      await page
        .getByRole("menuitemradio", { name: localeDisplayNames[nextLocale], exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("lang", nextLocale);
      if (width < 1024) await page.setViewportSize({ width, height });
      if (width === 390)
        await expect(page.locator('[data-mobile-edit="notes"]')).toContainText(
          "SYNTHETIC reported screen fault",
        );
      else await expect(issue).toHaveValue("SYNTHETIC reported screen fault");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
    test("shows a single quote summary and reachable flow actions", async ({
      page,
      baseURL,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .context()
        .addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
      await page.goto("/orders/ord_1");
      const root = page.locator("[data-order-detail-root]");
      await expect(root).toBeVisible();
      await expect(
        root.locator(
          "[data-mobile-payment-summary]:visible,[data-order-workbench-money-summary]:visible",
        ),
      ).toHaveCount(1);
      const dock = root.locator(
        "[data-order-action-dock]:visible,[data-mobile-order-action-dock]:visible",
      );
      await expect(dock).toHaveCount(1);
      const box = (await dock.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      await dock
        .getByRole("button", { name: tr(locale, "orders2b2.overview.flowAction"), exact: true })
        .click();
      await expect(page.locator("[data-status-picker]")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-status-picker]")).toBeHidden();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`detail-${width}-${locale}.png`),
        fullPage: true,
        style: "nextjs-portal{visibility:hidden}",
      });
      expect(errors).toEqual([]);
    });
  });
}
