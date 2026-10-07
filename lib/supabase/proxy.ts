import { withDatabase } from "@/lib/backend/database";
import { IDLE_SECONDS, setLoginPolicy } from "@/lib/server/login-policy";
import { matchingLoginPolicy, sessionCookieOptions } from "@/lib/server/login-policy";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseMode } from "./config";
import { AUTH_COOKIE_NAME, authCookieOptions, preventAuthCaching } from "./server";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseMode()) return response;
  preventAuthCaching(response);
  // A keepalive activity write must never restore a previous account via late cookies.
  if (request.nextUrl.pathname === "/api/auth/activity") return response;
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
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, authCookieOptions(sessionCookieOptions(name, options, matchingLoginPolicy(request.cookies.getAll())))));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
          preventAuthCaching(response);
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email_confirmed_at && (!matchingLoginPolicy(request.cookies.getAll()) || response.cookies.getAll().some(cookie => cookie.name === AUTH_COOKIE_NAME || /^ct_rebuild_auth\.\d+$/.test(cookie.name)))) {
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      if (claims?.sub === user.id && typeof claims.session_id === "string") {
        const identity = { userId: user.id, sessionId: claims.session_id };
        const policy = await withDatabase(identity, null, async tx => {
          const [row] = await tx`select remember,last_active_at from chinatech_v2_private.login_sessions where session_id=${identity.sessionId}`;
          return { sessionId: identity.sessionId, remember: row.remember as boolean, expires: Math.floor(new Date(row.last_active_at).getTime()/1000)+IDLE_SECONDS };
        });
        setLoginPolicy(request, response, policy);
      }
    }
  } catch { /* Each protected route performs its own authoritative access check. */ }
  return preventAuthCaching(response);
}
