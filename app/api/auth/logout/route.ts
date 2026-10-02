import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, createSupabaseRouteClient, preventAuthCaching, requireSameOrigin } from "@/lib/supabase/server";
import { clearRecoveryProof } from "@/lib/server/auth-flows";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return preventAuthCaching(NextResponse.json({ message: "正式登录未开放。" }, { status: 404 }));
  try {
    requireSameOrigin(request);
    const response = preventAuthCaching(NextResponse.json({ ok: true }));
    clearRecoveryProof(response);
    const supabase = createSupabaseRouteClient(request, response);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return authFailure(null, "退出失败，请稍后重试。");
    return response;
  } catch (reason) { return authFailure(reason, "退出失败，请稍后重试。"); }
}
