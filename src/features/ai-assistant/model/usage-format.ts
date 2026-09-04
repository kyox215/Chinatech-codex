import type { AppLocale } from "@/shared/i18n/locales";

export function formatAiUsageInteger(value: number, locale: AppLocale = "zh-CN") {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatAiUsageMicroUsd(value: number) {
  if (value === 0) return "$0.00";
  const usd = value / 1_000_000;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: usd < 0.01 ? 6 : 2,
    maximumFractionDigits: usd < 0.01 ? 6 : 4,
  })}`;
}
