import { NextResponse, type NextRequest } from "next/server";
import { normalizeAccountPhone } from "@/lib/account";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { accountActionError, accountAvailability, requireAccountSession, storedAccountPhone } from "@/lib/server/account-auth";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "手机绑定未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({}));
  try {
    requireSameOrigin(request); const body = await readAuthBody(request, ["countryCode", "number"]);
    let phone: string; try { phone = normalizeAccountPhone(body.countryCode, body.number); } catch (reason) { throw new AuthRequestError(reason instanceof Error ? reason.message : "号码格式无效。"); }
    const { supabase, user, identity } = await requireAccountSession(request, response, true);
    if (!(await accountAvailability()).phone) throw new AuthRequestError("短信验证尚未配置，请使用其他登录方式。", 503);
    if (storedAccountPhone(user.phone) === phone && user.phone_confirmed_at) throw new AuthRequestError("这已经是当前绑定手机。", 409);
    const { data, error } = await supabase.auth.updateUser({ phone });
    accountActionError(error, "无法发送验证码，请核对号码后重试。");
    if (data.user?.id !== identity.userId) throw new Error("Unexpected account update identity.");
    return copyAuthCookies(response, NextResponse.json({ message: "验证码已发送，请输入短信验证码完成绑定。", phone }));
  } catch (reason) { return authFailure(reason, "手机绑定暂不可用，请稍后重试。"); }
}
