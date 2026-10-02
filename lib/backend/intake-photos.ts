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
    const created=await tx`insert into chinatech_v2_private.intake_photos(store_id,repair_id,id,slot,mime,bytes) values(${storeId},${repairId},${photo.id},${photo.slot},${photo.mime},${bytes}) on conflict(store_id,repair_id,id) do nothing returning id`;
    if(!created.length) {
      const [previous]=await tx`select slot,mime,bytes from chinatech_v2_private.intake_photos where store_id=${storeId} and repair_id=${repairId} and id=${photo.id}`;
      if(!previous || previous.slot!==photo.slot || previous.mime!==photo.mime || !bytes.equals(Buffer.from(previous.bytes))) throw new BackendError("照片编号已用于其他内容，请重新选择照片。",409);
    }
  }
  if(photos.length) {
    const [history]=await tx`select count(*)::int as count,coalesce(sum(octet_length(bytes)),0)::int as bytes from chinatech_v2_private.intake_photos where store_id=${storeId} and repair_id=${repairId}`;
    if(history.count>30 || history.bytes>7200000) throw new BackendError("此工单已达到30张照片历史上限，原照片和工单未被更改。");
  }
}
