import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../supabase/server";
import { withReadDatabase, BackendError,StoreSessionRequired, type AuthIdentity } from "./database";
import type { StaffMember } from "../staff";
import type { TransactionSql } from "postgres";
import {observe,observeTime} from "./request-observation";
import{authVerificationFailure}from'../supabase/auth-verification-error';

export async function getAuthIdentity(): Promise<AuthIdentity> {
  const client = await createSupabaseServerClient();
  const [{ data: userData, error }, { data: claimsData, error: claimsError }] = await Promise.all([client.auth.getUser().catch(error=>({data:null,error})), client.auth.getClaims().catch(error=>({data:null,error}))]);
  const failure=authVerificationFailure(error,claimsError);
  if(failure)throw new BackendError(failure===401?'请先登录并验证邮箱。':'暂时无法读取登录服务，请稍后重试。',failure);
  const user=userData?.user;
  const claims = claimsData?.claims;
  if (!user || !user.email_confirmed_at || claims?.sub !== user.id || typeof claims.session_id !== "string") throw new BackendError("请先登录并验证邮箱。", 401);
  return { userId: user.id, sessionId: claims.session_id };
}
async function member(tx: TransactionSql, storeId: string, userId: string,read:boolean): Promise<StaffMember> {
  const [allowed] = read
    ? await tx`select chinatech_v2_private.member_access(${storeId}) as allowed,exists(select 1 from chinatech_v2_private.store_login_sessions where store_id=${storeId} and session_id=(current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid and user_id=${userId}) as enrolled`
    : await tx`select chinatech_v2_private.member_access(${storeId}) as allowed`;
  if (!allowed?.allowed) throw new BackendError("此设备无法访问本门店，请重新登录或联系老板。", 403);
  if(read&&!allowed.enrolled)throw new StoreSessionRequired(storeId);
  if(!read){
  try{await observeTime("db_enroll",async()=>tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id)
    values(${storeId},(current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid,${userId}) on conflict do nothing`);}catch(error){
    const code=typeof error==="object"&&error!==null&&"code" in error?error.code:null;
    if(code==="40001"||code==="40P01")observe(code==="40001"?"db_enroll_40001":"db_enroll_40p01",0);
    throw error;
  }
  }
  const [row] = await tx`select m.id,m.role,m.permissions,m.revision,m.membership_status,a.account_status,a.display_name,a.email from chinatech_v2.store_memberships m join chinatech_v2.accounts a on a.id=m.user_id where m.store_id=${storeId} and m.user_id=${userId} and m.membership_status='active' and a.account_status='active'`;
  if (!row) throw new BackendError("当前账号尚未获得此门店授权。", 403);
  return { id: row.id, name: row.display_name || row.email, email: row.email, role: row.role, permissions: row.permissions, revision: row.revision, accountStatus: row.account_status, membershipStatus: row.membership_status };
}
export function memberInTransaction(tx:TransactionSql,storeId:string,userId:string){return member(tx,storeId,userId,false);}
export function memberForRead(tx:TransactionSql,storeId:string,userId:string){return member(tx,storeId,userId,true);}
export async function getServerAccess() {
  const identity = await getAuthIdentity();
  const selected = (await cookies()).get("ct_store")?.value;
  return await withReadDatabase(identity, null, async tx => {
    const rows = await tx`select m.store_id from chinatech_v2.store_memberships m join chinatech_v2.stores s on s.id=m.store_id where m.user_id=${identity.userId} and m.membership_status='active' order by s.created_at,m.store_id`;
    const storeId: string | undefined = selected ? rows.find(row => row.store_id === selected)?.store_id : rows[0]?.store_id;
    if (!storeId) return null;
    const member=await memberForRead(tx,storeId,identity.userId);
    return { identity, storeId, member };
  });
}
