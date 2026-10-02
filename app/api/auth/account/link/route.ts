import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { accountActionError, accountAvailability, issueAccountIntent, requireAccountSession } from "@/lib/server/account-auth";
import { checkedProviderUrl } from "@/lib/server/account-oauth";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "账号绑定未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({}));
  try {
    const origin = requireSameOrigin(request); const body = await readAuthBody(request, ["provider"]);
    if (body.provider !== "google" && body.provider !== "apple") throw new AuthRequestError("请选择可用的登录方式。");
    const provider = body.provider;
    const { supabase, user, identity } = await requireAccountSession(request, response, true);
    if (!(await accountAvailability())[provider]) throw new AuthRequestError("此登录方式尚未配置。", 503);
    if (user.identities?.some(item => item.provider === provider)) throw new AuthRequestError("此登录方式已经绑定。", 409);
    const intent = issueAccountIntent(response, identity, provider);
    const callback = new URL("/auth/account/callback", origin); callback.searchParams.set("intent", intent.nonce);
    const { data, error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: callback.toString(), skipBrowserRedirect: true } });
    accountActionError(error, "无法绑定此登录方式，请核对后重试。");
    if (!data.url) throw new Error("Missing provider URL.");
    return copyAuthCookies(response, NextResponse.json({ redirectTo: checkedProviderUrl(data.url, provider, true) }));
  } catch (reason) { return authFailure(reason, "账号绑定暂不可用，请稍后重试。"); }
}
