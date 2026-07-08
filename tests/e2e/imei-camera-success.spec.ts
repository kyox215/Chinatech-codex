import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fakeCameraImeiValue } from "./support/imei-fake-camera-video";

const enabled = process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1";
const screenshotDir = "screenshots/TASK-20260708-010-imei-capture-hardening";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for IMEI fake-camera checks.");

test("new order IMEI capture decodes a real browser camera stream", async ({ page }) => {
  test.setTimeout(45_000);
  mkdirSync(screenshotDir, { recursive: true });

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const deviceSection = page.locator('[data-new-order-section="device-info"]');
  await expect(deviceSection).toBeVisible();
  await deviceSection.getByRole("button", { name: "摄像头扫码录入 IMEI" }).click();

  const captureDialog = page.getByRole("dialog", { name: "录入 IMEI / 序列号" });

  await expect(deviceSection.getByPlaceholder("请输入 IMEI / 序列号")).toHaveValue(
    fakeCameraImeiValue,
    { timeout: 20_000 },
  );
  await expect(captureDialog).toHaveCount(0);
  await deviceSection.screenshot({
    path: `${screenshotDir}/imei-new-order-fake-camera-decoded-chromium.png`,
  });
});
