export function getBarcodeScannerCameraErrorMessage(error?: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  const normalized = `${name} ${message}`.toLowerCase();

  if (normalized.includes("notallowed") || normalized.includes("permission")) {
    return "摄像头权限被拒绝，请在浏览器权限里允许摄像头，或使用手动输入。";
  }

  if (normalized.includes("notfound") || normalized.includes("no camera")) {
    return "没有检测到可用摄像头，请使用手动输入或粘贴扫码内容。";
  }

  if (normalized.includes("notsupported") || normalized.includes("not supported")) {
    return "当前浏览器无法启动摄像头扫码，请使用手动输入或粘贴。";
  }

  return "无法打开摄像头，请检查权限后使用手动输入或粘贴。";
}
