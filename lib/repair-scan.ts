export type ScannableRepair = { id: string; device: { serial: string } };

/** Wire input stays raw: uppercasing may expand Unicode and is done once. */
export function repairScanCode(raw: string, origin: string): string | null {
  let code = raw.trim();
  if (!code || code.length > 512) return null;
  if (/^(https?:\/\/|\/)/i.test(code)) {
    try {
      const url = new URL(code, origin);
      if (url.origin !== origin || url.search || url.hash) return null;
      const match = /^\/app\/repairs\/([^/]+)\/?$/.exec(url.pathname);
      if (!match) return null;
      code = decodeURIComponent(match[1]);
    } catch { return null; }
  }
  return code.toUpperCase();
}
export function repairScanMatches<T extends ScannableRepair>(raw: string, orders: readonly T[], origin: string): T[] {
  const normalized=repairScanCode(raw,origin);
  if(normalized===null)return [];
  return orders.filter((order) => order.id.toUpperCase() === normalized || (order.device.serial.trim() && order.device.serial.trim().toUpperCase() === normalized));
}

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "未获相机权限，请在浏览器设置中允许相机，或使用相册、手动输入。";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "未找到可用镜头，请使用相册或手动输入。";
  if (name === "NotReadableError" || name === "AbortError") return "相机暂时不可用，请关闭其他占用相机的应用后重试。";
  return "无法开启相机，请重试或使用相册、手动输入。";
}
