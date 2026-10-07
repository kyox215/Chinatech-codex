import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../supabase/server";
import { withDatabase, BackendError, type AuthIdentity } from "./database";
import type { StaffMember } from "../staff";
import type { TransactionSql } from "postgres";

export async function getAuthIdentity(): Promise<AuthIdentity> {
  const client = await createSupabaseServerClient();
  const [{ data: { user }, error }, { data: claimsData, error: claimsError }] = await Promise.all([client.auth.getUser(), client.auth.getClaims()]);
  const claims = claimsData?.claims;
  if (error || claimsError || !user || !user.email_confirmed_at || claims?.sub !== user.id || typeof claims.session_id !== "string") throw new BackendError("请先登录并验证邮箱。", 401);
  return { userId: user.id, sessionId: claims.session_id };
}
export async function memberInTransaction(tx: TransactionSql, storeId: string, userId: string): Promise<StaffMember> {
  const [allowed] = await tx`select chinatech_v2_private.member_access(${storeId}) as allowed`;
  if (!allowed?.allowed) throw new BackendError("此设备无法访问本门店，请重新登录或联系老板。", 403);
  await tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id)
    values(${storeId},(current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid,${userId}) on conflict do nothing`;
  const [row] = await tx`select m.id,m.role,m.permissions,m.revision,m.membership_status,a.account_status,a.display_name,a.email from chinatech_v2.store_memberships m join chinatech_v2.accounts a on a.id=m.user_id where m.store_id=${storeId} and m.user_id=${userId} and m.membership_status='active' and a.account_status='active'`;
  if (!row) throw new BackendError("当前账号尚未获得此门店授权。", 403);
  return { id: row.id, name: row.display_name || row.email, email: row.email, role: row.role, permissions: row.permissions, revision: row.revision, accountStatus: row.account_status, membershipStatus: row.membership_status };
}
export async function getServerAccess() {
  const identity = await getAuthIdentity();
  const selected = (await cookies()).get("ct_store")?.value;
  return await withDatabase(identity, null, async tx => {
    const rows = await tx`select m.store_id from chinatech_v2.store_memberships m join chinatech_v2.stores s on s.id=m.store_id where m.user_id=${identity.userId} and m.membership_status='active' order by s.created_at,m.store_id`;
    const storeId: string | undefined = selected ? rows.find(row => row.store_id === selected)?.store_id : rows[0]?.store_id;
    if (!storeId) return null;
    const member = await memberInTransaction(tx, storeId, identity.userId);
    return { identity, storeId, member };
  });
}
