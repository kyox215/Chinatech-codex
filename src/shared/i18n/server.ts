import "server-only";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, resolveAppLocale } from "@/shared/i18n/locales";

export async function getServerLocale() {
  const cookieStore = await cookies();
  return resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
