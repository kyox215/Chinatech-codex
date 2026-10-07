import { randomUUID } from "node:crypto";
import { withDatabase } from "@/lib/backend/database";
import { requireAccountSession } from "@/lib/server/account-auth";
import { clearLocalAuthCookies } from "@/lib/server/login-policy";
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
    // An already expired session can still clear its local cookies.
    try {
      const { identity } = await requireAccountSession(request, response);
      await withDatabase(identity, null, async tx => { await tx`insert into chinatech_v2_private.session_audit(actor_id,request_id,target_user_id,kind,target_session_id) values(${identity.userId},${randomUUID()},${identity.userId},'account.logout',${identity.sessionId})`; await tx`update chinatech_v2_private.login_sessions set revoked_at=now(),revision=revision+1 where session_id=${identity.sessionId} and revoked_at is null`; });
    } catch (reason) { if (!(reason instanceof Error && "status" in reason && reason.status === 401)) throw reason; }
    // Project revocation is committed (or the session is already invalid).
    // Provider availability cannot undo it or discard the local deletions.
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* Local cleanup still completes. */ }
    clearLocalAuthCookies(request, response);
    return response;
  } catch (reason) { return authFailure(reason, "退出失败，请稍后重试。"); }
}
