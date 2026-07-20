import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for store lifecycle checks.");

test("renders the beginner-safe store close entry on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?section=store", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "店铺工作区" })).toBeVisible({ timeout: 15_000 });
  const actions = page.locator("[data-store-lifecycle-actions]");
  await expect(actions).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "店铺状态与关闭" })).toBeVisible();
  await expect(actions.getByText("完整工作区重命名")).toHaveCount(0);
  await expect(actions.getByText(/revision|UUID/i)).toHaveCount(0);
  await expect(actions.getByLabel("店铺识别码最后 8 位")).toHaveCount(0);
  const checkButton = actions.getByRole("button", { name: "检查是否可以关闭" });
  if (await checkButton.isVisible().catch(() => false)) {
    await expect(checkButton).toBeEnabled();
  } else {
    await expect(actions).toContainText(/准备中|主账号|保护/);
  }

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "screenshots/store-lifecycle-beginner-entry-mobile.png",
    fullPage: true,
  });
});
