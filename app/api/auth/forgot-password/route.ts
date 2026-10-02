import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authEmail, authFailure, createSupabaseRouteClient, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { clearRecoveryProof, emailDeliveryFailure } from "@/lib/server/auth-flows";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "密码恢复未开放。", 404);
  try {
    const origin = requireSameOrigin(request);
    const body = await readAuthBody(request, ["email"]);
    const email = authEmail(body.email);
    const response = preventAuthCaching(NextResponse.json({ ok: true, message: "如果此邮箱可以重置密码，你会收到重置邮件。请在发起申请的同一浏览器打开链接。" }));
    clearRecoveryProof(response);
    const supabase = createSupabaseRouteClient(request, response);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
    emailDeliveryFailure(error);
    return response;
  } catch (reason) { return authFailure(reason, "密码恢复暂不可用，请稍后重试。"); }
}
