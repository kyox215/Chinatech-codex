import { LOGIN_INTENT_COOKIE, signLoginValue } from "./login-policy";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { AccountProvider } from "@/lib/account";
import { getSupabaseConfig, isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, AuthRequestError, authCookieOptions, createSupabaseRouteClient, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { clearRecoveryProof, copyAuthCookies } from "@/lib/server/auth-flows";
import { accountAvailability } from "@/lib/server/account-auth";

export function checkedProviderUrl(value: string, provider: AccountProvider, linking = false): string {
  const target = new URL(value);
  if (target.username || target.password || target.hash) throw new Error("Invalid authorization URL.");
  if (linking) {
    const paths = provider === "google" ? ["/o/oauth2/v2/auth", "/o/oauth2/auth"] : ["/auth/authorize"];
    const hostname = provider === "google" ? "accounts.google.com" : "appleid.apple.com";
    if (target.protocol !== "https:" || target.hostname !== hostname || target.port || !paths.includes(target.pathname)) throw new Error("Invalid identity provider URL.");
  } else {
    const config = getSupabaseConfig();
    if (target.origin !== new URL(config.url).origin || target.pathname !== "/auth/v1/authorize" || target.searchParams.get("provider") !== provider) throw new Error("Invalid authorization URL.");
  }
  return target.toString();
}

export async function startAccountOAuth(request: NextRequest, provider: AccountProvider) {
  const label = provider === "google" ? "Google" : "Apple";
  if (!isSupabaseMode()) return authFailure(null, `${label} 登录未开放。`, 404);
  try {
    const origin = requireSameOrigin(request); const body = await readAuthBody(request, ["remember"]);
    if (body.remember !== undefined && typeof body.remember !== "boolean") throw new AuthRequestError("请求格式无效。");
    if (!(await accountAvailability())[provider]) throw new AuthRequestError(`${label} 登录尚未配置，请使用邮箱登录。`, 503);
    const response = preventAuthCaching(NextResponse.json({ ok: true })); clearRecoveryProof(response);
    const nonce = randomUUID();
    response.cookies.set(LOGIN_INTENT_COOKIE, signLoginValue({ purpose: "oauth-login", nonce, remember: body.remember === true, expires: Math.floor(Date.now()/1000)+600 }), authCookieOptions({ maxAge: 600 }));
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/auth/callback?intent=${nonce}`, skipBrowserRedirect: true } });
    if (error || !data.url) throw new AuthRequestError(`${label} 登录暂不可用，请稍后重试。`, 503);
    return copyAuthCookies(response, NextResponse.json({ ok: true, redirectTo: checkedProviderUrl(data.url, provider) }));
  } catch (reason) { return authFailure(reason, `${label} 登录暂不可用，请稍后重试。`); }
}
