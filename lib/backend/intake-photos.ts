import type { TransactionSql } from "postgres";
import sharp from "sharp";
import type { IntakePhotoAttachment } from "../repair-intake-record";
import { BackendError } from "./database";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function parseIntakePhotoAttachments(value:unknown, count:number):Promise<IntakePhotoAttachment[]> {
  if(value===undefined && count===0) return [];
  if(!Array.isArray(value) || value.length!==count || count>6) throw new BackendError("照片尚未完整读取，请重新选择后保存。");
  const ids=new Set<string>();const slots={front:0,back:0,other:0};
  for(const photo of value) {
    if(!photo || typeof photo!=="object" || Array.isArray(photo) || Object.keys(photo).some(key=>!["id","slot","mime","base64"].includes(key)) || typeof photo.id!=="string" || !uuid.test(photo.id) || ids.has(photo.id.toLowerCase()) || !["front","back","other"].includes(photo.slot) || photo.mime!=="image/jpeg" || typeof photo.base64!=="string" || photo.base64.length>320000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) throw new BackendError("照片资料无效，请重新选择。");
    const bytes=Buffer.from(photo.base64,"base64");
    if(bytes.length<4 || bytes.length>240000 || bytes.toString("base64")!==photo.base64 || bytes[0]!==255 || bytes[1]!==216 || bytes[2]!==255 || bytes.at(-2)!==255 || bytes.at(-1)!==217) throw new BackendError("照片必须是已压缩的有效 JPEG。");
    try {
      const image=sharp(bytes,{failOn:"warning",limitInputPixels:1000000});
      const metadata=await image.metadata();
      if(metadata.format!=="jpeg" || !metadata.width || !metadata.height || metadata.width>1000 || metadata.height>1000) throw new Error("Invalid dimensions");
      await image.raw().toBuffer();
    } catch { throw new BackendError("照片损坏或尺寸过大，请重新选择。"); }
    ids.add(photo.id.toLowerCase());slots[photo.slot as keyof typeof slots]++;
  }
  if(slots.front>1 || slots.back>1 || slots.other>4) throw new BackendError("正背面各一张，其他照片最多四张。");
  return value.map(photo=>({...photo,id:photo.id.toLowerCase()})) as IntakePhotoAttachment[];
}
export async function putIntakePhotos(tx:TransactionSql,storeId:string,repairId:string,photos:IntakePhotoAttachment[]) {
  for(const photo of photos) {
    const bytes=Buffer.from(photo.base64,"base64");
    const [legacy]=await tx`select slot,mime,bytes from chinatech_v2_private.intake_photos where store_id=${storeId} and repair_id=${repairId} and id=${photo.id}`;
    if(legacy){if(legacy.slot!==photo.slot||legacy.mime!==photo.mime||!bytes.equals(Buffer.from(legacy.bytes)))throw new BackendError("照片编号已用于其他内容，请重新选择照片。",409);continue;}
    const [usage]=await tx`select u.bytes,u.content_hash from chinatech_v2_private.attachment_usage u join chinatech_v2_private.attachment_reservations r on r.store_id=u.store_id and r.id=u.id where u.store_id=${storeId} and u.id=${photo.id} and r.domain='repairs' and r.status='confirmed'`;
    if(!usage||Number(usage.bytes)!==bytes.length)throw new BackendError("照片尚未确认保存，请重试原请求。",409);
    const rows=await tx`insert into chinatech_v2_private.intake_photo_objects(store_id,repair_id,id,slot,mime) values(${storeId},${repairId},${photo.id},${photo.slot},${photo.mime}) on conflict(store_id,repair_id,id) do nothing returning id`;
    if(!rows.length){const [old]=await tx`select slot,mime from chinatech_v2_private.intake_photo_objects where store_id=${storeId} and repair_id=${repairId} and id=${photo.id}`;if(!old||old.slot!==photo.slot||old.mime!==photo.mime)throw new BackendError("照片编号已用于其他内容，请重新选择照片。",409);}
  }
  if(photos.length){const [history]=await tx`select count(*)::int as count,coalesce(sum(bytes),0)::bigint as bytes from (select octet_length(bytes) as bytes from chinatech_v2_private.intake_photos where store_id=${storeId} and repair_id=${repairId} union all select u.bytes from chinatech_v2_private.intake_photo_objects p join chinatech_v2_private.attachment_usage u on u.store_id=p.store_id and u.id=p.id where p.store_id=${storeId} and p.repair_id=${repairId}) h`;
    if(history.count>30||Number(history.bytes)>7200000)throw new BackendError("此工单已达到30张照片历史上限，原照片和工单未被更改。");
  }
}
