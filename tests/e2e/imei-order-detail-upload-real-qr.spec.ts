import { mkdirSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { makeImeiQrImageFile, uploadQrImeiValue } from "./support/imei-upload-qr-file";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const screenshotDir = "screenshots/TASK-20260708-010-imei-capture-hardening";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for IMEI detail upload checks.");

test("order detail IMEI upload decodes a real QR label and persists across refresh", async ({
  page,
}) => {
  test.setTimeout(45_000);
  mkdirSync(screenshotDir, { recursive: true });

  await disableBrowserCamera(page);
  await gotoReady(page, "/orders/ord_1");

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  const detail = page.locator('[data-order-detail-root="true"][data-order-detail-surface="page"]');
  await expect(detail).toBeVisible();
  const devicePanel = detail.locator('[data-order-panel="device"]');
  await expect(devicePanel).toBeVisible();

  await clickFirstVisible(
    devicePanel.getByRole("button", { name: "扫码录入 IMEI / 序列号" }),
    "order detail IMEI popover",
  );
  await clickFirstVisible(
    page.getByRole("button", { name: "摄像头扫码录入 IMEI" }),
    "order detail IMEI scanner",
  );

  const scannerDialog = page.getByRole("dialog", { name: "录入 IMEI / 序列号" });
  await expect(scannerDialog).toBeVisible();
  await expect(
    scannerDialog.getByText("当前浏览器不支持摄像头扫码。请使用照片上传或手动输入。"),
  ).toBeVisible();

  await scannerDialog.locator('input[type="file"]').setInputFiles(await makeImeiQrImageFile());
  await expect(scannerDialog.getByText(uploadQrImeiValue)).toBeVisible({ timeout: 20_000 });
  await expect(scannerDialog.getByRole("button", { name: "使用选择的编号" })).toBeVisible();
  await scannerDialog.getByRole("button", { name: "使用选择的编号" }).click();
  await expect(scannerDialog).toHaveCount(0);

  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/repairdesk/order/patch") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存 IMEI" }).click();
  await expect((await patchResponse).ok()).toBe(true);

  await expect(devicePanel.getByText(uploadQrImeiValue)).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(detail).toBeVisible();
  await expect(devicePanel.getByText(uploadQrImeiValue)).toBeVisible();

  await detail.screenshot({
    path: `${screenshotDir}/imei-order-detail-upload-real-qr-refresh-desktop.png`,
  });
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function disableBrowserCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });
}

async function clickFirstVisible(locator: Locator, label: string) {
  await expect
    .poll(() => firstVisibleEnabledIndex(locator), {
      message: `Clickable control for ${label}`,
      timeout: 10_000,
    })
    .toBeGreaterThanOrEqual(0);

  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const visible = await candidate.isVisible().catch(() => false);
    const enabled = await candidate.isEnabled().catch(() => true);
    if (visible && enabled) {
      await candidate.click();
      return;
    }
  }

  throw new Error(`No visible control found for ${label}`);
}

async function firstVisibleEnabledIndex(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const visible = await candidate.isVisible().catch(() => false);
    const enabled = await candidate.isEnabled().catch(() => true);
    if (visible && enabled) return index;
  }
  return -1;
}
