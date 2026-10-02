import { appendProcurementEvent, procurementStatus, type ProcurementRecord } from "./procurement";
import type { SupplierProfile } from "./store-settings";

export type ProcurementBatchItem = { id: string; revision: number; quantity?: number };
export class ProcurementBatchError extends Error {
  constructor(message:string,public readonly status=400) {super(message);}
}

/** Historical names are usable only when they uniquely and exactly identify a supplier. */
export function resolveSupplierId(record:ProcurementRecord,suppliers:readonly SupplierProfile[]):string|undefined {
  const matches=record.supplierId===undefined
    ? suppliers.filter(supplier=>supplier.name.trim()===record.supplier.trim())
    : suppliers.filter(supplier=>supplier.id===record.supplierId);
  return matches.length===1?matches[0].id:undefined;
}

/** Pure all-or-nothing preparation. The caller commits the returned ledger atomically. */
export function applyProcurementBatch(
  records:readonly ProcurementRecord[],action:"ordered"|"arrival",supplierId:string,
  items:readonly ProcurementBatchItem[],suppliers:readonly SupplierProfile[],
  activity:{id:string;time:string;actorId?:string},
):ProcurementRecord[] {
  if(action!=="ordered" && action!=="arrival") throw new ProcurementBatchError("请选择批量下单或实际到货。");
  if(typeof supplierId!=="string" || !supplierId || supplierId.length>100) throw new ProcurementBatchError("请选择有效供应商。");
  if(!Array.isArray(items) || items.length<1 || items.length>100) throw new ProcurementBatchError("每批须选择1–100条采购。");
  if(typeof activity.id!=="string" || !activity.id || activity.id.length>100 || typeof activity.time!=="string" || !activity.time) throw new ProcurementBatchError("批次标识或操作时间无效。");
  const supplier=suppliers.find(row=>row.id===supplierId);
  if(!supplier || suppliers.filter(row=>row.id===supplierId).length!==1) throw new ProcurementBatchError("供应商无法唯一核对，请重新选择。",409);
  if(action==="ordered" && !supplier.active) throw new ProcurementBatchError("供应商已停用，请重新核对下单范围。",409);
  const indexed=new Map(records.map(record=>[record.id,record]));
  const updated=new Map<string,ProcurementRecord>();
  for(const [index,item] of items.entries()) {
    if(!item || typeof item!=="object" || Array.isArray(item) || Object.keys(item).some(key=>!["id","revision","quantity"].includes(key)) || typeof item.id!=="string" || !item.id || item.id.length>100 || !Number.isSafeInteger(item.revision) || item.revision<0) throw new ProcurementBatchError("请核对采购条目标识及版本。");
    if(updated.has(item.id)) throw new ProcurementBatchError("同一批次不能重复选择采购条目。");
    const record=indexed.get(item.id);
    if(!record) throw new ProcurementBatchError(`采购条目 ${item.id} 不存在或不属于此门店。`,404);
    if(record.events.length!==item.revision) throw new ProcurementBatchError(`采购条目 ${item.id} 已变化，请重新核对整批。`,409);
    if(resolveSupplierId(record,suppliers)!==supplierId) throw new ProcurementBatchError("同一批次只能操作所选供应商的条目。",409);
    if(action==="ordered") {
      if(item.quantity!==undefined) throw new ProcurementBatchError("下单须确认整条采购数量，不能提交部分下单数量。");
      if(procurementStatus(record)!=="cart") throw new ProcurementBatchError(`采购条目 ${item.id} 尚未加车或已经下单。`,409);
    } else if(!Number.isSafeInteger(item.quantity) || Number(item.quantity)<=0) throw new ProcurementBatchError("请逐条填写本批实际到货的正整数数量。");
    const next=appendProcurementEvent({...record,supplierId},{
      id:`${activity.id}:${index}`,type:action,quantity:action==="arrival"?Number(item.quantity):0,
      time:activity.time,note:action==="ordered"?"已核对本供应商所选条目实际下单。":"已核对本批实际到货数量。",
      ...(activity.actorId?{actorId:activity.actorId}:{}),batchId:activity.id,
    },item.revision);
    updated.set(item.id,next);
  }
  return records.map(record=>updated.get(record.id)??record);
}
