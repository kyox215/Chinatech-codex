import type { CostCurrencyCode } from "@/lib/repairdesk/types";

export const SUPPORTED_COST_CURRENCIES = ["EUR", "USD", "GBP", "CNY", "CHF"] as const;

export const COST_CURRENCY_LABELS: Record<CostCurrencyCode, string> = {
  EUR: "欧元 EUR",
  USD: "美元 USD",
  GBP: "英镑 GBP",
  CNY: "人民币 CNY",
  CHF: "瑞士法郎 CHF",
};

export const COST_CURRENCY_RATE_MAX_AGE_DAYS = 30;
