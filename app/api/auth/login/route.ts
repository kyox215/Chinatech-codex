import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authEmail, authFailure, authPassword, AuthRequestError, createSupabaseRouteClient, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return preventAuthCaching(NextResponse.json({ message: "正式登录未开放。" }, { status: 404 }));
  try {
    requireSameOrigin(request);
    const body = await readAuthBody(request, ["email", "password", "remember"]);
    const email = authEmail(body.email); const password = authPassword(body.password);
    if (body.remember !== undefined && typeof body.remember !== "boolean") throw new AuthRequestError("请求格式无效。");
    const response = preventAuthCaching(NextResponse.json({ ok: true, redirectTo: "/account/pending" }));
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.user.email_confirmed_at) {
      if (data.session) await supabase.auth.signOut({ scope: "local" });
      const failure = preventAuthCaching(NextResponse.json({ message: "邮箱或密码不正确，或账号尚未完成邮箱验证。" }, { status: 401 }));
      response.cookies.getAll().forEach(cookie => failure.cookies.set(cookie));
      return failure;
    }
    const verified = await supabase.auth.getUser();
    if (verified.error || verified.data.user?.id !== data.user.id) {
      await supabase.auth.signOut({ scope: "local" });
      const failure = preventAuthCaching(NextResponse.json({ message: "无法完成登录，请稍后重试。" }, { status: 401 }));
      response.cookies.getAll().forEach(cookie => failure.cookies.set(cookie));
      return failure;
    }
    return response;
  } catch (reason) { return authFailure(reason, "认证服务暂不可用，请稍后重试。"); }
}
