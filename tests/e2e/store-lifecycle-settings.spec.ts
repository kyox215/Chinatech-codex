import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for store lifecycle checks.");

test("renders the UUID-bound rename and reversible-close controls on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?section=store", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "店铺工作区" })).toBeVisible({ timeout: 15_000 });
  const actions = page.locator("[data-store-lifecycle-actions]");
  await expect(actions).toBeVisible({ timeout: 15_000 });
  await expect(actions.getByText("完整工作区重命名")).toBeVisible();
  await expect(actions.getByText("可恢复关闭", { exact: true })).toBeVisible();
  await expect(actions.getByText(/当前阶段：正常营业/)).toBeVisible();
  await expect(actions.getByRole("button", { name: "确认进入关闭流程" })).toBeDisabled();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "screenshots/store-lifecycle-actions-mobile.png",
    fullPage: true,
  });
});
