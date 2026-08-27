import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const purgeDemoEnabled = process.env.REPAIRDESK_E2E_STORE_PURGE_DEMO === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for store lifecycle checks.");

test("renders the beginner-safe store close entry on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?section=store", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "店铺工作区" })).toBeVisible({ timeout: 15_000 });
  const deleteEntry = page.locator("[data-store-delete-entry]");
  await expect(deleteEntry).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-store-lifecycle-actions]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "店铺状态与关闭" })).toBeVisible();
  await expect(deleteEntry.getByText("完整工作区重命名")).toHaveCount(0);
  await expect(deleteEntry.getByText(/revision|UUID/i)).toHaveCount(0);
  await expect(deleteEntry.getByLabel("店铺识别码最后 8 位")).toHaveCount(0);
  const checkButton = deleteEntry.getByRole("button", { name: "开始安全检查" });
  if (await checkButton.isVisible().catch(() => false)) {
    await expect(checkButton).toBeEnabled();
  } else {
    await expect(deleteEntry).toContainText(/准备中|主账号|保护/);
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

test("requires the displayed request phrase in the archived-store mobile sheet", async ({
  page,
}) => {
  test.skip(!purgeDemoEnabled, "Set REPAIRDESK_E2E_STORE_PURGE_DEMO=1 for purge demo checks.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/closed-stores", { waitUntil: "domcontentloaded" });

  const card = page.getByRole("region", { name: "Demo Archived Store" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "申请永久删除" }).click();

  const phrase = "申请永久删除 00000099";
  await expect(page.getByText(phrase, { exact: true })).toBeVisible();
  const input = page.getByLabel("请逐字输入以下提示词");
  const submit = page.getByRole("button", { name: "建立删除申请" });
  await expect(submit).toBeDisabled();
  await input.fill(`${phrase} `);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("提示词不匹配");
  await input.fill(phrase);
  await expect(submit).toBeDisabled();
  await card.getByRole("checkbox").check();
  await expect(submit).toBeEnabled();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "screenshots/TASK-20260827-005-store-purge-mobile.png",
    fullPage: true,
  });
});

test("uses the desktop dialog for the archived-store confirmation", async ({ page }) => {
  test.skip(!purgeDemoEnabled, "Set REPAIRDESK_E2E_STORE_PURGE_DEMO=1 for purge demo checks.");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings/closed-stores", { waitUntil: "domcontentloaded" });

  const card = page.getByRole("region", { name: "Demo Archived Store" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "申请永久删除" }).click();
  await expect(page.getByRole("dialog", { name: "申请永久删除店铺" })).toBeVisible();
  await expect(page.getByText("申请永久删除 00000099", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "申请永久删除店铺" }).getByRole("button", {
      name: "建立删除申请",
    }),
  ).toBeDisabled();
  await page.screenshot({
    path: "screenshots/TASK-20260827-005-store-purge-desktop.png",
    fullPage: true,
  });
});
