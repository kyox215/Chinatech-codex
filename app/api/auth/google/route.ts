import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, AuthRequestError, createSupabaseRouteClient, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { clearRecoveryProof, copyAuthCookies } from "@/lib/server/auth-flows";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "Google 登录未开放。", 404);
  try {
    const origin = requireSameOrigin(request);
    await readAuthBody(request, []);
    const config = getSupabaseConfig();
    const settings = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.publishableKey }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!settings.ok) throw new AuthRequestError("Google 登录暂不可用，请稍后重试。", 503);
    const enabled = await settings.json();
    if (enabled.external?.google !== true) throw new AuthRequestError("Google 登录尚未配置，请使用邮箱登录。", 503);
    const response = preventAuthCaching(NextResponse.json({ ok: true }));
    clearRecoveryProof(response);
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true } });
    if (error || !data.url) throw new AuthRequestError("Google 登录暂不可用，请稍后重试。", 503);
    const target = new URL(data.url);
    if (target.origin !== new URL(config.url).origin || target.pathname !== "/auth/v1/authorize" || target.searchParams.get("provider") !== "google") throw new Error("Invalid authorization URL.");
    return copyAuthCookies(response, NextResponse.json({ ok: true, redirectTo: target.toString() }));
  } catch (reason) { return authFailure(reason, "Google 登录暂不可用，请稍后重试。"); }
}
