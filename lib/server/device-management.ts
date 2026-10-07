import { NextResponse, type NextRequest } from "next/server";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { AuthRequestError, authFailure, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { requireAccountSession } from "./account-auth";
import { copyAuthCookies } from "./auth-flows";
import { clearLocalAuthCookies } from "./login-policy";
import type { LoginDevice } from "@/lib/login-devices";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function manageDevices(request: NextRequest, storeMode: boolean, writing: boolean) {
  const response = preventAuthCaching(NextResponse.json({}));
  try {
    if (writing) requireSameOrigin(request);
    const { identity, supabase } = await requireAccountSession(request, response, writing);
    if (writing && request.headers.get("X-CT-Session-ID") !== identity.sessionId) throw new AuthRequestError("登录会话已变化，请重新读取设备后重试。", 409);
    const access = storeMode ? await getServerAccess() : null;
    if (storeMode && (!access || access.identity.userId !== identity.userId || access.identity.sessionId !== identity.sessionId || access.member.role !== "owner")) throw new AuthRequestError("仅门店老板可以管理员工登录设备。", 403);
    const body = writing ? await readAuthBody(request, ["requestId", "memberId", "sessionId", "scope", "revision"]) : null;
    const memberId = storeMode ? body?.memberId ?? request.nextUrl.searchParams.get("memberId") : null;
    if (storeMode && !uuid(memberId)) throw new AuthRequestError("请求格式无效。");
    if (!storeMode && body?.memberId !== undefined) throw new AuthRequestError("请求格式无效。");
    const offsetText = request.nextUrl.searchParams.get("offset") ?? "0";
    if (!/^\d{1,6}$/.test(offsetText) || Number(offsetText) > 100000) throw new AuthRequestError("请求格式无效。");
    const offset = Number(offsetText);
    if (body && (!uuid(body.requestId) || !["one", "others", "all"].includes(String(body.scope)) || (storeMode ? body.scope === "others" : body.scope === "all") || (body.scope === "one" && (!uuid(body.sessionId) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 1)) || (body.scope !== "one" && (body.sessionId !== undefined || body.revision !== undefined)))) throw new AuthRequestError("请求格式无效。");
    const result = await withDatabase(identity, access?.storeId ?? null, async tx => {
      if (access) {
        const fresh = await memberInTransaction(tx, access.storeId, identity.userId);
        if (fresh.role !== "owner") throw new AuthRequestError("仅门店老板可以管理员工登录设备。", 403);
      }
      let target = identity.userId;
      if (access) {
        const [member] = await tx`select user_id from chinatech_v2.store_memberships where store_id=${access.storeId} and id=${String(memberId)} and membership_status='active'`;
        if (!member) throw new AuthRequestError("员工资料已变化，请重新读取。", 409);
        target = member.user_id;
      }
      if (!body) {
        const rows = access
          ? await tx`select l.session_id,l.browser,l.os,l.created_at,l.remember,s.last_active_at,s.revoked_at,s.revision from chinatech_v2_private.store_login_sessions s join chinatech_v2_private.login_sessions l on l.session_id=s.session_id where s.store_id=${access.storeId} and s.user_id=${target} and l.revoked_at is null and l.last_active_at>now()-interval '30 days' and chinatech_v2_private.session_auth_active(l.session_id) order by l.created_at desc,l.session_id limit 21 offset ${offset}`
          : await tx`select session_id,browser,os,created_at,remember,last_active_at,revoked_at,revision from chinatech_v2_private.login_sessions where user_id=${target} and revoked_at is null and last_active_at>now()-interval '30 days' and chinatech_v2_private.session_auth_active(session_id) order by created_at desc,session_id limit 21 offset ${offset}`;
        const devices: LoginDevice[] = rows.slice(0,20).map(row => ({ id: row.session_id, browser: row.browser, os: row.os, createdAt: new Date(row.created_at).toISOString(), lastActiveAt: new Date(row.last_active_at).toISOString(), remember: row.remember, current: row.session_id === identity.sessionId, revoked: Boolean(row.revoked_at), revision: row.revision }));
        const [count] = access
          ? await tx`select count(*) as count from chinatech_v2_private.store_login_sessions s join chinatech_v2_private.login_sessions l on l.session_id=s.session_id where s.store_id=${access.storeId} and s.user_id=${target} and s.revoked_at is null and l.revoked_at is null and l.last_active_at>now()-interval '30 days' and chinatech_v2_private.session_auth_active(l.session_id)`
          : await tx`select count(*) as count from chinatech_v2_private.login_sessions where user_id=${target} and session_id<>${identity.sessionId} and revoked_at is null and last_active_at>now()-interval '30 days' and chinatech_v2_private.session_auth_active(session_id)`;
        return { accountId: identity.userId, sessionId: identity.sessionId, actionableCount: Number(count.count), devices, nextOffset: rows.length > 20 ? offset + 20 : null };
      }
      const kind = (access ? "store." : "account.") + String(body.scope);
      const [receipt] = await tx`select kind,target_user_id,target_session_id,store_id from chinatech_v2_private.session_audit where actor_id=${identity.userId} and request_id=${String(body.requestId)}`;
      if (receipt) {
        if (receipt.kind !== kind || receipt.target_user_id !== target || receipt.target_session_id !== (body.sessionId ?? null) || receipt.store_id !== (access?.storeId ?? null)) throw new AuthRequestError("请求标识已用于其他操作。", 409);
        return { ok: true, currentRevoked: body.sessionId === identity.sessionId && !access };
      }
      const rows = access
        ? await tx`select session_id,revision,revoked_at from chinatech_v2_private.store_login_sessions where store_id=${access.storeId} and user_id=${target} and (${body.scope !== "one"} or session_id=${typeof body.sessionId === "string" ? body.sessionId : identity.sessionId}) order by session_id`
        : await tx`select session_id,revision,revoked_at from chinatech_v2_private.login_sessions where user_id=${target} and (${body.scope !== "one"} or session_id=${typeof body.sessionId === "string" ? body.sessionId : identity.sessionId}) and (${body.scope !== "others"} or session_id<>${identity.sessionId}) order by session_id`;
      if (body.scope === "one" && !rows.length) throw new AuthRequestError("登录设备不存在或已不可用。", 404);
      for (const row of rows) {
        if (access) await tx`select chinatech_v2_private.lock_store_session(${access.storeId},${row.session_id})`;
        if (row.revoked_at) continue;
        if (body.scope === "one" && row.revision !== body.revision) throw new AuthRequestError("设备状态已变化，请重新读取。", 409);
        if (access) await tx`update chinatech_v2_private.store_login_sessions set revoked_at=now(),revision=revision+1 where store_id=${access.storeId} and session_id=${row.session_id} and revoked_at is null`;
        else await tx`update chinatech_v2_private.login_sessions set revoked_at=now(),revision=revision+1 where session_id=${row.session_id} and user_id=${target} and revoked_at is null`;
      }
      try {
        await tx`insert into chinatech_v2_private.session_audit(actor_id,request_id,store_id,target_user_id,kind,target_session_id) values(${identity.userId},${String(body.requestId)},${access?.storeId ?? null},${target},${kind},${typeof body.sessionId === "string" ? body.sessionId : null})`;
      } catch (reason) {
        // A competing identical request can win the receipt PK without touching
        // any target rows. Retry the entire authorized transaction to read it.
        if (typeof reason === "object" && reason !== null && "code" in reason && reason.code === "23505" && "constraint_name" in reason && reason.constraint_name === "session_audit_pkey") throw Object.assign(new Error("登录设备暂不可用，请稍后重试。"), { code: "40001" });
        throw reason;
      }
      return { ok: true, currentRevoked: !access && body.sessionId === identity.sessionId };
    });
    if ("currentRevoked" in result && result.currentRevoked) {
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* The project session is already revoked. */ }
      clearLocalAuthCookies(request, response);
    }
    return copyAuthCookies(response, NextResponse.json(result));
  } catch (reason) { return copyAuthCookies(response, authFailure(reason instanceof BackendError ? new AuthRequestError(reason.message, reason.status) : reason, "登录设备暂不可用，请稍后重试。")); }
}
