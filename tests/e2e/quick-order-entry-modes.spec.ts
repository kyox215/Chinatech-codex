import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_QUICK_ORDER_MODES === "1";
const evidenceDir = "screenshots/TASK-20260728-007-quick-order-mode-implementation";

test.skip(!enabled, "Set REPAIRDESK_E2E_QUICK_ORDER_MODES=1 for entry-mode verification.");

test("switches from unchanged professional intake to the four-step guided flow", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings?section=rules", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "默认规则" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /专业模式/ })).toBeChecked();
  await page.screenshot({
    path: `${evidenceDir}/settings-entry-mode-desktop-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-dashboard-quick-start="new-order"]:visible').click();
  const professionalDialog = page.locator('[data-new-order-dialog="true"]');
  await expect(professionalDialog.locator('[data-new-order-workspace-grid="true"]')).toBeVisible();
  await expect(professionalDialog.getByRole("button", { name: "创建工单" })).toBeVisible();
  await page.screenshot({
    path: `${evidenceDir}/professional-mode-desktop-${testInfo.project.name}.png`,
    fullPage: false,
  });

  await page.goto("/settings?section=rules", { waitUntil: "domcontentloaded" });
  await page.getByRole("radio", { name: /简易模式/ }).click();
  const saveBar = page.locator("[data-settings-save-bar]");
  await expect(saveBar).toBeVisible();
  await saveBar.getByRole("button", { name: "保存设置" }).click();
  await expect(saveBar).toHaveAttribute("data-save-status", "saved");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-dashboard-quick-start="new-order"]:visible').click();
  const guidedDialog = page.locator('[data-new-order-dialog="true"]');
  await expect(guidedDialog.locator('[data-new-order-guided-workspace="true"]')).toBeVisible();
  await expect(guidedDialog.getByRole("heading", { name: "客户资料" })).toBeVisible();
  await expect(guidedDialog.getByRole("button", { name: /确认并创建工单/ })).not.toBeVisible();
  await page.screenshot({
    path: `${evidenceDir}/simple-mode-step-1-mobile-${testInfo.project.name}.png`,
    fullPage: false,
  });

  await guidedDialog.getByRole("combobox", { name: "客户电话号码" }).click();
  await page.keyboard.type("393339876541");
  await page.keyboard.press("Enter");
  await guidedDialog.getByRole("combobox", { name: "客户姓名" }).fill("Mario Rossi");
  await guidedDialog.getByRole("button", { name: /按当前资料新建客户/ }).click();
  await guidedDialog.getByRole("button", { name: /下一步/ }).click();
  await expect(guidedDialog.getByRole("heading", { name: "设备与交接" })).toBeVisible();

  await guidedDialog.getByPlaceholder("选择品牌").fill("Apple");
  await guidedDialog.getByPlaceholder("例如 iPhone 13").fill("iPhone 15");
  await guidedDialog.getByRole("button", { name: /门店保管/ }).click();
  await guidedDialog.getByRole("button", { name: /下一步/ }).click();
  await expect(guidedDialog.getByRole("heading", { name: "维修与报价" })).toBeVisible();

  await guidedDialog.getByRole("button", { name: "检测后补充" }).click();
  await guidedDialog.getByRole("button", { name: /下一步/ }).click();
  await expect(guidedDialog.getByRole("heading", { name: "确认创建" })).toBeVisible();
  await expect(guidedDialog.getByRole("button", { name: /确认并创建工单/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
