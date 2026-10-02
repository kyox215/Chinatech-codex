import type { IntakeServices } from "./intake-services";
import type { RepairOrder } from "./repair-fixtures";

export type IntakePolicy = { months: number; shopName: string; address: string; phone: string };
export type SignatureStrokes = { x:number; y:number }[][];
export type IntakeSignatureDraft = { id:string; signedAt:string; language:"it"|"en"|"zh"; termsVersion:string; strokes:SignatureStrokes; aspectRatio?:number; snapshot:IntakeSignatureSnapshot };
export type IntakeSignature = IntakeSignatureDraft & { orderId:string; actorId:string };
export type IntakeSignatureSnapshot = Pick<IntakeReceiptData,"customerName"|"phone"|"email"|"category"|"brand"|"model"|"color"|"serial"|"issue"|"accessories"|"services"|"priority"|"faults"|"issueNote"> & { policy:IntakePolicy };
export type IntakePhotoReference = { id: string; slot: "front" | "back" | "other" };
export type IntakePhotoAttachment = IntakePhotoReference & { mime: "image/jpeg"; base64: string };
export type IntakeReceiptData = {
  revision?: number; policy?: IntakePolicy; faults?: string[]; issueNote?: string;
  retailOrigin?: {unitId:string;saleId:string;caseId:string};
  custody?: "store" | "customer";
  id: string; createdAt: string; updatedAt: string; previewAt: string;
  customerName: string; phone: string; email: string;
  category: string; brand: string; model: string; color: string; serial: string;
  issue: string; accessories: string[]; services: IntakeServices;
  priority: "普通" | "优先" | "紧急"; photoCount: number; photos?: IntakePhotoReference[];
};
export type RepairDirectoryEntry = Pick<RepairOrder, "id" | "status" | "statusLabel" | "tone" | "priority" | "customer" | "device" | "issue" | "accessories" | "createdAt" | "updatedAt" | "technician" | "waitingFor"> & { custody?: "store" | "customer" };
export const localIntakeId = (id: string) => /^LOCAL-[A-F0-9]{16}$/.test(id);
export function intakeRecordTime(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium", hour12: false }).format(date);
}
export function intakeDirectoryEntry(data: IntakeReceiptData): RepairDirectoryEntry {
  return { id: data.id, status: "diagnosis", statusLabel: "待检测", tone: "warning", priority: data.priority,
    customer: { name: data.customerName || "未填写姓名", phone: data.phone },
    device: { category: data.category, brand: data.brand, model: data.model, color: data.color, serial: data.serial },
    issue: data.issue, accessories: data.accessories, createdAt: data.createdAt, updatedAt: data.updatedAt,
    technician: "未分配", waitingFor: "接机检测", ...(data.custody ? {custody:data.custody} : {}) };
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function validIntakePhotos(value: unknown): value is IntakePhotoReference[] {
  if (!Array.isArray(value) || value.length > 6) return false;
  const ids = new Set<string>();
  const counts = { front: 0, back: 0, other: 0 };
  for (const photo of value) {
    if (!isObject(photo) || Object.keys(photo).some(key => !["id", "slot"].includes(key))
      || typeof photo.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photo.id)
      || typeof photo.slot !== "string" || !["front", "back", "other"].includes(photo.slot)) return false;
    const id = photo.id.toLowerCase();
    if (ids.has(id)) return false;
    ids.add(id);
    counts[photo.slot as IntakePhotoReference["slot"]]++;
  }
  return counts.front <= 1 && counts.back <= 1 && counts.other <= 4;
}
function validServices(value: unknown): value is IntakeServices {
  if (!isObject(value) || !isObject(value.screen) || !isObject(value.battery) || !isObject(value.port)) return false;
  const quality = ["", "original", "assembled"];
  return [value.screen.quality, value.battery.quality, value.port.quality].every(item => typeof item === "string" && quality.includes(item))
    && typeof value.screen.technology === "string" && ["", "incell", "tft", "oled"].includes(value.screen.technology)
    && typeof value.battery.appleService === "string" && ["", "capacity", "diagnostics", "both"].includes(value.battery.appleService)
    && (value.screen.quality === "assembled" || value.screen.technology === "");
}
export function validLocalIntake(value: unknown): value is IntakeReceiptData {
  if (!isObject(value) || typeof value.id !== "string" || !localIntakeId(value.id)) return false;
  if(value.revision !== undefined && (!Number.isSafeInteger(value.revision) || Number(value.revision)<1)) return false;
  if(value.policy !== undefined && !validIntakePolicy(value.policy)) return false;
  if(value.faults !== undefined && (!Array.isArray(value.faults) || value.faults.length>60 || !value.faults.every(item=>typeof item==="string" && item.length<=100))) return false;
  if(value.faults!==undefined && value.issueNote!==undefined && value.issue!==[value.faults.join("、"),String(value.issueNote).trim()].filter(Boolean).join("；")) return false;
  if(value.issueNote !== undefined && (typeof value.issueNote!=="string" || value.issueNote.length>2000)) return false;
  if(value.photos !== undefined && (!validIntakePhotos(value.photos) || value.photoCount !== value.photos.length)) return false;
  const limits = { customerName: 80, phone: 40, email: 160, category: 60, brand: 100, model: 160, color: 60, serial: 150, issue: 3000, previewAt: 30 };
  for (const [key, max] of Object.entries(limits)) if (typeof value[key] !== "string" || value[key].length > max) return false;
  if(value.retailOrigin !== undefined && (!isObject(value.retailOrigin) || ![value.retailOrigin.unitId,value.retailOrigin.saleId,value.retailOrigin.caseId].every(item=>typeof item === "string" && item.length > 0 && item.length <= 150))) return false;
  if(value.custody !== undefined && !["store", "customer"].includes(String(value.custody))) return false;
  return Boolean(String(value.phone).trim() && String(value.brand).trim() && String(value.model).trim() && String(value.issue).trim())
    && [value.createdAt, value.updatedAt].every(time => typeof time === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time))
    && ["普通", "优先", "紧急"].includes(String(value.priority))
    && Number.isInteger(value.photoCount) && Number(value.photoCount) >= 0 && Number(value.photoCount) <= 6
    && Array.isArray(value.accessories) && value.accessories.length <= 12 && value.accessories.every(item => typeof item === "string" && item.length <= 160)
    && validServices(value.services);
}
export function parseLocalIntakes(raw: string | null): IntakeReceiptData[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.records) || parsed.records.length > 100 || !parsed.records.every(validLocalIntake)) throw new Error("本地工单记录格式异常，现有记录未被覆盖。");
  if (new Set(parsed.records.map(item => item.id)).size !== parsed.records.length) throw new Error("本地工单编号重复，现有记录未被覆盖。");
  const origins=parsed.records.filter(item=>item.retailOrigin).map(item=>JSON.stringify([item.retailOrigin!.unitId,item.retailOrigin!.saleId,item.retailOrigin!.caseId]));
  if(new Set(origins).size!==origins.length) throw new Error("同一售后申请不能关联重复工单。");
  parseIntakeSignatures(raw);
  return parsed.records;
}

