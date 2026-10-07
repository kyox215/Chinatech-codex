import { establishLogin, sessionRemember } from "@/lib/server/login-sessions";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { accountActionError, accountAvailability, requireAccountSession, stagedAccountClient, storedAccountPhone } from "@/lib/server/account-auth";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "手机验证未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({ message: "手机已完成验证。" }));
  try {
    requireSameOrigin(request); const body = await readAuthBody(request, ["phone", "token"]);
    if (typeof body.phone !== "string" || !/^\+[1-9]\d{5,14}$/.test(body.phone) || typeof body.token !== "string" || !/^\d{6,10}$/.test(body.token)) throw new AuthRequestError("请填写有效号码和短信验证码。");
    const { user, identity } = await requireAccountSession(request, response, true);
    if (!(await accountAvailability()).phone) throw new AuthRequestError("短信验证尚未配置。", 503);
    if (storedAccountPhone(user.new_phone) !== body.phone) throw new AuthRequestError("待验证号码已变化，请刷新账号资料后重试。", 409);
    const remember = await sessionRemember(identity);
    const staged = stagedAccountClient(request);
    const { data, error } = await staged.supabase.auth.verifyOtp({ phone: body.phone, token: body.token, type: "phone_change" });
    accountActionError(error, "验证码无效或已过期，请核对后重试。");
    if (data.user?.id !== identity.userId) throw new AuthRequestError("账号状态已变化，请重新登录。", 409);
    if (storedAccountPhone(data.user.phone) !== body.phone || !data.user.phone_confirmed_at) throw new AuthRequestError("手机尚未完成验证，请刷新后核对。", 409);
    await establishLogin(staged.request, staged.response, staged.supabase, remember);
    const verified = await requireAccountSession(staged.request, staged.response);
    if (verified.identity.userId !== identity.userId || storedAccountPhone(verified.user.phone) !== body.phone || !verified.user.phone_confirmed_at) throw new AuthRequestError("手机尚未完成验证，请刷新后核对。", 409);
    return copyAuthCookies(staged.response, response);
  } catch (reason) { return authFailure(reason, "手机验证暂不可用，请稍后重试。"); }
}
