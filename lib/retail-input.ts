/** Strict, optional numeric draft parsing. Invalid text stays visible and cannot become zero. */
export function retailDraftNumber(raw: string, integer = false): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!(integer ? /^\d+$/ : /^\d+(?:[.,]\d+)?$/).test(text)) return Number.NaN;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}
export function retailNumberError(raw: string, min: number, max: number, integer = false): string {
  const value = retailDraftNumber(raw, integer);
  if (value === null) return "";
  return !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)
    ? `请输入 ${min}–${max} 的${integer ? "整数" : "数字"}。` : "";
}
