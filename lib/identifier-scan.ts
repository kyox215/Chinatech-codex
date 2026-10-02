export type IdentifierKind = "serial" | "imei" | "serial-or-imei";

export type IdentifierScanValue = { value: string; error: null } | { value: null; error: string };

/** Validate decoded text before a person confirms filling an identity field. */
export function identifierScanValue(raw: string, kind: IdentifierKind = "serial"): IdentifierScanValue {
  const value = raw.trim();
  if (!value) return { value: null, error: "未识别到内容，请重新识别或手动输入。" };
  if (value.length > 150 || /[\u0000-\u001f\u007f]/.test(value)) return { value: null, error: "识别内容过长或包含不可用字符，请核对实物后重新输入。" };
  if (/^(?:[a-z][a-z\d+.-]*:|\/|www\.)/i.test(value) || /[@<>\\]/.test(value)) return { value: null, error: "识别内容不是设备标识，不能将网址或其他内容填入此字段。" };
  const imei = value.replace(/[\s-]/g, "");
  if (kind === "imei") return /^\d{15}$/.test(imei) ? { value: imei, error: null } : { value: null, error: "IMEI 应为 15 位数字，请重新识别或手动核对。" };
  if (kind === "serial-or-imei" && /^\d{15}$/.test(imei)) return { value: imei, error: null };
  if (!/^[a-z\d][a-z\d ._-]*$/i.test(value)) return { value: null, error: "请核对 SN 序列号，只接受字母、数字、空格及点、横线、下划线。" };
  return { value, error: null };
}
