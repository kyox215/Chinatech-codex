import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { makeImeiQrImageFile, uploadQrImeiValue } from "./support/imei-upload-qr-file";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const screenshotDir = "screenshots/TASK-20260708-010-imei-capture-hardening";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for IMEI upload QR checks.");

test("new order IMEI image upload decodes a real QR label without OCR mocks", async ({
  page,
}, testInfo) => {
  test.setTimeout(45_000);
  mkdirSync(screenshotDir, { recursive: true });

  await disableBrowserCamera(page);

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const deviceSection = page.locator('[data-new-order-section="device-info"]');
  await expect(deviceSection).toBeVisible();
  await deviceSection.getByRole("button", { name: "摄像头扫码录入 IMEI" }).click();

  const captureDialog = page.getByRole("dialog", { name: "录入 IMEI / 序列号" });
  await expect(captureDialog).toBeVisible();
  await expect(
    captureDialog.getByText("当前浏览器不支持摄像头扫码。请使用照片上传或手动输入。"),
  ).toBeVisible();

  await captureDialog.locator('input[type="file"]').setInputFiles(await makeImeiQrImageFile());

  await expect(deviceSection.getByPlaceholder("请输入 IMEI / 序列号")).toHaveValue(
    uploadQrImeiValue,
    { timeout: 20_000 },
  );
  await expect(captureDialog).toHaveCount(0);
  await deviceSection.screenshot({
    path: getScreenshotPath(testInfo.project.name),
  });
});

async function disableBrowserCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });
}

function getScreenshotPath(projectName: string) {
  if (projectName === "chromium") {
    return `${screenshotDir}/imei-new-order-upload-real-qr-desktop.png`;
  }
  return `${screenshotDir}/imei-new-order-upload-real-qr-${projectName}.png`;
}
