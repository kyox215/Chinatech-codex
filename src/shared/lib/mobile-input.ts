export const decimalKeyboardProps = {
  type: "text",
  inputMode: "decimal",
  autoComplete: "off",
} as const;

export const phoneKeyboardProps = {
  type: "text",
  inputMode: "tel",
  autoComplete: "tel",
} as const;

export const imeiKeyboardProps = {
  type: "text",
  inputMode: "numeric",
  autoComplete: "off",
} as const;

export function moneyDraftValue(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "";
  return String(numeric);
}

export function parseMoneyDraft(value: string) {
  const normalized = value
    .trim()
    .replace(/[€\s]/g, "")
    .replace(",", ".");

  if (!normalized) return 0;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}
