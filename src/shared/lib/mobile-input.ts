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
  const normalized = value.trim().replace(/[€\s]/g, "").replace(",", ".");

  if (!normalized) return 0;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

export type MoneyKeypadKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "00"
  | "."
  | "backspace"
  | "clear";

export function normalizeMoneyKeypadDraft(value: string) {
  const normalized = value
    .trim()
    .replace(/[€\s]/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const firstDotIndex = normalized.indexOf(".");
  const hasDecimal = firstDotIndex >= 0;
  const integerRaw = hasDecimal ? normalized.slice(0, firstDotIndex) : normalized;
  const decimalRaw = hasDecimal
    ? normalized
        .slice(firstDotIndex + 1)
        .replace(/\./g, "")
        .slice(0, 2)
    : "";
  const integer = integerRaw.replace(/^0+(?=\d)/, "") || (hasDecimal ? "0" : "");

  if (hasDecimal) return `${integer || "0"}.${decimalRaw}`;
  return integer;
}

export function applyMoneyKeypadKey(value: string, key: MoneyKeypadKey) {
  const draft = normalizeMoneyKeypadDraft(value);

  if (key === "clear") return "";
  if (key === "backspace") return normalizeMoneyKeypadDraft(draft.slice(0, -1));
  if (key === ".") return draft.includes(".") ? draft : `${draft || "0"}.`;

  const digits = key;
  if (draft.includes(".")) {
    const [integer = "0", decimal = ""] = draft.split(".");
    if (decimal.length >= 2) return draft;
    const nextDecimal = `${decimal}${digits}`.slice(0, 2);
    return `${integer || "0"}.${nextDecimal}`;
  }

  if (!draft) return digits === "00" ? "0" : normalizeMoneyKeypadDraft(digits);
  if (draft === "0") return digits === "00" || digits === "0" ? "0" : digits;
  return normalizeMoneyKeypadDraft(`${draft}${digits}`);
}
