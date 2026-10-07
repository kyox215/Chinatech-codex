import { clearLoginPolicy } from "@/lib/server/login-policy";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, authPassword, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { clearRecoveryProof, copyAuthCookies, requireRecoverySession } from "@/lib/server/auth-flows";

export async function GET(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "密码重置未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({ ok: true }));
  try {
    await requireRecoverySession(request, response);
    return response;
  } catch (reason) {
    const failure = copyAuthCookies(response, authFailure(reason, "暂时无法验证重置链接，请稍后重试。", 503));
    if (reason instanceof AuthRequestError && reason.status === 401) clearRecoveryProof(failure);
    return failure;
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "密码重置未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({ ok: true, redirectTo: "/login?notice=password-updated" }));
  try {
    requireSameOrigin(request);
    const body = await readAuthBody(request, ["password"]);
    const password = authPassword(body.password, true);
    const supabase = await requireRecoverySession(request, response);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new AuthRequestError(error.code === "same_password" ? "新密码不能与原密码相同。" : "无法更新密码，请使用更强的密码或重新申请重置。", 400);
    clearRecoveryProof(response);
    clearLoginPolicy(response);
    // Supabase password updates revoke other sessions; remove this recovery session too.
    await supabase.auth.signOut({ scope: "local" });
    return response;
  } catch (reason) { return copyAuthCookies(response, authFailure(reason, "密码重置暂不可用，请稍后重试。")); }
}
