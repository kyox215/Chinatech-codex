import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authEmail, authFailure, createSupabaseRouteClient, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { emailDeliveryFailure } from "@/lib/server/auth-flows";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "邮箱验证未开放。", 404);
  try {
    const origin = requireSameOrigin(request);
    const body = await readAuthBody(request, ["email"]);
    const email = authEmail(body.email);
    const response = preventAuthCaching(NextResponse.json({ ok: true, message: "如果此邮箱尚待验证，你会收到新的验证邮件。请在注册时使用的浏览器打开链接。" }));
    const supabase = createSupabaseRouteClient(request, response);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/confirm` } });
    emailDeliveryFailure(error);
    return response;
  } catch (reason) { return authFailure(reason, "邮箱验证暂不可用，请稍后重试。"); }
}