export function validIntakePolicy(value:unknown):value is IntakePolicy {
  return isObject(value) && Number.isSafeInteger(value.months) && Number(value.months)>=1 && Number(value.months)<=120 && [value.shopName,value.address,value.phone].every(item=>typeof item === "string" && item.length<=200) && Boolean(String(value.shopName).trim());
}
export function intakeSignatureSnapshot(data:IntakeReceiptData,policy:IntakePolicy):IntakeSignatureSnapshot {
  return structuredClone({customerName:data.customerName,phone:data.phone,email:data.email,category:data.category,brand:data.brand,model:data.model,color:data.color,serial:data.serial,issue:data.issue,accessories:data.accessories,services:data.services,priority:data.priority,...(data.faults!==undefined?{faults:data.faults}:{}),...(data.issueNote!==undefined?{issueNote:data.issueNote}:{}),policy});
}
export function validSignatureStrokes(value:unknown):value is SignatureStrokes {
  if(!Array.isArray(value) || !value.length || value.length>80) return false;
  let count=0; let travelled=0;
  for(const stroke of value) {
    if(!Array.isArray(stroke) || stroke.length<2 || stroke.length>1000) return false;
    count+=stroke.length; if(count>3000) return false;
    for(let index=0;index<stroke.length;index++) {
      const point=stroke[index];
      if(!isObject(point) || ![point.x,point.y].every(n=>typeof n==="number" && Number.isFinite(n) && n>=0 && n<=1)) return false;
      if(index) travelled+=Math.hypot(Number(point.x)-stroke[index-1].x,Number(point.y)-stroke[index-1].y);
    }
  }
  return travelled>=0.04;
}
export function validIntakeSignature(value:unknown):value is IntakeSignature {
  if(!isObject(value) || !isObject(value.snapshot) || !validIntakePolicy(value.snapshot.policy)) return false;
  if(value.aspectRatio!==undefined && (typeof value.aspectRatio!=="number" || !Number.isFinite(value.aspectRatio) || value.aspectRatio<0.5 || value.aspectRatio>10)) return false;
  if(![value.id,value.orderId,value.actorId].every(item=>typeof item==="string" && item.length>0 && item.length<=100) || typeof value.signedAt!=="string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.signedAt) || !["it","en","zh"].includes(String(value.language)) || value.termsVersion!=="repair-intake-2026-10-v1" || !validSignatureStrokes(value.strokes)) return false;
  return validLocalIntake({...value.snapshot,id:"LOCAL-0000000000000000",createdAt:value.signedAt,updatedAt:value.signedAt,previewAt:value.signedAt,photoCount:0});
}
export function parseIntakeSignatures(raw:string|null):IntakeSignature[] {
  if(raw===null) return [];
  const envelope:unknown=JSON.parse(raw);
  if(!isObject(envelope) || envelope.version!==1 || !Array.isArray(envelope.records)) throw new Error("本地接机资料格式异常。");
  if(envelope.signatures===undefined) return [];
  if(!Array.isArray(envelope.signatures) || envelope.signatures.length>2200 || !envelope.signatures.every(validIntakeSignature)) throw new Error("本地签名资料格式异常，历史未被覆盖。");
  const ids=new Set<string>(); const counts=new Map<string,number>();
  for(const signature of envelope.signatures) { if(ids.has(signature.id)) throw new Error("签名编号重复。"); ids.add(signature.id); const count=(counts.get(signature.orderId)??0)+1; if(count>20) throw new Error("每张工单最多保存20次签署。"); counts.set(signature.orderId,count); }
  return envelope.signatures;
}
export function matchingIntakeSignature(signatures:IntakeSignature[],data:IntakeReceiptData,policy:IntakePolicy) {
  const snapshot=JSON.stringify(intakeSignatureSnapshot(data,policy));
  return signatures.findLast(signature=>signature.orderId===data.id && JSON.stringify(signature.snapshot)===snapshot);
}
export function appendIntakeSignature(signatures:IntakeSignature[],data:IntakeReceiptData,policy:IntakePolicy,draft:IntakeSignatureDraft,actorId:string,expectedCount:number):IntakeSignature[] {
  const signature={...draft,orderId:data.id,actorId};
  if(!validIntakeSignature(signature) || JSON.stringify(draft.snapshot)!==JSON.stringify(intakeSignatureSnapshot(data,policy))) throw new Error("接机资料或条款已变化，请重新核对签署。");
  const repeated=signatures.find(item=>item.id===draft.id);
  if(repeated) { if(JSON.stringify(repeated)!==JSON.stringify(signature)) throw new Error("签署编号已用于其他内容。"); return signatures; }
  const count=signatures.filter(item=>item.orderId===data.id).length;
  if(count!==expectedCount) throw new Error("签名历史已变化，请重新打开并核对。");
  if(count>=20) throw new Error("本地预览每张工单最多保存20次签署。");
  return [...signatures,structuredClone(signature)];
}

export function fixtureIntakeReceipt(order:RepairOrder):IntakeReceiptData {
  return {id:order.id,createdAt:order.createdAt,updatedAt:order.updatedAt,previewAt:order.createdAt,customerName:order.customer.name,phone:order.customer.phone,email:"",...order.device,issue:order.issue,accessories:order.accessories,priority:order.priority,services:{screen:{quality:"",technology:""},battery:{quality:"",appleService:""},port:{quality:""}},photoCount:0};
}
