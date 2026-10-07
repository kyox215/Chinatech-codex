import { establishLogin } from "@/lib/server/login-sessions";
import { LOGIN_INTENT_COOKIE, readLoginValue } from "@/lib/server/login-policy";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseRouteClient, preventAuthCaching, trustedAuthOrigin } from "@/lib/supabase/server";
import { clearRecoveryProof, copyAuthCookies, setRecoveryProof } from "@/lib/server/auth-flows";

export async function GET(request: NextRequest) {
  const origin = trustedAuthOrigin(request);
  const notice = request.nextUrl.pathname === "/auth/callback" ? "oauth-failed" : "confirmation-failed";
  const failure = (source?: NextResponse) => {
    const response = preventAuthCaching(NextResponse.redirect(new URL(`/login?notice=${notice}`, origin)));
    if (source) copyAuthCookies(source, response);
    response.cookies.set(LOGIN_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    clearRecoveryProof(response);
    return response;
  };
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const code=request.nextUrl.searchParams.get("code");
  const pkce=Boolean(code && /^[a-z\d._~-]{8,1024}$/i.test(code));
  const type = request.nextUrl.searchParams.get("type");
  const hashed=Boolean((type === "signup" || type === "recovery") && tokenHash && /^[a-f\d]{32,256}$/i.test(tokenHash));
  if (!isSupabaseMode() || request.nextUrl.searchParams.has("error") || (!pkce && !hashed)) return failure();
  const response = preventAuthCaching(NextResponse.redirect(new URL("/account/pending", origin)));
  try {
    const oauthCallback = request.nextUrl.pathname === "/auth/callback";
    const intent = readLoginValue(request.cookies.get(LOGIN_INTENT_COOKIE)?.value);
    const validIntent = intent?.purpose === "oauth-login" && typeof intent.nonce === "string" && intent.nonce === request.nextUrl.searchParams.get("intent") && typeof intent.remember === "boolean" && typeof intent.expires === "number" && intent.expires > Date.now()/1000 && intent.expires <= Date.now()/1000+600 ? intent : null;
    if (oauthCallback && (!pkce || !validIntent)) return failure(response);
    const supabase = createSupabaseRouteClient(request, response);
    let recovery = false;
    if (pkce) {
      const flowId = request.nextUrl.searchParams.get("sb_flow_id");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code!, flowId !== null ? { flowId } : undefined);
      if (error) return failure(response);
      // The SDK exposes redirectType at runtime but omits it from AuthTokenResponse.
      recovery = "redirectType" in data && data.redirectType === "recovery";
    } else {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "signup" | "recovery" });
      if (error) return failure(response);
      recovery = type === "recovery";
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user?.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      return failure(response);
    }
    await establishLogin(request, response, supabase, oauthCallback && pkce && !recovery && validIntent?.remember === true);
    response.cookies.set(LOGIN_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    clearRecoveryProof(response);
    if (recovery) {
      const { data: claims, error } = await supabase.auth.getClaims();
      if (error || claims?.claims.sub !== data.user.id || typeof claims.claims.session_id !== "string") {
        await supabase.auth.signOut({ scope: "local" });
        return failure(response);
      }
      setRecoveryProof(response, data.user.id, claims.claims.session_id);
      response.headers.set("Location", new URL("/reset-password", origin).toString());
    }
    return response;
  } catch { return failure(response); }
}
