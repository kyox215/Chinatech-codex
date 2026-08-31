import { APP_TIME_ZONE, type AppLocale } from "@/shared/i18n/locales";

const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function getNumberFormatter(locale: AppLocale, options: Intl.NumberFormatOptions) {
  const key = `${locale}:${JSON.stringify(options)}`;
  const existing = numberFormatters.get(key);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat(locale, options);
  numberFormatters.set(key, formatter);
  return formatter;
}

function getDateFormatter(locale: AppLocale, options: Intl.DateTimeFormatOptions) {
  const resolvedOptions = { timeZone: APP_TIME_ZONE, ...options };
  const key = `${locale}:${JSON.stringify(resolvedOptions)}`;
  const existing = dateFormatters.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat(locale, resolvedOptions);
  dateFormatters.set(key, formatter);
  return formatter;
}

export function formatNumber(value: number, locale: AppLocale, options = {}) {
  return getNumberFormatter(locale, options).format(value);
}

export function formatCurrency(value: number, locale: AppLocale) {
  const normalizedValue = Number.isFinite(value) ? value : 0;
  const isNegative = normalizedValue < 0;
  const parts = getNumberFormatter(locale, {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "narrowSymbol",
  }).formatToParts(Math.abs(normalizedValue));
  const currency = parts.find((part) => part.type === "currency")?.value ?? "€";
  const amount = parts
    .filter((part) => part.type !== "currency" && part.type !== "literal")
    .map((part) => part.value)
    .join("");
  return `${isNegative ? "-" : ""}${currency}${amount}`;
}

export function formatDate(
  value: Date | string | number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return getDateFormatter(locale, options).format(new Date(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) {
  return getDateFormatter(locale, options).format(new Date(value));
}

export function formatRelativeTime(
  value: Date | string | number,
  locale: AppLocale,
  now: Date | string | number,
) {
  const deltaSeconds = (new Date(value).getTime() - new Date(now).getTime()) / 1_000;
  const absoluteSeconds = Math.abs(deltaSeconds);
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absoluteSeconds < 60
      ? [deltaSeconds, "second"]
      : absoluteSeconds < 3_600
        ? [deltaSeconds / 60, "minute"]
        : absoluteSeconds < 86_400
          ? [deltaSeconds / 3_600, "hour"]
          : [deltaSeconds / 86_400, "day"];

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.round(amount), unit);
}
