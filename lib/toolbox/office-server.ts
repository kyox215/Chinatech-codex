import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { BackendError, readOfficeControl, withDatabase, type AuthIdentity } from "@/lib/backend/database";
import { AuthRequestError } from "@/lib/supabase/server";
import { OfficeError, officeSigningReady, scriptDigest } from "./office-token";
import type { OfficeAction } from "./office-commands";

export function officeResponse<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control','private, no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('CDN-Cache-Control','no-store');response.headers.set('Vercel-CDN-Cache-Control','no-store');
  response.headers.set('Pragma','no-cache');response.headers.set('Expires','0');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Content-Type-Options','nosniff');return response;
}
export function officeFailure(error: unknown) {
  const known=error instanceof OfficeError || error instanceof AuthRequestError || error instanceof BackendError;
  return officeResponse(NextResponse.json({message:known?error.message:'Office 服务暂不可用，请稍后重试。'},{status:known?error.status:503}));
}
const scripts = new Map<OfficeAction,Promise<Buffer>>();
export async function officeScript(action: OfficeAction) {
  let pending=scripts.get(action);
  if(!pending){pending=readFile(join(process.cwd(),'server-assets','office',action+'.ps1.txt'));scripts.set(action,pending);}
  try {const body=await pending;return {body,digest:scriptDigest(body)};} catch {scripts.delete(action);throw new OfficeError('Office 服务暂不可用，请稍后重试。');}
}
export async function publicOfficeState(){const state=await readOfficeControl();return {...state,enabled:state.enabled&&officeSigningReady()};}
export type OfficeAdminState={enabled:boolean;version:string;revision:string;updatedAt:string|null;keyConfigured:boolean;accountId:string;sessionId:string};
type ControlRow={enabled:boolean;version:string;revision:string;admin_user_id:string|null;updated_at:Date|null};
function projection(row:ControlRow,identity:AuthIdentity):OfficeAdminState{return {enabled:row.enabled,version:row.version,revision:row.revision,updatedAt:row.updated_at?.toISOString()??null,keyConfigured:officeSigningReady(),accountId:identity.userId,sessionId:identity.sessionId};}
export async function getOfficeAdmin(identity:AuthIdentity):Promise<OfficeAdminState>{return withDatabase(identity,null,async tx=>{
  const [row]=await tx<ControlRow[]>`select enabled,command_version::text as version,revision::text,admin_user_id,updated_at from chinatech_v2_private.office_command_control where singleton=true`;
  if(!row)throw new OfficeError('Office 服务暂不可用，请稍后重试。');
  if(row.admin_user_id!==identity.userId)throw new OfficeError('你没有网站工具箱管理权限。',403);
  return projection(row,identity);
});}
export async function updateOfficeAdmin(identity:AuthIdentity,enabled:boolean,revision:string,requestId:string):Promise<OfficeAdminState>{return withDatabase(identity,null,async tx=>{
  const [access]=await tx<{admin_user_id:string|null}[]>`select admin_user_id from chinatech_v2_private.office_command_control where singleton=true`;
  if(!access)throw new OfficeError('Office 服务暂不可用，请稍后重试。');
  if(access.admin_user_id!==identity.userId)throw new OfficeError('你没有网站工具箱管理权限。',403);
  const [row]=await tx<ControlRow[]>`select enabled,command_version::text as version,revision::text,admin_user_id,updated_at from chinatech_v2_private.office_command_control where singleton=true for update`;
  if(!row)throw new OfficeError('Office 服务暂不可用，请稍后重试。');
  if(row.admin_user_id!==identity.userId)throw new OfficeError('你没有网站工具箱管理权限。',403);
  const [receipt]=await tx`select actor_id,session_id,requested_enabled,expected_revision::text,result from chinatech_v2_private.office_command_receipts where request_id=${requestId}`;
  if(receipt){
    if(receipt.actor_id!==identity.userId || receipt.session_id!==identity.sessionId || receipt.requested_enabled!==enabled || receipt.expected_revision!==revision)throw new OfficeError('请求编号已被使用，请刷新后重试。',409);
    return projection(row,identity);
  }
  if(row.revision!==revision)throw new OfficeError('开关状态已变化，请刷新后重新核对。',409);
  if(enabled&&!officeSigningReady())throw new OfficeError('签名服务尚未配置，不能开启命令。');
  let saved=row;
  if(row.enabled!==enabled){
    const [updated]=await tx<ControlRow[]>`update chinatech_v2_private.office_command_control set enabled=${enabled},command_version=command_version+1,revision=revision+1,updated_at=now(),updated_by=${identity.userId} where singleton=true returning enabled,command_version::text as version,revision::text,admin_user_id,updated_at`;
    saved=updated;
  }
  const result=projection(saved,identity);
  await tx`insert into chinatech_v2_private.office_command_receipts(request_id,actor_id,session_id,requested_enabled,expected_revision,result) values(${requestId},${identity.userId},${identity.sessionId},${enabled},${revision},${tx.json(result)})`;
  return result;
});}
