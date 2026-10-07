import { NextResponse, type NextRequest } from "next/server";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { memberInTransaction } from "@/lib/backend/context";
import { readAuthAccessToken } from "@/lib/server/login-policy";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { authFailure, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const response = preventAuthCaching(NextResponse.json({ ok: true }));
  try {
    requireSameOrigin(request);
    const body = await readAuthBody(request, ["store"]);
    if (body.store !== undefined && typeof body.store !== "boolean") throw new AuthRequestError("请求格式无效。");
    const token = readAuthAccessToken(request.cookies.getAll());
    if (!token) throw new AuthRequestError("请重新登录后管理账号。", 401);
    // An untrusted expiry hint can only request a normal authenticated refresh;
    // it grants no access and does not touch the idle clock.
    try {
      const hint = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (typeof hint.exp === "number" && Number.isFinite(hint.exp) && hint.exp <= Date.now()/1000) return preventAuthCaching(NextResponse.json({ code: "SESSION_REFRESH_REQUIRED" }, { status: 409 }));
    } catch { /* Actual JWT verification below rejects invalid tokens. */ }
    const { url, publishableKey } = getSupabaseConfig();
    const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) }) } });
    // Explicit JWT verification does not refresh tokens or write cookies.
    const [{ data: { user }, error }, { data, error: claimsError }] = await Promise.all([auth.auth.getUser(token), auth.auth.getClaims(token)]);
    const claims = data?.claims;
    if (error || claimsError || !user?.email_confirmed_at || claims?.sub !== user.id || typeof claims.session_id !== "string") throw new AuthRequestError("请重新登录后管理账号。", 401);
    const identity = { userId: user.id, sessionId: claims.session_id };
    const storeId = body.store === true ? request.cookies.get("ct_store")?.value : undefined;
    // The default store is resolved by the authoritative backend, not client input.
    await withDatabase(identity, null, async tx => {
      let selected = storeId;
      if (body.store === true && !selected) {
        const [member] = await tx`select m.store_id from chinatech_v2.store_memberships m join chinatech_v2.stores s on s.id=m.store_id where m.user_id=${identity.userId} and m.membership_status='active' order by s.created_at,m.store_id limit 1`;
        selected = member?.store_id;
      }
      if (selected) {
        await memberInTransaction(tx, selected, identity.userId);
        await tx`update chinatech_v2_private.store_login_sessions set last_active_at=now() where store_id=${selected} and session_id=${identity.sessionId} and revoked_at is null and last_active_at<now()-interval '1 minute'`;
      }
      await tx`update chinatech_v2_private.login_sessions set last_active_at=now() where session_id=${identity.sessionId} and last_active_at<now()-interval '1 minute' and revoked_at is null`;
    });
    return response;
  } catch (reason) { return authFailure(reason instanceof BackendError ? new AuthRequestError(reason.message, reason.status) : reason, "无法核对登录状态，请稍后重试。"); }
}
