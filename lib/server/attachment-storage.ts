import 'server-only';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {BackendError,type AuthIdentity} from '@/lib/backend/database';
import {storeTransaction,storeUsage,requiredUuid} from './stores';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import type {IntakePhotoAttachment} from '@/lib/repair-intake-record';
const bucket='chinatech-private-attachments';
async function verifyImage(bytes:Buffer,mime:string){try{const image=sharp(bytes,{failOn:'warning',limitInputPixels:1000000});const metadata=await image.metadata();if('image/'+metadata.format!==mime||!metadata.width||!metadata.height||metadata.width>1000||metadata.height>1000)throw new Error('照片损坏或尺寸过大，请重新选择。');await image.raw().toBuffer();}catch{throw new BackendError('照片损坏或尺寸过大，请重新选择。');}}
export async function reserveAttachment(identity:AuthIdentity,storeId:string,id:string,bytes:Buffer,domain:"repairs"|"retail"="repairs",mime="image/jpeg"){
 requiredUuid(id);if(bytes.length<4||bytes.length>(domain==="retail"?256000:240000))throw new BackendError('照片内容或大小无效。');
 const hash=createHash('sha256').update(bytes).digest('hex');
 return storeTransaction(identity,storeId,false,async(tx,member)=>{
  if(!member.permissions.includes(domain==='retail'?'retail.edit':'repairs.edit')||!member.permissions.includes(domain==='retail'?'retail.view':'repairs.view'))throw new BackendError('当前账号没有工单编辑权限。',403);
  const [old]=await tx`select bytes,content_hash,status,actor_id,domain,mime from chinatech_v2_private.attachment_reservations where store_id=${storeId} and id=${id}`;
  if(old){if(Number(old.bytes)!==bytes.length||old.content_hash!==hash||old.domain!==domain||old.mime!==mime||(old.status!=='confirmed'&&old.actor_id!==identity.userId)||old.status==='cancelled')throw new BackendError('照片编号已用于其他内容，请重新选择照片。',409);return {id,status:old.status as string,hash};}
  const usage=await storeUsage(tx,storeId);
  if(usage.usedBytes+usage.reservedBytes+256000>usage.limitBytes)throw new BackendError('门店附件容量已满。',409,'ATTACHMENT_QUOTA');
  await tx`insert into chinatech_v2_private.attachment_reservations(store_id,id,actor_id,bytes,content_hash,domain,mime) values(${storeId},${id},${identity.userId},${bytes.length},${hash},${domain},${mime})`;
  return {id,status:'reserved',hash};
 });
}
export async function prepareStoredPhotos(identity:AuthIdentity,storeId:string,photos:(Pick<IntakePhotoAttachment,"id"|"base64"|"mime">&{slot?:string})[],domain:"repairs"|"retail"="repairs",repairId?:string){
 const client=await createSupabaseServerClient();
 for(const photo of photos){
  const bytes=Buffer.from(photo.base64,'base64');await verifyImage(bytes,photo.mime);
  if(domain==='repairs'&&repairId){const legacy=await storeTransaction(identity,storeId,false,async(tx,member)=>{
    if(!member.permissions.includes('repairs.view')||!member.permissions.includes('repairs.edit'))throw new BackendError('当前账号没有工单编辑权限。',403);
    const [row]=await tx`select slot,mime,bytes from chinatech_v2_private.intake_photos where store_id=${storeId} and repair_id=${repairId} and id=${photo.id}`;
    if(!row)return false;
    if(row.slot!==photo.slot||row.mime!==photo.mime||!bytes.equals(Buffer.from(row.bytes)))throw new BackendError('照片编号已用于其他内容，请重新选择照片。',409);
    return true;
  });if(legacy)continue;}
  const reservation=await reserveAttachment(identity,storeId,photo.id,bytes,domain,photo.mime);
  if(reservation.status==='confirmed')continue;
  const path=storeId+'/'+photo.id+'.jpg';
  const {error}=await client.storage.from(bucket).upload(path,bytes,{contentType:photo.mime,upsert:false});
  // A retry can find the immutable object created before a lost confirmation.
  if(error&& !['409','400'].includes(String(error.statusCode)))throw new BackendError('照片上传中断，请核对原请求后重试。',503);
  const downloaded=await client.storage.from(bucket).download(path);
  if(downloaded.error||!downloaded.data)throw new BackendError('照片尚未确认保存，请重试原请求。',503);
  const actual=Buffer.from(await downloaded.data.arrayBuffer());
  if(actual.length!==bytes.length||createHash('sha256').update(actual).digest('hex')!==reservation.hash)throw new BackendError('照片原件核对失败。',409);
  await storeTransaction(identity,storeId,false,async tx=>{
   const [row]=await tx`select status,bytes,content_hash from chinatech_v2_private.attachment_reservations where store_id=${storeId} and id=${photo.id} and actor_id=${identity.userId} for update`;
   if(!row||row.status==='cancelled'||Number(row.bytes)!==actual.length||row.content_hash!==reservation.hash)throw new BackendError('照片预留已变化。',409);
   await tx`insert into chinatech_v2_private.attachment_usage(store_id,id,bytes,content_hash,object_path,mime) values(${storeId},${photo.id},${actual.length},${reservation.hash},${path},${photo.mime}) on conflict(store_id,id) do nothing`;
   await tx`update chinatech_v2_private.attachment_reservations set status='confirmed' where store_id=${storeId} and id=${photo.id}`;
  });
 }
}
export async function downloadStoredPhoto(storeId:string,id:string){const client=await createSupabaseServerClient();const {data,error}=await client.storage.from(bucket).download(storeId+'/'+id+'.jpg');if(error||!data)throw new BackendError('照片暂不可用，请稍后重试。',503);return new Uint8Array(await data.arrayBuffer());}

