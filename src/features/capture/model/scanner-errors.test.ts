import { describe, expect, it } from "vitest";

import {
  getBarcodeScannerCameraErrorKind,
  getBarcodeScannerCameraErrorMessage,
  getImageDecodeErrorMessage,
  getCameraCaptureErrorMessageKey,
  createCameraStartFailedError,
  createImageReadFailedError,
  createImageDecodeTimeoutError,
} from "@/features/capture/model/scanner-errors";

describe("getBarcodeScannerCameraErrorMessage", () => {
  it("maps unsupported browser errors to a local actionable message", () => {
    const error = new Error("Not supported");
    error.name = "NotSupportedError";

    expect(getBarcodeScannerCameraErrorMessage(error)).toBe(
      "当前浏览器无法启动摄像头扫码，请使用手动输入或粘贴。",
    );
  });

  it("maps permission errors without leaking raw browser wording", () => {
    const error = new Error("Permission denied by system");
    error.name = "NotAllowedError";

    expect(getBarcodeScannerCameraErrorMessage(error)).toBe(
      "摄像头权限被拒绝，请在浏览器权限里允许摄像头，或使用手动输入。",
    );
  });

  it("falls back to a generic recovery message", () => {
    expect(getBarcodeScannerCameraErrorMessage(new Error("Unexpected camera failure"))).toBe(
      "无法打开摄像头，请检查权限后使用手动输入或粘贴。",
    );
  });

  it("classifies browser errors by stable names without exposing raw messages", () => {
    const error = new Error("SECRET_PROVIDER_TOKEN");
    error.name = "NotReadableError";

    expect(getBarcodeScannerCameraErrorKind(error)).toBe("unavailable");
    expect(getBarcodeScannerCameraErrorMessage(error, "it-IT")).not.toContain(
      "SECRET_PROVIDER_TOKEN",
    );
  });

  it("uses a stable timeout sentinel for image recognition copy", () => {
    expect(getImageDecodeErrorMessage(createImageDecodeTimeoutError(), "en")).toContain(
      "timed out",
    );
    expect(getImageDecodeErrorMessage(new Error("raw browser details"), "en")).not.toContain(
      "raw browser details",
    );
  });

  it("keeps camera capture errors in the camera-safe message catalog", () => {
    expect(getCameraCaptureErrorMessageKey("permission-denied")).toBe("camera.error.permission");
    expect(getCameraCaptureErrorMessageKey("not-found")).toBe("camera.error.notFound");
    expect(getCameraCaptureErrorMessageKey("unsupported")).toBe("camera.error.unsupported");
    expect(getCameraCaptureErrorMessageKey("unavailable")).toBe("camera.error.unavailable");
    expect(getCameraCaptureErrorMessageKey("unknown")).toBe("camera.error.generic");
  });

  it("uses stable non-user-facing sentinels for scanner internals", () => {
    expect(createCameraStartFailedError().message).toBe("camera-start-failed");
    expect(createImageReadFailedError().message).toBe("image-read-failed");
  });
});
