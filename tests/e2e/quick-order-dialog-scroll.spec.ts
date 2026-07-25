import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = "screenshots/TASK-20260725-003-quick-order-mobile-scroll";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for quick-order dialog checks.");

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1024, height: 500 },
  { width: 1280, height: 500 },
]) {
  test(`quick-order dialog remains vertically reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

    await page.locator('[data-dashboard-quick-start="new-order"]:visible').click();

    const dialog = page.locator('[data-new-order-dialog="true"]');
    const form = dialog.locator('[data-new-order-form="true"]');
    const settings = dialog.locator('[data-new-order-section="settings"]');
    const submit = dialog.getByRole("button", { name: "创建工单" });
    await expect(form).toBeVisible();
    await expect(submit).toBeVisible();

    const before = await form.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }));
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await form.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => form.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(before.scrollTop);

    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeInViewport();
    await expect(submit).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.screenshot({
      path: `${evidenceDir}/quick-order-dialog-scroll-${viewport.width}x${viewport.height}.png`,
      fullPage: false,
    });
  });
}
