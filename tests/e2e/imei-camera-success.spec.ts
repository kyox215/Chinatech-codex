import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fakeCameraImeiValue } from "./support/imei-fake-camera-video";

const enabled = process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1";
const screenshotDir = "screenshots/TASK-20260709-003-imei-overlay-selection";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for IMEI fake-camera checks.");

test("new order IMEI capture decodes a real browser camera stream", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  mkdirSync(screenshotDir, { recursive: true });

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const deviceSection = page.locator('[data-new-order-section="device-info"]');
  await expect(deviceSection).toBeVisible();
  await deviceSection.getByRole("button", { name: "摄像头扫码录入 IMEI" }).click();

  const captureDialog = page.getByRole("dialog", { name: "录入 IMEI / 序列号" });

  await expect(captureDialog.getByRole("alert")).toHaveText("已识别 1 个编号，请确认后再填入。", {
    timeout: 20_000,
  });
  await expect(
    captureDialog.getByRole("button", { name: new RegExp(fakeCameraImeiValue) }),
  ).toBeVisible();
  await captureDialog.screenshot({
    path: `${screenshotDir}/imei-new-order-fake-camera-candidates-${testInfo.project.name}.png`,
  });
  await captureDialog.getByRole("button", { name: "使用选择的编号" }).click();

  await expect(deviceSection.getByPlaceholder("请输入 IMEI / 序列号")).toHaveValue(
    fakeCameraImeiValue,
  );
  await expect(captureDialog).toHaveCount(0);
  await deviceSection.screenshot({
    path: `${screenshotDir}/imei-new-order-fake-camera-decoded-${testInfo.project.name}.png`,
  });
});
