import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const screenshotDir = "screenshots/TASK-20260709-002-imei-candidate-selection";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for IMEI capture UI checks.");

test("new order IMEI capture handles camera fallback and numeric OCR candidates", async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  mkdirSync(screenshotDir, { recursive: true });

  await installCaptureMocks(page);

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
  await expect(captureDialog.getByPlaceholder("无法识别时可手动输入")).toBeVisible();
  await captureDialog.screenshot({
    path: getScreenshotPath(testInfo.project.name, "camera-fallback"),
  });

  await captureDialog.locator('input[type="file"]').setInputFiles(makeImeiImageFile());

  await expect(captureDialog.getByRole("alert")).toHaveText(
    "已识别 2 个候选，请选择要填入的编号。",
  );
  await expect(captureDialog.getByRole("button", { name: /490154203237518/ })).toBeVisible();
  await expect(captureDialog.getByRole("button", { name: /356938035643809/ })).toBeVisible();
  await captureDialog.screenshot({
    path: getScreenshotPath(testInfo.project.name, "upload-candidates"),
  });

  await captureDialog.getByRole("button", { name: /356938035643809/ }).click();
  await captureDialog.getByRole("button", { name: "使用选择的编号" }).click();

  await expect(captureDialog).toHaveCount(0);
  await expect(deviceSection.getByPlaceholder("请输入 IMEI / 序列号")).toHaveValue(
    "356938035643809",
  );
});

async function installCaptureMocks(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });

    class RepairDeskTextDetectorMock {
      async detect() {
        return [{ rawValue: "490154203237518" }, { rawValue: "356938035643809" }];
      }
    }

    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: RepairDeskTextDetectorMock,
    });
  });
}

function makeImeiImageFile() {
  return {
    name: "imei.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  };
}

function getScreenshotPath(projectName: string, kind: string) {
  if (projectName === "chromium") {
    return `${screenshotDir}/imei-new-order-${kind}-desktop.png`;
  }
  return `${screenshotDir}/imei-new-order-${kind}-${projectName}.png`;
}
