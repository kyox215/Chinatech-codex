import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseMode } from "./config";
import { AUTH_COOKIE_NAME, authCookieOptions, preventAuthCaching } from "./server";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseMode()) return response;
  preventAuthCaching(response);
  try {
    const { url, publishableKey } = getSupabaseConfig();
    const supabase = createServerClient(url, publishableKey, {
      cookieOptions: { name: AUTH_COOKIE_NAME, ...authCookieOptions() },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, headers) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          previousCookies.forEach(cookie => response.cookies.set(cookie));
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, authCookieOptions(options)));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
          preventAuthCaching(response);
        },
      },
    });
    await supabase.auth.getUser();
  } catch { /* Each protected route performs its own authoritative access check. */ }
  return preventAuthCaching(response);
}
