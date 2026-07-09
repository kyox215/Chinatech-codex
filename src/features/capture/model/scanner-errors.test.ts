import { describe, expect, it } from "vitest";

import { getBarcodeScannerCameraErrorMessage } from "@/features/capture/model/scanner-errors";

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
});
