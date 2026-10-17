import type {RepairDirectoryEntry} from "./repair-intake-record";
import type {ProcurementRecord} from "./procurement";
import {repairPartsSummary} from "./procurement";
import {currentRepairRequirements} from "./repair-requirements";
import {initialRepairWorkflow,isRepairReady,isRepairHistory,repairPartsFollowup,pickupNotice,arrivalNotice,repairStageStatus,workflowGroup,repairProgress,type RepairWorkflow} from "./repair-workflow";
import {repairUpdatedAt,type RepairUpdates} from "./repair-list-order";
import type {RepairContactFacts,RepairListSummary} from "./backend/repair-list-contract";

export function repairContactFacts(order:RepairDirectoryEntry,records:ProcurementRecord[],saved?:RepairWorkflow):RepairContactFacts {
 const current=saved??initialRepairWorkflow(order);
 return{ready:isRepairReady(current)&&!isRepairHistory(order,current),partsFollowup:repairPartsFollowup(order,records,current),legacy:["awaiting_reply","collected_unpaid"].includes(current.status)&&!isRepairReady(current),pickupNotice:pickupNotice(current),arrivalNotice:arrivalNotice(current,records,order.id,order),awaitingReply:Boolean(current.followUp?.awaitingReply),collectedUnpaid:Boolean(current.followUp?.collectedUnpaid),handedOver:Boolean(current.handedOver),handoverUnpaid:Boolean(current.handedOver?.unpaid),quoteOutcome:current.quoteContact?.outcome??null,quoteTime:current.quoteContact?.time??null};
}
const preview=(value:string)=>{const chars=Array.from(value);return{value:chars.slice(0,160).join(""),truncated:chars.length>160};};
/** Preview/legacy adapter uses real canonical facts. A summary is never cast
 * back into an order, workflow or procurement ledger for an operation. */
export function repairListSummary(order:RepairDirectoryEntry,records:ProcurementRecord[],saved?:RepairWorkflow,updates:RepairUpdates={}):RepairListSummary {
 const current=saved??initialRepairWorkflow(order),requirements=currentRepairRequirements(order,current),rows=records.filter(row=>row.repairId===order.id),parts=repairPartsSummary(records,order.id,requirements);
 const chips=[...requirements.map(item=>{const request=preview(item.request);return{id:item.id,title:item.title,request:request.value,preview:request.truncated,preset:Boolean(item.sourceFingerprint&&(order.requirements??[]).filter(source=>source.id===item.id&&source.title===item.title&&source.request===item.request&&source.sourceFingerprint===item.sourceFingerprint).length===1),mode:item.mode};}),...rows.filter(part=>!requirements.some(item=>item.id===part.requirementId)).map(part=>{const request=preview(part.specification??"");return{id:`legacy:${part.id}`,title:part.item,request:request.value,preview:request.truncated,preset:false,mode:"parts" as const};})],suppliers=preview([...new Set(rows.map(row=>row.supplier))].join("、"));
 return{id:order.id,technician:order.technician,category:order.device.category,model:order.device.model,customerName:order.customer.name,customerNameMissing:Boolean(order.customerNameMissing),phone:order.customer.phone,priority:order.priority,rework:Boolean(order.repairOrigin),createdAt:order.createdAt,updatedAt:repairUpdatedAt(order,updates),stage:repairStageStatus(current),history:isRepairHistory(order,current),workflowGroup:workflowGroup(order,records,current),partsGroup:parts.group,progress:repairProgress(order,records,current),contact:repairContactFacts(order,records,current),chips:chips.slice(0,3),chipCount:chips.length,suppliers:suppliers.value,suppliersPreview:suppliers.truncated};
}
