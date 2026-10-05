export const locales = ["zh-CN", "it", "en"] as const;
export type Locale = typeof locales[number];
export const languageNames: Record<Locale, string> = { "zh-CN": "中文", it: "Italiano", en: "English" };
export const languageStorageKey = "chinatech.language";
export function isLocale(value: unknown): value is Locale { return locales.some(locale => locale === value); }
