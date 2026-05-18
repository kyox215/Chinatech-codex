export const CURRENCY_CODE = "EUR" as const;

export type CurrencyCode = typeof CURRENCY_CODE;

export function formatMoney(amount: number, options: { minimumFractionDigits?: number } = {}) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: CURRENCY_CODE,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function withCurrency<T extends { price: number }>(
  item: T,
): T & { currency_code: CurrencyCode } {
  return { ...item, currency_code: CURRENCY_CODE };
}
