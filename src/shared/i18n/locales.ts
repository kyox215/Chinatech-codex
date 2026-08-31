export const APP_LOCALES = ["zh-CN", "it-IT", "en"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-CN";
export const LOCALE_COOKIE = "repairdesk_locale";
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;
export const APP_TIME_ZONE = "Europe/Rome";

export const localeDisplayNames: Record<AppLocale, string> = {
  "zh-CN": "中文",
  "it-IT": "Italiano",
  en: "English",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && APP_LOCALES.includes(value as AppLocale);
}

export function resolveAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

export function readLocaleCookie(cookieHeader: string): AppLocale | undefined {
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));

  if (!cookie) return undefined;

  try {
    const value = decodeURIComponent(cookie.slice(LOCALE_COOKIE.length + 1));
    return isAppLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function buildLocaleCookie(locale: AppLocale, secure = false) {
  return [
    `${LOCALE_COOKIE}=${encodeURIComponent(locale)}`,
    "Path=/",
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
