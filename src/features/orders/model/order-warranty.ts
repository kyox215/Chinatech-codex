export const DEFAULT_ORDER_WARRANTY_MONTHS = 6;

export const ORDER_WARRANTY_OPTIONS = [
  { months: 0, label: "无保修" },
  { months: 3, label: "3个月" },
  { months: 6, label: "6个月" },
  { months: 12, label: "12个月" },
  { months: 24, label: "两年" },
] as const;

export type OrderWarrantyMonths = (typeof ORDER_WARRANTY_OPTIONS)[number]["months"];

const validWarrantyMonths = new Set<number>(ORDER_WARRANTY_OPTIONS.map((option) => option.months));

export function isOrderWarrantyMonths(value: number): value is OrderWarrantyMonths {
  return validWarrantyMonths.has(value);
}

export function formatWarrantyText(months: number) {
  if (months === 0) return "无保修";
  if (months === 24) return "两年";
  return `${months}个月`;
}

export function parseWarrantyMonths(
  warrantyText?: string | null,
  fallback = DEFAULT_ORDER_WARRANTY_MONTHS,
) {
  const text = warrantyText?.trim();
  if (!text) return normalizeWarrantyMonths(fallback);
  if (/无|none|nessuna|no\s*warranty/i.test(text)) return 0;
  if (/两年|2年|24/.test(text)) return 24;
  if (/12|一年|1年/i.test(text)) return 12;
  if (/6|半年/i.test(text)) return 6;
  if (/3|90/i.test(text)) return 3;
  return normalizeWarrantyMonths(fallback);
}

export function normalizeWarrantyMonths(
  value: number | string | null | undefined,
  fallback = DEFAULT_ORDER_WARRANTY_MONTHS,
): OrderWarrantyMonths {
  const numeric = typeof value === "string" ? Number(value) : Number(value ?? fallback);
  const rounded = Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
  return isOrderWarrantyMonths(rounded) ? rounded : normalizeWarrantyMonths(fallback, 6);
}

export function warrantyReasonRequired(
  months: number,
  defaultMonths = DEFAULT_ORDER_WARRANTY_MONTHS,
) {
  return normalizeWarrantyMonths(months) !== normalizeWarrantyMonths(defaultMonths);
}

export function normalizeWarrantyPayload(input: {
  warranty_months?: number | string | null;
  warranty_text?: string | null;
  warranty_change_reason?: string | null;
  defaultWarrantyMonths?: number;
}) {
  const defaultMonths = normalizeWarrantyMonths(input.defaultWarrantyMonths);
  const months =
    input.warranty_months === undefined || input.warranty_months === null
      ? parseWarrantyMonths(input.warranty_text, defaultMonths)
      : normalizeWarrantyMonths(input.warranty_months, defaultMonths);
  const reason = input.warranty_change_reason?.trim() || undefined;
  if (warrantyReasonRequired(months, defaultMonths) && !reason) {
    throw new Error("非默认质保需要填写原因。");
  }
  return {
    warranty_months: months,
    warranty_text: formatWarrantyText(months),
    warranty_change_reason: reason,
    default_warranty_months: defaultMonths,
  };
}