/** Transform only validated newly supplied retail originals; existing references
 * remain immutable and are checked against this store before domain persistence. */
export async function storeRetailPhotos(identity:AuthIdentity,storeId:string,requestId:string,photos:string[]){
 const result:string[]=[];
 for(let index=0;index<photos.length;index++){
  const photo=photos[index];if(photo.startsWith('ct-photo:')){result.push(photo);continue;}
  const match=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo);
  if(!match)throw new BackendError('照片内容或大小无效。');
  const hex=createHash('sha256').update(storeId+'\0'+requestId+'\0'+index).digest('hex');
  const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
  await prepareStoredPhotos(identity,storeId,[{id,base64:match[2],mime:match[1] as 'image/jpeg'}],'retail');
  result.push('ct-photo:'+id);
 }
 return result;
}

export async function cancelAttachment(identity:AuthIdentity,storeId:string,id:string){
 requiredUuid(id);
 return storeTransaction(identity,storeId,false,async tx=>{
  const [reservation]=await tx`select status from chinatech_v2_private.attachment_reservations where store_id=${storeId} and id=${id} and actor_id=${identity.userId} for update`;
  if(!reservation)throw new BackendError('照片预留不存在。',404);
  if(reservation.status==='confirmed')throw new BackendError('原件已保存，容量继续计入。',409);
  await tx`update chinatech_v2_private.attachment_reservations set status='cancelled' where store_id=${storeId} and id=${id} and actor_id=${identity.userId}`;
  return {ok:true};
 });
}
export async function confirmAttachment(identity:AuthIdentity,storeId:string,id:string){
 requiredUuid(id);const row=await storeTransaction(identity,storeId,false,async tx=>{
  const [reservation]=await tx`select bytes,content_hash,status,mime,domain from chinatech_v2_private.attachment_reservations where store_id=${storeId} and id=${id} and actor_id=${identity.userId}`;
  if(!reservation||reservation.status==='cancelled')throw new BackendError('照片预留不存在。',404);return reservation;
 });
 if(row.status==='confirmed')return {id,status:'confirmed'};
 const bytes=Buffer.from(await downloadStoredPhoto(storeId,id));await verifyImage(bytes,row.mime);
 if(bytes.length!==Number(row.bytes)||createHash('sha256').update(bytes).digest('hex')!==row.content_hash)throw new BackendError('照片原件核对失败。',409);
 await storeTransaction(identity,storeId,false,async tx=>{
  const [fresh]=await tx`select status from chinatech_v2_private.attachment_reservations where store_id=${storeId} and id=${id} and actor_id=${identity.userId} for update`;
  if(!fresh||fresh.status==='cancelled')throw new BackendError('照片预留已变化。',409);
  await tx`insert into chinatech_v2_private.attachment_usage(store_id,id,bytes,content_hash,object_path,mime) values(${storeId},${id},${bytes.length},${row.content_hash},${storeId+'/'+id+'.jpg'},${row.mime}) on conflict(store_id,id) do nothing`;
  await tx`update chinatech_v2_private.attachment_reservations set status='confirmed' where store_id=${storeId} and id=${id}`;
 });
 return {id,status:'confirmed'};
}
