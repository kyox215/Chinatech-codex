import { expect, test } from "@playwright/test";
import { translateMessage } from "@/shared/i18n/messages";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1" ||
    process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED === "1",
  "Requires a synthetic preview with quote writes paused.",
);

for (const [locale, width] of [
  ["zh-CN", 390],
  ["it-IT", 820],
  ["en", 1440],
] as const) {
  test(`${locale} ${width}: paused writes keep history readable and block create deep links`, async ({
    page,
    context,
    baseURL,
  }) => {
    expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
    await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/buyback?new=1");
    await expect(
      page.getByText(translateMessage(locale, "buyback2b5.writePaused"), { exact: true }),
    ).toBeVisible();
    const create = page
      .getByRole("button", { name: translateMessage(locale, "buyback2b5.new"), exact: true })
      .filter({ visible: true });
    await expect(create).toBeDisabled();
    await expect(page.locator('[data-buyback-quote-workspace="true"]')).toHaveCount(0);
    await expect(
      page
        .getByRole("heading", { name: translateMessage(locale, "buyback.title"), exact: true })
        .first(),
    ).toBeVisible();
  });
}
