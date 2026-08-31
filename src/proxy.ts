import { type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/shared/i18n/locales";
import { updateSession } from "@/utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/r" || request.nextUrl.pathname === "/kiosk") {
    request.cookies.set(LOCALE_COOKIE, "it-IT");
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
