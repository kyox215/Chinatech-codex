export const CURRENCY_CODE = "EUR" as const;

export type CurrencyCode = typeof CURRENCY_CODE;

const CENT_SCALE = 100;
const CENT_PRECISION_TOLERANCE = 1e-8;

export function normalizePositiveCentAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const scaled = value * CENT_SCALE;
  const cents = Math.round(scaled);
  if (!Number.isSafeInteger(cents)) return undefined;
  if (Math.abs(scaled - cents) > CENT_PRECISION_TOLERANCE) return undefined;
  return cents / CENT_SCALE;
}

export function formatMoney(amount: number, options: { minimumFractionDigits?: number } = {}) {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  return `${value < 0 ? "-" : ""}€${formatted}`;
}

export function withCurrency<T extends { price: number }>(
  item: T,
): T & { currency_code: CurrencyCode } {
  return { ...item, currency_code: CURRENCY_CODE };
}
