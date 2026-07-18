import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  AUTH_PERSISTENCE_COOKIE,
  applyAuthCookiePersistence,
  parseAuthPersistenceMode,
} from "@/features/auth/model/auth-persistence";
import { PASSWORD_RECOVERY_COOKIE } from "@/features/auth/model/password-recovery";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;
  const isRepairDeskApi = pathname.startsWith("/api/repairdesk");
  const isAiUsageMaintenanceCron = pathname === "/api/cron/ai-usage-maintenance";
  const isKioskRoute = pathname === "/kiosk" || pathname.startsWith("/api/kiosk");
  const isLoginPage = pathname === "/login";
  const isForgotPasswordPage = pathname === "/forgot-password";
  const isResetPasswordPage = pathname === "/reset-password";
  const isAuthUtilityRoute = pathname.startsWith("/auth/");
  const isPasswordUpdatePage =
    isResetPasswordPage ||
    (isLoginPage && request.nextUrl.searchParams.get("mode") === "update-password");
  const isOnboardingPage = pathname === "/onboarding";
  const isAuthPage =
    isLoginPage ||
    isForgotPasswordPage ||
    isResetPasswordPage ||
    isOnboardingPage ||
    isAuthUtilityRoute;
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.includes(".");

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  const hasPasswordRecoveryCookie = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";

  if (isRepairDeskE2eAuthBypassEnabled()) {
    return NextResponse.next({ request });
  }

  // This server-to-server route performs its own constant-time CRON_SECRET
  // check. Let it reach the route handler instead of redirecting an unauthenticated
  // Vercel Cron request to the login page.
  if (isAiUsageMaintenanceCron) {
    return NextResponse.next({ request });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        const mode = parseAuthPersistenceMode(request.cookies.get(AUTH_PERSISTENCE_COOKIE)?.value);
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, applyAuthCookiePersistence(name, options, mode));
        });
      },
    },
  });

  const { data, error } = hasAuthCookie
    ? await supabase.auth.getClaims()
    : { data: { claims: null }, error: null };
  const isAuthenticated = Boolean(data?.claims && !error);

  if (isRepairDeskApi && !isAuthenticated) {
    return NextResponse.json(
      { error: "未登录或登录已过期" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  if (isResetPasswordPage && (!isAuthenticated || !hasPasswordRecoveryCookie)) {
    const forgotUrl = request.nextUrl.clone();
    forgotUrl.pathname = "/forgot-password";
    forgotUrl.searchParams.set("auth_error", "session");
    return NextResponse.redirect(forgotUrl);
  }

  if (!isPublicAsset && !isRepairDeskApi && !isAuthPage && !isKioskRoute && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isOnboardingPage && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", "/onboarding");
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && isAuthenticated && !isPasswordUpdatePage) {
    const nextPath = request.nextUrl.searchParams.get("next") || "/";
    const target = request.nextUrl.clone();
    target.pathname = nextPath.startsWith("/") ? nextPath : "/";
    target.search = "";
    return NextResponse.redirect(target);
  }

  if (pathname.startsWith("/auth/confirm") || pathname === "/invite/complete") {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}
