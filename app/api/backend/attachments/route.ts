import type {NextRequest} from 'next/server';
import {storeHttp,requestStore} from '@/lib/server/store-http';
import {storeTransaction,storeUsage,requiredUuid} from '@/lib/server/stores';
import {confirmAttachment,cancelAttachment} from '@/lib/server/attachment-storage';
import {BackendError} from '@/lib/backend/database';
export const dynamic='force-dynamic';
export function POST(request:NextRequest){return storeHttp(request,true,['action','id','bytes','hash','domain','mime'],async(identity,body)=>{
 const storeId=requestStore(request),id=requiredUuid(body.id);
 if(body.action==='cancel')return cancelAttachment(identity,storeId,id);
 if(body.action==='confirm')return confirmAttachment(identity,storeId,id);
 if(body.action!=='reserve'||!Number.isSafeInteger(body.bytes)||Number(body.bytes)<4||Number(body.bytes)>256000||typeof body.hash!=='string'||!/^[a-f0-9]{64}$/.test(body.hash)||!['repairs','retail'].includes(String(body.domain))||!['image/jpeg','image/png','image/webp'].includes(String(body.mime)))throw new BackendError('照片内容或大小无效。');
 if(body.domain==='repairs'&&(body.mime!=='image/jpeg'||Number(body.bytes)>240000))throw new BackendError('照片内容或大小无效。');
 return storeTransaction(identity,storeId,false,async(tx,member)=>{
  const domain=String(body.domain),mime=String(body.mime),hash=String(body.hash),bytes=Number(body.bytes);
  if(!member.permissions.includes(domain==='retail'?'retail.edit':'repairs.edit'))throw new BackendError('当前账号没有查看权限。',403);
  const [existing]=await tx`select actor_id,bytes,content_hash,domain,mime,status from chinatech_v2_private.attachment_reservations where store_id=${storeId} and id=${id}`;
  if(existing){if(existing.actor_id!==identity.userId||Number(existing.bytes)!==bytes||existing.content_hash!==hash||existing.domain!==domain||existing.mime!==mime||existing.status==='cancelled')throw new BackendError('照片预留已变化。',409);return {id,status:existing.status,path:storeId+'/'+id+'.jpg'};}
  const usage=await storeUsage(tx,storeId);if(usage.usedBytes+usage.reservedBytes+256000>usage.limitBytes)throw new BackendError('门店附件容量已满。',409);
  await tx`insert into chinatech_v2_private.attachment_reservations(store_id,id,actor_id,bytes,content_hash,domain,mime) values(${storeId},${id},${identity.userId},${bytes},${hash},${domain},${mime})`;
  return {id,status:'reserved',path:storeId+'/'+id+'.jpg'};
 });
});}
