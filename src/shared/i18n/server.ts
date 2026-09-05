import "server-only";

import { cookies, headers } from "next/headers";

import { isAppLocale, LOCALE_COOKIE, resolvePreferredLocale } from "@/shared/i18n/locales";

export async function getServerLocale() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isAppLocale(savedLocale)) return savedLocale;

  const requestHeaders = await headers();
  return resolvePreferredLocale(requestHeaders.get("accept-language"));
}
