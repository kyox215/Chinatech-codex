import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;
  const isRepairDeskApi = pathname.startsWith("/api/repairdesk");
  const isLoginPage = pathname === "/login";
  const isOnboardingPage = pathname === "/onboarding";
  const isAuthPage = isLoginPage || isOnboardingPage;
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.includes(".");

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data, error } = hasAuthCookie
    ? await supabase.auth.getClaims()
    : { data: { claims: null }, error: null };
  const isAuthenticated = Boolean(data?.claims && !error);

  if (isRepairDeskApi && !isAuthenticated) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  if (!isPublicAsset && !isRepairDeskApi && !isAuthPage && !isAuthenticated) {
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

  if (isLoginPage && isAuthenticated) {
    const nextPath = request.nextUrl.searchParams.get("next") || "/";
    const target = request.nextUrl.clone();
    target.pathname = nextPath.startsWith("/") ? nextPath : "/";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
