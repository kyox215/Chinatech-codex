import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authEmail, authFailure, authPassword, AuthRequestError, createSupabaseRouteClient, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return preventAuthCaching(NextResponse.json({ message: "正式注册未开放。" }, { status: 404 }));
  try {
    const origin = requireSameOrigin(request);
    const body = await readAuthBody(request, ["displayName", "email", "password"]);
    const email = authEmail(body.email); const password = authPassword(body.password, true);
    if (typeof body.displayName !== "string" || !body.displayName.trim() || body.displayName.length > 80 || /[\u0000-\u001f\u007f]/.test(body.displayName)) throw new AuthRequestError("请填写有效称呼（最多 80 字）。");
    const response = preventAuthCaching(NextResponse.json({ ok: true, redirectTo: "/account/pending", message: "如果此邮箱可以注册，请按收到的邮件验证邮箱，再登录等待门店授权。" }));
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: body.displayName.trim() }, emailRedirectTo: `${origin}/auth/confirm` } });
    // Account creation never grants a store membership, including if auto-confirm was misconfigured.
    if (data.session) await supabase.auth.signOut({ scope: "local" });
    if (error && !["user_already_exists", "email_exists"].includes(error.code ?? "")) return preventAuthCaching(NextResponse.json({ message: "无法完成注册，请核对资料或稍后重试。" }, { status: 400 }));
    return response;
  } catch (reason) { return authFailure(reason, "注册服务暂不可用，请稍后重试。"); }
}
