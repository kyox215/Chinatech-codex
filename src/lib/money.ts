export const CURRENCY_CODE = "EUR" as const;

export type CurrencyCode = typeof CURRENCY_CODE;

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
