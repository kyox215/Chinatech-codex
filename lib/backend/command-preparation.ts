import type{AuthIdentity}from'./database';
import{BackendError}from'./database';
import type{BackendCommand}from'./contracts';
import type{IntakePhotoAttachment}from'../repair-intake-record';
import{parseIntakePhotoAttachments}from'./intake-photos';
import{validateRetailPhotos}from'../retail';
import{prepareStoredPhotos,storeRetailPhotos}from'../server/attachment-storage';
export type PreparedCommand={payload:Record<string,unknown>;intakePhotos?:IntakePhotoAttachment[]};
export function hasCommandPhotoPreparation(kind:string,p:Record<string,unknown>){
 if(kind==='intake.save'||kind==='intake.photos')return Array.isArray(p.photos)&&p.photos.length>0;
 const photos=kind==='retail'?(p.type==='create'?p.photos:p.type==='command'&&p.command&&typeof p.command==='object'&&(p.command as {type?:unknown}).type==='photos'?(p.command as {photos?:unknown}).photos:undefined):kind==='retail.workflow'&&p.type==='create_ready'?p.photos:undefined;
 return Array.isArray(photos)&&photos.some(value=>typeof value!=='string'||!value.startsWith('ct-photo:'));
}
function immutable(value:unknown){const pending=[value],seen=new WeakSet<object>();while(pending.length){const current=pending.pop();if(!current||typeof current!=='object'||seen.has(current))continue;seen.add(current);pending.push(...Object.values(current));Object.freeze(current);}}
/** Server-only per-request work. The original command/digest is never mutated;
 * the write transaction receives immutable facts and still checks all live
 * permissions, versions, references, limits and canonical relations. */
export async function prepareCommand(identity:AuthIdentity,command:BackendCommand):Promise<PreparedCommand>{
 const payload=structuredClone(command.payload)as Record<string,unknown>;let intakePhotos:IntakePhotoAttachment[]|undefined;
 if(command.kind==='intake.save'||command.kind==='intake.photos'){
  if(command.kind==='intake.photos'&&(!Array.isArray(payload.photos)||!payload.photos.length))throw new BackendError('请选择需要登记的照片。');
  const count=command.kind==='intake.save'?(payload.data as {photoCount?:number}|undefined)?.photoCount:Array.isArray(payload.photos)?payload.photos.length:0;
  intakePhotos=await parseIntakePhotoAttachments(payload.photos,count??-1);
  if(intakePhotos.length)await prepareStoredPhotos(identity,command.storeId,intakePhotos,'repairs',command.kind==='intake.photos'?String(payload.id):String((payload.data as {id?:unknown})?.id));
  immutable(intakePhotos);
 }
 if(command.kind==='retail'){
  if(payload.type==='create'&&payload.photos!==undefined)payload.photos=await storeRetailPhotos(identity,command.storeId,command.requestId,validateRetailPhotos(payload.photos));
  else if(payload.type==='command'&&payload.command&&typeof payload.command==='object'&&(payload.command as {type?:unknown}).type==='photos'){const next=payload.command as {photos:unknown};next.photos=await storeRetailPhotos(identity,command.storeId,command.requestId,validateRetailPhotos(next.photos));}
 }
 if(command.kind==='retail.workflow'&&payload.type==='create_ready'&&payload.photos!==undefined)payload.photos=await storeRetailPhotos(identity,command.storeId,command.requestId,validateRetailPhotos(payload.photos));
 immutable(payload);return{payload,intakePhotos};
}
export function preparedIntakePhotos(prepared:PreparedCommand,count:number){if(!prepared.intakePhotos||prepared.intakePhotos.length!==count)throw new BackendError('照片尚未完整读取，请重新选择后保存。');return prepared.intakePhotos;}
