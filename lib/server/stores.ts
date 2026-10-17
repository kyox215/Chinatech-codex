import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { BackendError, withDatabase, type AuthIdentity } from '@/lib/backend/database';
import { memberInTransaction } from '@/lib/backend/context';
import {intakeRecordTime} from '@/lib/repair-intake-record';
import { allPermissions, can, staffRoles, type Permission } from '@/lib/staff';

export const storeUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function requiredUuid(value: unknown) { if (!storeUuid(value)) throw new BackendError('请求标识无效。'); return value; }
export async function myStores(identity: AuthIdentity) {
  return withDatabase(identity, null, async tx => {
    const stores = await tx`select s.id,s.name,m.role from chinatech_v2.store_memberships m join chinatech_v2.stores s on s.id=m.store_id where m.user_id=${identity.userId} and m.membership_status='active' order by s.created_at,s.id limit 100`;
    const applications = await tx`select id,status,created_at from chinatech_v2_private.store_applications where applicant_id=${identity.userId} order by created_at desc limit 30`;
    return { stores, applications };
  });
}
export async function createStore(identity: AuthIdentity, requestId: unknown, name: unknown) {
  requiredUuid(requestId);
  if (typeof name !== 'string' || !name.trim() || name.trim().length>100) throw new BackendError('请填写店铺名称。');
  return withDatabase(identity,null, async tx => {
    const [row] = await tx`select chinatech_v2_private.create_store(${String(requestId)},${name.trim()}) as id`;
    return { storeId: row.id as string };
  });
}
export async function storeTransaction<T>(identity: AuthIdentity, storeId: string, manage: boolean, run: (tx: TransactionSql, member: Awaited<ReturnType<typeof memberInTransaction>>) => Promise<T>) {
  requiredUuid(storeId);
  return withDatabase(identity,storeId,async tx=>{
    // Same lock as ordinary domain commands: revocation, approval and quota
    // reservations serialize with business writes, then recheck live membership.
    await tx`select revision from chinatech_v2_private.store_state where store_id=${storeId} for update`;
    const member=await memberInTransaction(tx,storeId,identity.userId);
    if(manage && !can(member,'staff.manage'))throw new BackendError('当前账号没有管理员工的权限。',403);
    return run(tx,member);
  });
}
export async function storeUsage(tx: TransactionSql, storeId:string) {
  const [row]=await tx`select chinatech_v2_private.read_store_usage(${storeId}) as usage`;
  const usage=row.usage as {usedBytes:number;reservedBytes:number;limitBytes:number;memberCount:number;memberLimit:number;planVersion:string};
  if(!usage)throw new BackendError('门店尚未完成初始化。',503);
  return {...usage,warning:usage.usedBytes+usage.reservedBytes>=usage.limitBytes*.8};
}
export async function listAdmission(identity: AuthIdentity,storeId:string) {
  return storeTransaction(identity,storeId,true,async tx=>({
    invitations:await tx`select id,created_at,expires_at,revoked_at,consumed_at from chinatech_v2_private.store_invitations where store_id=${storeId} order by created_at desc limit 50`,
    applications:await tx`select a.id,a.status,a.created_at,a.applicant_id,p.display_name,p.email from chinatech_v2_private.store_applications a join chinatech_v2.accounts p on p.id=a.applicant_id where a.store_id=${storeId} order by a.created_at desc limit 50`,
  }));
}
export async function createInvitation(identity:AuthIdentity,storeId:string,requestId:string) {
  requiredUuid(requestId);
  // Link secret is returned once; a lost response can be safely revoked by its
  // stable ID and recreated. Never store or log the bearer token in a receipt.
  const token=randomBytes(32).toString('base64url');
  const digest=createHash('sha256').update(token).digest('hex');
  return storeTransaction(identity,storeId,true,async tx=>{
    const [count]=await tx`select count(*)::int as count from chinatech_v2_private.store_invitations where store_id=${storeId} and created_at>now()-interval '1 day'`;
    if(count.count>=30)throw new BackendError('操作过于频繁，请稍后再试。',429);
    const rows=await tx`insert into chinatech_v2_private.store_invitations(id,store_id,token_hash,created_by) values(${requestId},${storeId},${digest},${identity.userId}) on conflict(id) do nothing returning expires_at`;
    if(!rows.length)throw new BackendError('邀请已创建，请在邀请列表撤销后重新生成。',409);
    await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${storeId},${identity.userId},${requestId},'staff.invitation.created',${requestId})`;
    return {id:requestId,token,expiresAt:rows[0].expires_at};
  });
}
export async function revokeInvitation(identity:AuthIdentity,storeId:string,id:string,requestId:string) {
  requiredUuid(id);requiredUuid(requestId);
  return storeTransaction(identity,storeId,true,async tx=>{
    const rows=await tx`update chinatech_v2_private.store_invitations set revoked_at=coalesce(revoked_at,now()) where store_id=${storeId} and id=${id} returning id`;
    if(!rows.length)throw new BackendError('邀请不存在。',404);
    const [receipt]=await tx`select digest from chinatech_v2_private.command_receipts where store_id=${storeId} and actor_id=${identity.userId} and request_id=${requestId}`;
    const digest='invitation.revoke:'+id;
    if(receipt&&receipt.digest!==digest)throw new BackendError('同一请求标识不能用于不同操作。',409);
    if(!receipt){await tx`insert into chinatech_v2_private.command_receipts(store_id,actor_id,request_id,digest) values(${storeId},${identity.userId},${requestId},${digest})`;await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${storeId},${identity.userId},${requestId},'staff.invitation.revoked',${id})`;}
    return {ok:true};
  });
}
export async function invitationAction(identity:AuthIdentity,token:unknown,requestId?:unknown) {
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new BackendError('邀请无效或已过期。',410);
  if(requestId!==undefined)requiredUuid(requestId);
  const digest=createHash('sha256').update(token).digest('hex');
  return withDatabase(identity,null,async tx=>{
    const [row]=await tx`select chinatech_v2_private.invitation_action(${digest},${requestId===undefined?null:String(requestId)}) as result`;
    return row.result;
  });
}
export async function reviewApplication(identity:AuthIdentity,storeId:string,body:Record<string,unknown>) {
  const id=requiredUuid(body.id),requestId=requiredUuid(body.requestId);
  if(!['approve','reject'].includes(String(body.action)))throw new BackendError('请求格式无效。');
  const role=body.role??'viewer', permissions=body.permissions??['retail.view','repairs.view','customers.view'];
  if(typeof role!=='string'||!Object.hasOwn(staffRoles,role)||role==='owner'||!Array.isArray(permissions)||permissions.some(p=>!allPermissions.includes(p as Permission))||new Set(permissions).size!==permissions.length)throw new BackendError('请核对员工角色与权限。');
  if(permissions.includes('financial.edit')&&!permissions.includes('financial.read'))throw new BackendError('更正财务资料需要同时允许查看财务资料。');
  const digest=createHash('sha256').update(JSON.stringify([id,body.action,role,[...permissions].sort()])).digest('hex');
  return storeTransaction(identity,storeId,true,async(tx,member)=>{
    const [previous]=await tx`select digest from chinatech_v2_private.command_receipts where store_id=${storeId} and actor_id=${identity.userId} and request_id=${requestId}`;
    if(previous){if(previous.digest!==digest)throw new BackendError('同一请求标识不能用于不同操作。',409);return {ok:true,replayed:true};}
    const [application]=await tx`select a.*,i.expires_at,i.revoked_at from chinatech_v2_private.store_applications a join chinatech_v2_private.store_invitations i on i.id=a.invitation_id where a.store_id=${storeId} and a.id=${id} for update of a,i`;
    if(!application||application.status!=='pending')throw new BackendError('申请状态已变化，请重新核对。',409);
    if(application.revoked_at||new Date(application.expires_at)<=new Date())throw new BackendError('邀请无效或已过期。',410);
    if(application.applicant_id===identity.userId)throw new BackendError('不能审核自己的申请。',403);
    if(permissions.some(p=>!member.permissions.includes(p as Permission))||(member.role!=='owner'&&permissions.includes('staff.manage')))throw new BackendError('不能授予当前账号无权分配的能力。',403);
    if(body.action==='approve'){
      const [applicant]=await tx`select email from chinatech_v2.accounts where id=${application.applicant_id} and account_status='active'`;
      const verified=applicant?await tx`select id from chinatech_v2_private.verified_account(${storeId},${applicant.email})`:[];
      if(verified[0]?.id!==application.applicant_id)throw new BackendError('员工资料已变化，请重新核对。',409);
      const usage=await storeUsage(tx,storeId);
      const [existing]=await tx`select id,role,membership_status,permissions from chinatech_v2.store_memberships where store_id=${storeId} and user_id=${application.applicant_id}`;
      if(existing?.role==='owner'||existing?.membership_status==='active')throw new BackendError('员工资料已变化，请重新核对。',409);
      if(usage.memberCount>=usage.memberLimit)throw new BackendError('门店成员名额已满。',409,'MEMBER_QUOTA');
      await tx`update chinatech_v2_private.store_applications set status='approved',reviewed_by=${identity.userId},reviewed_at=now() where id=${id}`;
      let targetId=existing?.id as string|undefined;
      if(existing)await tx`update chinatech_v2.store_memberships set role=${role},permissions=${tx.array(permissions as string[],25)},membership_status='active',revision=revision+1 where id=${existing.id} and store_id=${storeId}`;
      else {const [inserted]=await tx`insert into chinatech_v2.store_memberships(store_id,user_id,role,permissions,membership_status) values(${storeId},${application.applicant_id},${role},${tx.array(permissions as string[],25)},'active') returning id`;targetId=inserted.id;}
      const [history]=await tx`select jsonb_array_length(staff_audit)::int as count from chinatech_v2_private.store_state where store_id=${storeId}`;
      if(history.count>=2000)throw new BackendError('本地员工资料或权限历史已达到上限。');
      const audit={id:requestId,actorId:member.id,actorName:member.name,targetId,time:intakeRecordTime(),before:existing?{role:existing.role,accountStatus:'active',membershipStatus:existing.membership_status,permissions:existing.permissions}:null,after:{role,accountStatus:'active',membershipStatus:'active',permissions}};
      await tx`update chinatech_v2_private.store_state set staff_audit=staff_audit||${tx.json([audit])} where store_id=${storeId}`;
    }else await tx`update chinatech_v2_private.store_applications set status='rejected',reviewed_by=${identity.userId},reviewed_at=now() where id=${id}`;
    await tx`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${storeId}`;
    await tx`insert into chinatech_v2_private.command_receipts(store_id,actor_id,request_id,digest) values(${storeId},${identity.userId},${requestId},${digest})`;
    await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${storeId},${identity.userId},${requestId},${'staff.application.'+String(body.action)},${id})`;
    return {ok:true,replayed:false};
  });
}
