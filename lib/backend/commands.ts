import { createHash, randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { can, updateStaffMember, type Permission, type StaffMember } from "../staff";
import { parseStoreSettings, type StoreSettings } from "../store-settings";
import { normalizeCustomerPhone, updateCustomerProfile, type CustomerProfile } from "../customers";
import { appendIntakeSignature, intakeDirectoryEntry, intakeRecordTime, validLocalIntake, type IntakeReceiptData, type IntakeSignatureDraft, type IntakePolicy } from "../repair-intake-record";
import { initialRepairWorkflow, applyWorkflowCommand, assertRepairProcurementOpen, type WorkflowCommand } from "../repair-workflow";
import { buildRepairRework, repairOriginForSave, validateRepairReworkInput, RepairReworkError } from "../repair-rework";
import { currentRepairRequirements, validateRepairRequirements } from "../repair-requirements";
import { updateItemQuotes, validItemQuotes } from "../repair-item-pricing";
import { prepareRepairItemEdits, validateRepairItemsEdit, RepairItemEditError } from "../repair-item-editor";
import { appendProcurementEvent, isPreorder, procurementStatus, validateProcurementDraft, type ProcurementRecord, type ProcurementEvent } from "../procurement";
import { applyProcurementBatch, ProcurementBatchError, resolveSupplierId, type ProcurementBatchItem } from "../procurement-batch";
import { createRetailUnit, applyRetailCommand, currentRetailSale, saleProductUnit, retailCategories, type RetailUnit, type RetailCommand } from "../retail";
import { emptyIntakeServices } from "../intake-services";
import { projectState, loadState } from "./state";
import { memberInTransaction } from "./context";
import { retailCommandPermission, requireRetailAfterSaleRepair } from "../retail-access";
import { BackendError, withDatabase, type AuthIdentity } from "./database";
import type { BackendCommand, BackendSnapshot } from "./contracts";
import { parseIntakePhotoAttachments, putIntakePhotos } from "./intake-photos";
import { fields, intakeFields, procurementFields, workflowCommandFields, customerFields, settingsFields, memberFields, retailFields, commandFields } from "./input";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function authorize(member: StaffMember, permission: Permission) { if (!can(member,permission)) throw new BackendError("当前账号没有此操作权限。",403); }
function mayEditProcurementCost(member:StaffMember) { return can(member,"financial.read") && can(member,"financial.edit"); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new BackendError("请求资料无效。"); return value as Record<string,unknown>; }
function integer(value: unknown) { if (!Number.isSafeInteger(value) || Number(value)<0) throw new BackendError("请核对记录版本。"); return Number(value); }
function identifier(value: unknown) { if (typeof value!=="string" || !value || value.length>100) throw new BackendError("记录标识无效。");return value; }
function policy(settings:StoreSettings):IntakePolicy { return {months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone}; }
function exactKeys(value:Record<string,unknown>, allowed:string[]) {if(Object.keys(value).some(key=>!allowed.includes(key))) throw new BackendError("请求包含不支持的字段。");}

function procurementSupplier(state:BackendSnapshot,record:ProcurementRecord,required=false,active=false) {
  const supplierId=resolveSupplierId(record,state.settings.suppliers);
  const supplier=state.settings.suppliers.find(row=>row.id===supplierId);
  if(!supplier) {
    if(required || record.supplierId!==undefined) throw new BackendError("供应商无法唯一核对，请重新选择门店供应商。",409);
    return undefined;
  }
  if(active && !supplier.active) throw new BackendError("供应商已停用，请重新核对下单范围。",409);
  return supplier;
}
function checkRequirement(state:BackendSnapshot,record:ProcurementRecord) {
  const intake=state.intakes.find(row=>row.id===record.repairId);
  if(!intake) throw new BackendError("关联工单不存在。",404);
  if(record.requirementId!==undefined || record.requirementRevision!==undefined) {
    const requirements=currentRepairRequirements(intakeDirectoryEntry(intake),state.workflows[intake.id]);
    const item=requirements.find(item=>item.id===record.requirementId);
    if(!item || item.mode!=="parts" || item.revision!==record.requirementRevision) throw new BackendError("维修项目或接单要求已变化，请重新核对关联。",409);
  }
  return intake;
}
function requireOpenProcurement(state:BackendSnapshot,repairId:string) {
  const intake=state.intakes.find(row=>row.id===repairId);
  if(!intake) throw new BackendError("关联工单不存在。",404);
  const order=intakeDirectoryEntry(intake);
  try {assertRepairProcurementOpen(order,state.workflows[repairId]);}
  catch(reason) {if(reason instanceof Error) throw new BackendError(reason.message,409);throw reason;}
}

async function putCustomer(tx:TransactionSql,storeId:string, data:CustomerProfile) {
  const [row] = await tx`insert into chinatech_v2_private.customers(store_id,normalized_phone,data) values(${storeId},${normalizeCustomerPhone(data.phone)},${tx.json(data)}) on conflict(store_id,normalized_phone) do update set data=excluded.data returning id`;
  return row.id as string;
}
async function putIntake(tx:TransactionSql,state:BackendSnapshot, data:IntakeReceiptData, signatures=state.signatures.filter(row=>row.orderId===data.id)) {
  const previous=state.intakes.find(row=>row.id===data.id);
  let customerId:string; let deviceId:string;
  if(previous) {
    const [relation]=await tx`select customer_id,device_id from chinatech_v2_private.repair_intakes where store_id=${state.storeId} and id=${data.id}`;
    customerId=relation.customer_id;deviceId=relation.device_id;
    // A changed customer identity is an explicit relation change; old snapshots remain in audit/signatures.
    if(normalizeCustomerPhone(previous.phone)!==normalizeCustomerPhone(data.phone)) {
      customerId=await ensureCustomer(tx,state,data);
      const [device]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data) values(${state.storeId},${customerId},${tx.json(deviceFacts(data))}) returning id`;deviceId=device.id;
    } else if(JSON.stringify(deviceFacts(previous))!==JSON.stringify(deviceFacts(data))) {
      const [device]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data) values(${state.storeId},${customerId},${tx.json(deviceFacts(data))}) returning id`;deviceId=device.id;
    }
  } else if(data.repairOrigin) {
    // This is an explicit link to a verified work order, so reuse its physical-device relation.
    const [relation]=await tx`select customer_id,device_id from chinatech_v2_private.repair_intakes where store_id=${state.storeId} and id=${data.repairOrigin.repairId}`;
    if(!relation) throw new BackendError("原工单的客户或设备关联不可用。",409);
    customerId=relation.customer_id;deviceId=relation.device_id;
  } else {
    customerId=await ensureCustomer(tx,state,data);
    // Same model never merges physical devices. Only an explicit verified identity can be reused later.
    const [device]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data) values(${state.storeId},${customerId},${tx.json(deviceFacts(data))}) returning id`;deviceId=device.id;
  }
  await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures) values(${state.storeId},${data.id},${customerId},${deviceId},${tx.json(data)},${tx.json(signatures)}) on conflict(store_id,id) do update set data=excluded.data,customer_id=excluded.customer_id,device_id=excluded.device_id,signatures=excluded.signatures`;
}
function deviceFacts(data:IntakeReceiptData) {return {category:data.category,brand:data.brand,model:data.model,color:data.color,serial:data.serial};}
async function ensureCustomer(tx:TransactionSql,state:BackendSnapshot,data:IntakeReceiptData) {
  const phone=normalizeCustomerPhone(data.phone);
  const [existing]=await tx`select id from chinatech_v2_private.customers where store_id=${state.storeId} and normalized_phone=${phone}`;
  if(existing) return existing.id as string;
  return putCustomer(tx,state.storeId,{phone,name:data.customerName,email:data.email,note:"",version:1,updatedAt:intakeRecordTime()});
}
async function putRetail(tx:TransactionSql,storeId:string,unit:RetailUnit) {await tx`insert into chinatech_v2_private.retail_units(store_id,id,data) values(${storeId},${unit.id},${tx.json(unit)}) on conflict(store_id,id) do update set data=excluded.data`;}

async function putProcurementRecords(tx:TransactionSql,storeId:string,records:ProcurementRecord[],time:string) {
  // All records have already been checked against the transaction's current state.
  // One statement retains each work order's allocation without merging identities.
  const rows=records.map(record=>({id:record.id,repair_id:record.repairId,data:record}));
  await tx`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data)
    select ${storeId},batch_row.id,batch_row.repair_id,batch_row.data
    from jsonb_to_recordset(${tx.json(rows)}::jsonb) as batch_row(id text,repair_id text,data jsonb)
    on conflict(store_id,id) do update set data=excluded.data`;
  const repairIds=[...new Set(records.map(record=>record.repairId))];
  await tx`update chinatech_v2_private.repair_intakes set data=jsonb_set(data,'{updatedAt}',${tx.json(time)}::jsonb)
    where store_id=${storeId} and id in ${tx(repairIds)}`;
}

async function saveRepairItem(tx:TransactionSql,state:BackendSnapshot,member:StaffMember,p:Record<string,unknown>,requestId:string,time:string) {
  exactKeys(p,["type","record","revision","workflowRevision","intakeRevision","quoteCents","noProcurement"]);
  const submitted=p.record as ProcurementRecord;fields(submitted,procurementFields);identifier(submitted.id);identifier(submitted.repairId);
  if(p.noProcurement!==undefined && typeof p.noProcurement!=="boolean") throw new BackendError("采购选择无效。");
  const noProcurement=p.noProcurement===true;
  if(!Array.isArray(submitted.events) || submitted.events.length) throw new BackendError("配件编辑不能提供历史事件。");
  if(typeof submitted.item!=="string" || !submitted.item.trim() || submitted.item.trim().length>100) throw new BackendError("维修项目名称须为1–100字。");
  if(!validItemQuotes([{item:submitted.item.trim(),amountCents:p.quoteCents}])) throw new BackendError("客户报价须为有效的非负金额，未知时留空。");
  if(!mayEditProcurementCost(member) && submitted.unitCostCents!==null) throw new BackendError("当前账号不能编辑采购成本。",403);
  const previous=state.procurement.find(row=>row.id===submitted.id);
  if((previous?.events.length??0)!==integer(p.revision)) throw new BackendError("采购记录已变化，请重新核对。",409);
  if(previous && (!isPreorder(previous) || previous.repairId!==submitted.repairId)) throw new BackendError("已下单配件不能改写，也不能更换关联工单。",409);
  const intake=state.intakes.find(row=>row.id===submitted.repairId);if(!intake) throw new BackendError("关联工单不存在。",404);
  const order=intakeDirectoryEntry(intake),workflow=state.workflows[intake.id]??initialRepairWorkflow(order);
  if((intake.revision??1)!==integer(p.intakeRevision) || workflow.revision!==integer(p.workflowRevision)) throw new BackendError("工单、报价或维修项目已变化，请重新核对。",409);
  // This endpoint also writes project scope when no purchase is needed; quote-only edits use save-items.
  requireOpenProcurement(state,intake.id);
  if(workflow.events.length>=1000 || workflow.events.some(event=>event.id===requestId) || time<workflow.updatedAt) throw new BackendError("维修历史重复、已达上限或时间无效。");
  const draft={...submitted,item:submitted.item.trim(),
    required:submitted.required===undefined?previous?.required:submitted.required,
    specification:submitted.specification===undefined?previous?.specification:submitted.specification,
    requirementId:submitted.requirementId===undefined?previous?.requirementId:submitted.requirementId,
    requirementRevision:submitted.requirementRevision===undefined?previous?.requirementRevision:submitted.requirementRevision};
  if(draft.required!==undefined && typeof draft.required!=="boolean") throw new BackendError("配件用途无效。");
  if(previous && draft.requirementId!==previous.requirementId) throw new BackendError("已有配件不能通过编辑更换维修项目关联。",409);
  const requirements=currentRepairRequirements(order,workflow);
  let requirement=draft.requirementId?requirements.find(row=>row.id===draft.requirementId):undefined;
  if(draft.requirementId && (!requirement || requirement.revision!==draft.requirementRevision)) throw new BackendError("维修项目要求已变化，请重新核对。",409);
  if(!draft.requirementId && !previous) {
    const id=identifier(`project:${draft.id}`);
    if(requirements.some(row=>row.id===id)) throw new BackendError("维修项目已存在，请刷新后核对。",409);
    requirement={id,title:draft.item,request:draft.specification??"",revision:1,mode:"pending",confirmed:false,deviceFingerprint:order.deviceFingerprint};
    draft.requirementId=id;draft.requirementRevision=1;
  }
  if(noProcurement) {
    if(submitted.unitCostCents!==null || submitted.supplier!=="" || (submitted.supplierId!==undefined && submitted.supplierId!=="")) throw new BackendError("无需采购项目不能填写供应商或进价。");
    if(!requirement || state.procurement.some(row=>row.repairId===intake.id && row.requirementId===requirement.id && row.required!==false)) throw new BackendError("已有必需配件或旧配件未关联，不能标为无需采购。",409);
    validateProcurementDraft({...draft,supplier:"无需采购",supplierId:undefined,unitCostCents:null});
  } else {
    validateProcurementDraft(draft);
    if(!draft.supplierId) throw new BackendError("请选择已登记的门店供应商。");
    const supplier=procurementSupplier(state,draft,true,true)!;draft.supplierId=supplier.id;draft.supplier=supplier.name;
    if(!mayEditProcurementCost(member) && previous) draft.unitCostCents=previous.unitCostCents;
    if(requirement && state.procurement.some(row=>row.id!==draft.id && row.repairId===intake.id && row.requirementId===requirement.id && row.required!==false && row.requirementRevision!==requirement.revision)) throw new BackendError("本项目其他必需配件仍需核对新的要求版本。",409);
  }
  const item=requirement?.title??draft.item;
  const quoteMap=new Map((intake.itemQuotes??[]).map(row=>[row.item,row.amountCents]));
  for(const row of requirements) if(!quoteMap.has(row.title)) quoteMap.set(row.title,null);
  quoteMap.set(item,p.quoteCents as number|null);
  const quotes=[...quoteMap].map(([item,amountCents])=>({item,amountCents}));
  const pricing=updateItemQuotes(intake.itemQuotes,quotes,intake.itemQuoteHistory,{id:requestId,time,actorId:member.id});
  const nextRequirements=requirement?[...requirements.filter(row=>row.id!==requirement.id),{...requirement,sourceFingerprint:order.requirements?.find(row=>row.id===requirement.id)?.sourceFingerprint,deviceFingerprint:order.deviceFingerprint,mode:noProcurement?"none" as const:"parts" as const,confirmed:true}]:requirements;
  validateRepairRequirements(nextRequirements);
  const nextWorkflow={...workflow,requirements:nextRequirements,revision:workflow.revision+1,updatedAt:time,events:[...workflow.events,{id:requestId,time,actorId:member.id,type:"requirement" as const,label:`${item}：${noProcurement?"无需采购":"项目配件已保存"}`,note:noProcurement?"已明确核对本项目无需采购。":"已核对供应商及项目配件。"}]};
  // Only the intake's quote ledger contains customer amounts; shared procurement/workflow history never contains cost.
  const nextIntake={...intake,...pricing,revision:(intake.revision??1)+1,updatedAt:time};
  if(!validLocalIntake(nextIntake)) throw new BackendError("接机报价资料无效。");
  let next:ProcurementRecord|undefined;
  if(!noProcurement) {
    let history=previous??{...draft,events:[],reference:""};
    if(previous) history=appendProcurementEvent(history,{id:procurementStatus(previous)==="cart"?requestId:randomUUID(),type:"details_changed",quantity:0,time,note:"项目配件资料已核对。",actorId:member.id});
    next={...draft,reference:previous?.reference??"",events:history.events};
    if(procurementStatus(next)!=="cart") next=appendProcurementEvent(next,{id:requestId,type:"cart_added",quantity:0,time,note:"核对配件后加入采购车。",actorId:member.id});
  }
  // All validation precedes writes; the outer transaction also owns versions, audit and idempotent receipt.
  if(next) await putProcurementRecords(tx,state.storeId,[next],time);
  await putIntake(tx,state,nextIntake);
  await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(nextWorkflow)} where store_id=${state.storeId} and id=${intake.id}`;
  return next?.id??intake.id;
}

async function saveRepairItems(tx:TransactionSql,state:BackendSnapshot,member:StaffMember,p:Record<string,unknown>,requestId:string,time:string) {
  exactKeys(p,["type","repairId","intakeRevision","workflowRevision","items"]);
  const {type:_type,...input}=p;void _type;
  try {
    validateRepairItemsEdit(input);
    const intake=state.intakes.find(row=>row.id===input.repairId);if(!intake) throw new BackendError("关联工单不存在。",404);
    if(input.items.some(item=>item.purchase!==undefined)) requireOpenProcurement(state,intake.id);
    const next=prepareRepairItemEdits(input,{intake,workflow:state.workflows[intake.id]??initialRepairWorkflow(intakeDirectoryEntry(intake)),records:state.procurement,suppliers:state.settings.suppliers,canEditCost:mayEditProcurementCost(member),activity:{id:requestId,time,actorId:member.id}});
    // Prepare every row, quote and requirement first. The existing command transaction
    // owns one receipt and audit entry and rolls back all statements on any failure.
    if(next.changedRecords.length) await putProcurementRecords(tx,state.storeId,next.changedRecords,time);
    await putIntake(tx,state,next.intake);
    if(next.workflow) await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(next.workflow)} where store_id=${state.storeId} and id=${intake.id}`;
    return intake.id;
  } catch(reason) {
    if(reason instanceof RepairItemEditError) throw new BackendError(reason.message,reason.status);
    throw reason;
  }
}

async function apply(tx:TransactionSql,state:BackendSnapshot,member:StaffMember,kind:string,p:Record<string,unknown>,requestId:string) {
  const time=intakeRecordTime();
  if(kind==="intake.save") {
    exactKeys(p,["data","revision","signature","signatureCount","photos"]);authorize(member,"repairs.edit");
    const draft=p.data as IntakeReceiptData;fields(draft,intakeFields); if(!validLocalIntake(draft) || draft.retailOrigin) throw new BackendError("请核对接机资料及来源。");
    const existing=state.intakes.find(row=>row.id===draft.id);const revision=integer(p.revision);
    if((existing?.revision??0)!==revision) throw new BackendError("接机资料已变化，请重新核对。",409);
    if(existing?.retailOrigin) throw new BackendError("售后接机快照不能改写。");
    let repairOrigin;
    try {repairOrigin=repairOriginForSave(draft,existing);} catch(reason) {if(reason instanceof RepairReworkError) throw new BackendError(reason.message,reason.status);throw reason;}
    const photos=await parseIntakePhotoAttachments(p.photos,draft.photoCount);
    if(photos.length) authorize(member,"repairs.view");
    const frozen=existing?.policy??policy(state.settings);
    if(draft.policy && JSON.stringify(draft.policy)!==JSON.stringify(frozen)) throw new BackendError("门店保修已变化，请重新核对。",409);
    if(draft.itemQuoteHistory!==undefined && JSON.stringify(draft.itemQuoteHistory)!==JSON.stringify(existing?.itemQuoteHistory??[])) throw new BackendError("报价历史只能由后台追加，不能改写。");
    const pricing=updateItemQuotes(existing?.itemQuotes,draft.itemQuotes??existing?.itemQuotes??[],existing?.itemQuoteHistory,{id:requestId,time,actorId:member.id});
    const data={...draft,...pricing,repairOrigin,createdAt:existing?.createdAt??time,updatedAt:time,previewAt:time,policy:frozen,revision:revision+1,photos:photos.map(({id,slot})=>({id,slot})),photoCount:photos.length};
    if(p.signature && state.signatures.filter(row=>row.orderId===data.id).length!==integer(p.signatureCount)) throw new BackendError("签署历史已变化，请重新核对。",409);
    const signatures=p.signature?appendIntakeSignature(state.signatures,data,frozen,{...p.signature as IntakeSignatureDraft,signedAt:time},member.id,integer(p.signatureCount)):state.signatures;
    await putIntake(tx,state,data,signatures.filter(row=>row.orderId===data.id));await putIntakePhotos(tx,state.storeId,data.id,photos);return data.id;
  }
  if(kind==="repair.rework") {
    authorize(member,"repairs.edit");
    try {
      validateRepairReworkInput(p);
      const source=state.intakes.find(row=>row.id===p.sourceId);
      if(!source) throw new RepairReworkError("原工单不存在或不属于当前门店。",404);
      if(state.intakes.some(row=>row.id===p.repairId)) throw new RepairReworkError("返修编号已被使用，请核对原提交结果。",409);
      const current=state.workflows[source.id]??initialRepairWorkflow(intakeDirectoryEntry(source));
      const data=buildRepairRework(p,source,current,policy(state.settings),time);
      await putIntake(tx,state,data,[]);return data.id;
    } catch(reason) {if(reason instanceof RepairReworkError) throw new BackendError(reason.message,reason.status);throw reason;}
  }
  if(kind==="intake.signature") {
    exactKeys(p,["id","revision","policy","signature","count"]);authorize(member,"repairs.edit");
    const data=state.intakes.find(row=>row.id===identifier(p.id));if(!data) throw new BackendError("工单不存在。",404);
    if((data.revision??1)!==integer(p.revision)) throw new BackendError("工单已变化，请重新核对。",409);
    const frozen=data.policy??policy(state.settings);if(JSON.stringify(p.policy)!==JSON.stringify(frozen)) throw new BackendError("门店保修已变化。",409);
    if(state.signatures.filter(row=>row.orderId===data.id).length!==integer(p.count)) throw new BackendError("签署历史已变化，请重新核对。",409);
    const signatures=appendIntakeSignature(state.signatures,data,frozen,{...p.signature as IntakeSignatureDraft,signedAt:time},member.id,integer(p.count));
    await putIntake(tx,state,data,signatures.filter(row=>row.orderId===data.id));return data.id;
  }
  if(kind==="repair.quote") {
    exactKeys(p,["id","item","quoteCents","intakeRevision"]);authorize(member,"repairs.edit");
    const intake=state.intakes.find(row=>row.id===identifier(p.id));if(!intake) throw new BackendError("工单不存在。",404);
    if((intake.revision??1)!==integer(p.intakeRevision)) throw new BackendError("工单报价已变化，请重新核对。",409);
    if(!validItemQuotes([{item:p.item,amountCents:p.quoteCents}])) throw new BackendError("维修项目或客户报价无效。");
    const requirements=currentRepairRequirements(intakeDirectoryEntry(intake),state.workflows[intake.id]);
    const titles=new Set([...requirements.map(row=>row.title),...(intake.itemQuotes??[]).map(row=>row.item),...state.procurement.filter(row=>row.repairId===intake.id).map(row=>row.item)]);
    if(!titles.has(p.item as string)) throw new BackendError("维修项目已变化，请重新核对报价。",409);
    const quotes=new Map((intake.itemQuotes??[]).map(row=>[row.item,row.amountCents]));
    for(const requirement of requirements) if(!quotes.has(requirement.title)) quotes.set(requirement.title,null);
    quotes.set(p.item as string,p.quoteCents as number|null);
    const pricing=updateItemQuotes(intake.itemQuotes,[...quotes].map(([item,amountCents])=>({item,amountCents})),intake.itemQuoteHistory,{id:requestId,time,actorId:member.id});
    const next={...intake,...pricing,revision:(intake.revision??1)+1,updatedAt:time};
    if(!validLocalIntake(next)) throw new BackendError("接机报价资料无效。");
    await putIntake(tx,state,next);return intake.id;
  }
  if(kind==="repair.workflow") {
    exactKeys(p,["id","command","revision"]);authorize(member,"repairs.edit");
    const data=state.intakes.find(row=>row.id===identifier(p.id));if(!data) throw new BackendError("工单不存在。",404);
    const current=state.workflows[data.id]??initialRepairWorkflow(intakeDirectoryEntry(data));
    if(current.revision!==integer(p.revision)) throw new BackendError("维修流程已变化，请重新核对。",409);
    const command=object(p.command);
    if(typeof command.type!=="string" || !Object.hasOwn(workflowCommandFields,command.type)) throw new BackendError("不支持的维修操作。");
    fields(command,["type",...workflowCommandFields[command.type]]);
    const next=applyWorkflowCommand(current,p.command as WorkflowCommand,{id:requestId,time,actorId:member.id},state.procurement,data.id,integer(p.revision),intakeDirectoryEntry(data));
    await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(next)} where store_id=${state.storeId} and id=${data.id}`;return data.id;
  }
  if(kind==="procurement") {
    exactKeys(p,["type","record","id","event","revision","workflowRevision","intakeRevision","requirementId","requirementRevision","note","quoteCents","noProcurement","repairId","items"]);authorize(member,"repairs.edit");
    if(p.type==="save-items") return saveRepairItems(tx,state,member,p,requestId,time);
    if(p.type==="save-item") return saveRepairItem(tx,state,member,p,requestId,time);
    let next:ProcurementRecord;
    if(p.type==="create" || p.type==="create-cart") {
      const draft=p.record as ProcurementRecord;fields(draft,procurementFields);identifier(draft.id);validateProcurementDraft(draft);
      if(draft.events.length || state.procurement.some(row=>row.id===draft.id)) throw new BackendError("采购编号已存在或包含历史事件。",409);
      if(draft.unitCostCents!==null) {authorize(member,"financial.read");authorize(member,"financial.edit");}
      const intake=checkRequirement(state,draft);
      requireOpenProcurement(state,intake.id);
      if(p.type==="create-cart") {
        if((intake.revision??1)!==integer(p.intakeRevision) || (state.workflows[intake.id]?.revision??0)!==integer(p.workflowRevision)) throw new BackendError("工单或维修项目已变化，请重新核对选件。",409);
        if(typeof draft.supplierId!=="string" || !draft.supplierId) throw new BackendError("请选择已登记的门店供应商。");
      }
      const supplier=procurementSupplier(state,draft,p.type==="create-cart",true);
      next={...draft,...(supplier?{supplierId:supplier.id,supplier:supplier.name}:{}),events:[],reference:""};
      if(p.type==="create-cart") next=appendProcurementEvent(next,{id:requestId,type:"cart_added",quantity:0,time,note:"核对配件后加入采购车。",actorId:member.id});
    } else {
      const id=p.type==="edit"?(p.record as ProcurementRecord)?.id:identifier(p.id);const record=state.procurement.find(row=>row.id===id);
      if(!record) throw new BackendError("采购记录不存在。",404);
      if(record.events.length!==integer(p.revision)) throw new BackendError("采购记录已变化，请重新核对。",409);
      if(p.type==="edit") {
        requireOpenProcurement(state,record.repairId);
        if(!isPreorder(record)) throw new BackendError("已下单配件不能改写。");
        const submitted=p.record as ProcurementRecord;fields(submitted,procurementFields);
        const draft={...submitted,
          supplierId:submitted.supplierId===undefined?record.supplierId:submitted.supplierId,
          requirementId:submitted.requirementId===undefined?record.requirementId:submitted.requirementId,
          requirementRevision:submitted.requirementRevision===undefined?record.requirementRevision:submitted.requirementRevision,
          specification:submitted.specification===undefined?record.specification:submitted.specification,
          required:submitted.required===undefined?record.required:submitted.required};
        validateProcurementDraft({...draft,events:[]});
        if(draft.repairId!==record.repairId) throw new BackendError("不能更换关联工单。");
        if(draft.requirementId!==record.requirementId || draft.requirementRevision!==record.requirementRevision) throw new BackendError("请通过重新核对项目关联更新需求引用。",409);
        if(submitted.supplierId===undefined && record.supplierId!==undefined && draft.supplier!==record.supplier) throw new BackendError("供应商已使用稳定标识，请重新选择供应商。",409);
        const supplier=procurementSupplier(state,draft,false,draft.supplierId!==record.supplierId || draft.supplier!==record.supplier);
        if(supplier && (draft.supplierId!==record.supplierId || draft.supplier!==record.supplier)) {draft.supplierId=supplier.id;draft.supplier=supplier.name;}
        if(!mayEditProcurementCost(member)){if(draft.unitCostCents!==null && draft.unitCostCents!==undefined) throw new BackendError("当前账号不能编辑采购成本。",403);draft.unitCostCents=record.unitCostCents;}
        let history=record;if(procurementStatus(record)==="cart") history=appendProcurementEvent(history,{id:randomUUID(),type:"cart_removed",quantity:0,time,note:"配件资料更正，取消原加车标记。",actorId:member.id});
        history=appendProcurementEvent(history,{id:requestId,type:"details_changed",quantity:0,time,note:"配件资料已更正。",actorId:member.id});next={...draft,reference:record.reference,events:history.events};
      } else if(p.type==="link_requirement") {
        const requirementId=identifier(p.requirementId);const requirementRevision=integer(p.requirementRevision);
        if(typeof p.note!=="string" || !p.note.trim() || p.note.length>500) throw new BackendError("重新核对项目关联须填写原因，最多500字。");
        if(record.requirementId===requirementId && record.requirementRevision===requirementRevision) throw new BackendError("项目关联没有变化。");
        const linked={...record,requirementId,requirementRevision};checkRequirement(state,linked);
        const note=`${record.requirementId??"未关联"}@${record.requirementRevision??"未知"} → ${requirementId}@${requirementRevision}；${p.note.trim()}`;
        next=appendProcurementEvent(linked,{id:requestId,type:"requirement_linked",quantity:0,time,note,actorId:member.id},record.events.length);
      } else if(p.type==="append") {
        const event=p.event as ProcurementEvent;fields(event,["type","id","time","note","quantity","arrivalId","reference"]);
        if(event.type==="requirement_linked" || event.type==="details_changed") throw new BackendError("请通过对应资料核对操作追加历史。");
        if(event.type==="ordered" || event.type==="cart_added") {checkRequirement(state,record);requireOpenProcurement(state,record.repairId);procurementSupplier(state,record,false,true);}
        next=appendProcurementEvent(record,{...event,time,id:requestId,actorId:member.id},record.events.length);
      }
      else throw new BackendError("未知采购操作。");
    }
    const repair=state.intakes.find(row=>row.id===next.repairId);if(!repair) throw new BackendError("关联工单不存在。",404);
    await putProcurementRecords(tx,state.storeId,[next],time);return next.id;
  }
  if(kind==="procurement.reconfirm") {
    exactKeys(p,["repairId","requirementId","intakeRevision","workflowRevision","items"]);authorize(member,"repairs.edit");
    const repairId=identifier(p.repairId),requirementId=identifier(p.requirementId);
    const intake=state.intakes.find(row=>row.id===repairId);if(!intake) throw new BackendError("工单不存在。",404);
    const order=intakeDirectoryEntry(intake),workflow=state.workflows[repairId]??initialRepairWorkflow(order);
    if((intake.revision??1)!==integer(p.intakeRevision) || workflow.revision!==integer(p.workflowRevision)) throw new BackendError("工单或项目要求已变化，请重新核对。",409);
    if(!Array.isArray(p.items) || p.items.length<1 || p.items.length>100) throw new BackendError("须核对本项目的1–100条配件记录。");
    const versions=new Map<string,number>();
    for(const value of p.items) {
      const item=object(value);exactKeys(item,["id","revision"]);const id=identifier(item.id);
      if(versions.has(id)) throw new BackendError("核对范围包含重复配件。");
      versions.set(id,integer(item.revision));
    }
    const requirements=currentRepairRequirements(order,workflow),requirement=requirements.find(row=>row.id===requirementId);
    if(!requirement) throw new BackendError("维修项目已变化，请重新核对。",409);
    const records=state.procurement.filter(row=>row.repairId===repairId && row.requirementId===requirementId);
    if(records.length!==versions.size || records.some(row=>!versions.has(row.id))) throw new BackendError("必须完整核对本项目的全部必需及备选配件。",409);
    if(workflow.events.length>=1000 || workflow.events.some(event=>event.id===requestId) || time<workflow.updatedAt) throw new BackendError("维修历史重复、已达上限或时间无效。");
    const changed:ProcurementRecord[]=[];
    for(const record of records) {
      if(record.events.length!==versions.get(record.id)) throw new BackendError("采购记录已变化，请重新核对。",409);
      if(record.events.length>=1000) throw new BackendError("配件历史已达上限，请联系管理员核对。");
      if(record.requirementRevision!==requirement.revision) changed.push(appendProcurementEvent({...record,requirementRevision:requirement.revision},{id:requestId,time,actorId:member.id,type:"requirement_linked",quantity:0,note:`已逐条核对配件符合当前项目要求：${requirementId}@${requirement.revision}。`}));
    }
    const nextRequirements=requirements.map(row=>row.id===requirementId?{...row,sourceFingerprint:order.requirements?.find(source=>source.id===row.id)?.sourceFingerprint,deviceFingerprint:order.deviceFingerprint,mode:"parts" as const,confirmed:true}:row);validateRepairRequirements(nextRequirements);
    const nextWorkflow={...workflow,requirements:nextRequirements,revision:workflow.revision+1,updatedAt:time,events:[...workflow.events,{id:requestId,time,actorId:member.id,type:"requirement" as const,label:`${requirement.title}：配件已重新核对`,note:`已核对全部${records.length}条配件符合当前要求。`}]};
    if(changed.length) await putProcurementRecords(tx,state.storeId,changed,time);
    await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(nextWorkflow)},data=jsonb_set(data,'{updatedAt}',${tx.json(time)}::jsonb) where store_id=${state.storeId} and id=${repairId}`;
    return repairId;
  }
  if(kind==="procurement.batch") {
    exactKeys(p,["action","supplierId","items"]);authorize(member,"repairs.edit");
    if(p.action!=="ordered" && p.action!=="arrival") throw new BackendError("请选择批量下单或实际到货。");
    const supplierId=identifier(p.supplierId);
    if(!Array.isArray(p.items) || p.items.length<1 || p.items.length>100) throw new BackendError("每批须选择1–100条采购。");
    let ledger:ProcurementRecord[];
    try {ledger=applyProcurementBatch(state.procurement,p.action,supplierId,p.items as ProcurementBatchItem[],state.settings.suppliers,{id:requestId,time,actorId:member.id});}
    catch(error) {if(error instanceof ProcurementBatchError) throw new BackendError(error.message,error.status);throw error;}
    const selected=new Set((p.items as ProcurementBatchItem[]).map(item=>item.id));
    const updated=ledger.filter(record=>selected.has(record.id));
    const intakes=new Set(state.intakes.map(intake=>intake.id));
    for(const record of updated) {
      if(!intakes.has(record.repairId)) throw new BackendError("关联工单不存在。",404);
      if(p.action==="ordered") {checkRequirement(state,record);requireOpenProcurement(state,record.repairId);}
    }
    await putProcurementRecords(tx,state.storeId,updated,time);return requestId;
  }
  if(kind==="retail") {
    exactKeys(p,["type","unit","id","command","version"]);
    if(p.type==="create") {
      authorize(member,"retail.edit");const draft=p.unit as RetailUnit;fields(draft,retailFields);if(!uuid.test(identifier(draft.id))) throw new BackendError("单机身份标识无效。");
      if(draft.costCents!==null || draft.refurbCents!==null) authorize(member,"financial.edit");if(draft.priceCents!==null) authorize(member,"retail.price");
      const next=createRetailUnit(draft,state.retail,{id:requestId,time,title:"独立单机档案已建立",detail:"门店自有实物，待检测。",actorId:member.id,actorName:member.name});await putRetail(tx,state.storeId,next);return next.id;
    }
    if(p.type!=="command") throw new BackendError("未知整机操作。");
    const unit=state.retail.find(row=>row.id===identifier(p.id));if(!unit) throw new BackendError("单机不存在。",404);
    let command=p.command as RetailCommand;object(command);if(!Object.hasOwn(commandFields,command.type)) throw new BackendError("未知单机操作。");fields(command,["type",...commandFields[command.type]]);authorize(member,retailCommandPermission(command));
    if(unit.version!==integer(p.version)) throw new BackendError("单机已变化，请重新核对。",409);
    if(command.type==="deliver" && command.debt) authorize(member,"sale.debt");
    if(command.type==="sell") {
      command={...command,warranty:{months:unit.warrantyMonths,termsVersion:"retail-2026-10-v1",shopName:state.settings.shopName,address:state.settings.address,phone:state.settings.phone}};
      const proposed=(p.command as Extract<RetailCommand,{type:"sell"}>).warranty;
      if(JSON.stringify(proposed)!==JSON.stringify(command.warranty)) throw new BackendError("销售保修约定已变化，请重新核对。",409);
    }
    if(command.type==="after_sale_link" || command.type==="after_sale_close") requireRetailAfterSaleRepair(unit,command,state.intakes,command.type==="after_sale_close"?JSON.stringify({version:1,workflows:state.workflows}):null);
    const financial=command.type==="edit" && ["costCents","refurbCents"].includes(command.change.field);
    const next=applyRetailCommand(unit,command,{id:requestId,time,title:"单机操作："+command.type,detail:financial?"成本资料更正。":"已核对并保存。",actorId:member.id,actorName:member.name,...(financial?{sensitive:"financial" as const}:{})},integer(p.version),state.retail);
    await putRetail(tx,state.storeId,next);return next.id;
  }
  if(kind==="retail.aftersale_repair") {
    exactKeys(p,["unitId","saleId","caseId","repairId","version"]);authorize(member,"sale.aftersales");
    const unit=state.retail.find(row=>row.id===identifier(p.unitId));if(!unit) throw new BackendError("单机不存在。",404);
    const sale=unit.sales.find(row=>row.id===identifier(p.saleId));const after=sale?.afterSales?.find(row=>row.id===identifier(p.caseId));
    if(!sale || !after || after.closed || after.cancelled || unit.status!=="sold" || currentRetailSale(unit)?.id!==sale.id || sale.returned) throw new BackendError("请核对原销售与售后申请。");
    if(after.repairId) {if(after.repairId!==p.repairId) throw new BackendError("售后已关联其他工单。",409);requireRetailAfterSaleRepair(unit,{type:"after_sale_link",saleId:sale.id,caseId:after.id,repairId:after.repairId},state.intakes,null);return after.repairId;}
    if(unit.version!==integer(p.version)) throw new BackendError("单机已变化，请重新核对。",409);
    const product=saleProductUnit(unit,sale);if(!product) throw new BackendError("原销售设备快照缺失。");
    const data:IntakeReceiptData={id:identifier(p.repairId),createdAt:time,updatedAt:time,previewAt:time,revision:1,policy:policy(state.settings),customerName:sale.customerName??"",phone:sale.customerPhone??"",email:sale.customerEmail??"",category:retailCategories[product.category],brand:product.brand,model:product.model,color:product.color,serial:product.serial||product.imei1||product.imei2,issue:after.issue,accessories:[],services:structuredClone(emptyIntakeServices),priority:"普通",photoCount:0,retailOrigin:{unitId:unit.id,saleId:sale.id,caseId:after.id},custody:after.custody==="left"?"store":"customer"};
    if(!validLocalIntake(data) || state.intakes.some(row=>row.id===data.id)) throw new BackendError("售后工单编号无效或已存在。");
    await putIntake(tx,state,data,[]);
    const next=applyRetailCommand(unit,{type:"after_sale_link",saleId:sale.id,caseId:after.id,repairId:data.id},{id:requestId,time,title:"售后关联维修",detail:data.id,actorId:member.id,actorName:member.name},unit.version,state.retail);
    await putRetail(tx,state.storeId,next);return data.id;
  }
  if(kind==="customer.save") {
    exactKeys(p,["draft","version"]);authorize(member,"customers.edit");
    fields(p.draft,customerFields);const phone=normalizeCustomerPhone((p.draft as CustomerProfile).phone);
    if((state.customers.find(row=>normalizeCustomerPhone(row.phone)===phone)?.version??0)!==integer(p.version)) throw new BackendError("客户资料已变化，请重新核对。",409);
    const draft={...p.draft as Omit<CustomerProfile,"version">,updatedAt:time};const next=updateCustomerProfile(state.customers,draft,integer(p.version));
    await putCustomer(tx,state.storeId,next.find(row=>normalizeCustomerPhone(row.phone)===normalizeCustomerPhone(draft.phone))!);return normalizeCustomerPhone(draft.phone);
  }
  if(kind==="settings.save") {
    exactKeys(p,["settings","revision"]);if(state.settings.revision!==integer(p.revision)) throw new BackendError("设置已变化，请重新核对。",409);
    if(!can(member,"settings.edit") && !can(member,"financial.edit")) throw new BackendError("当前账号没有设置编辑权限。",403);
    fields(p.settings,settingsFields);
    const proposed=p.settings as StoreSettings;
    if(!Array.isArray(proposed.suppliers) || !Array.isArray(proposed.finance)) throw new BackendError("设置资料无效。");
    proposed.suppliers.forEach(row=>fields(row,["id","name","phone","website","active"]));proposed.finance.forEach(row=>fields(row,["id","kind","amountCents","purpose","relatedId","note","time","voidReason"]));
    // An unauthorized client receives no finance rows and cannot overwrite the omitted data.
    const finance=can(member,"financial.read")?proposed.finance:state.settings.finance;
    const next=parseStoreSettings(JSON.stringify({version:1,settings:{...proposed,repairGroups:proposed.repairGroups === undefined ? state.settings.repairGroups : proposed.repairGroups,finance,revision:state.settings.revision+1}}));
    if(JSON.stringify(next.finance)!==JSON.stringify(state.settings.finance)) {
      authorize(member,"financial.edit");
      for(const entry of state.settings.finance) {const replacement=next.finance.find(row=>row.id===entry.id);if(!replacement || JSON.stringify({...replacement,voidReason:entry.voidReason})!==JSON.stringify(entry) || (entry.voidReason && replacement.voidReason!==entry.voidReason)) throw new BackendError("原收支事实不能覆盖或删除；更正须追加。");}
    }
    if(["shopName","address","phone","paper","suppliers","repairWarrantyMonths","retailWarrantyMonths"].some(key=>JSON.stringify(next[key as keyof StoreSettings])!==JSON.stringify(state.settings[key as keyof StoreSettings]))) authorize(member,"settings.edit");
    if(JSON.stringify(next.repairGroups)!==JSON.stringify(parseStoreSettings(JSON.stringify({version:1,settings:state.settings})).repairGroups)) authorize(member,"settings.edit");
    await tx`update chinatech_v2_private.store_state set settings=${tx.json(next)} where store_id=${state.storeId}`;return state.storeId;
  }
  if(kind==="staff.save") {
    exactKeys(p,["draft","revision"]);authorize(member,"staff.manage");
    fields(p.draft,memberFields);let draft=p.draft as StaffMember;const existing=state.staff.members.find(row=>row.id===draft.id);
    let accountId:string|undefined;
    if(!existing) {
      if(!draft || draft.role==="owner" || draft.accountStatus!=="active" || typeof draft.email!=="string") throw new BackendError("只能审核已验证的普通员工账号。");
      const [account]=await tx`select * from chinatech_v2_private.verified_account(${state.storeId},${draft.email.trim().toLowerCase()})`;
      if(!account) throw new BackendError("未找到已验证账号，请让员工先注册并验证邮箱。");
      accountId=account.id;draft={...draft,id:randomUUID(),name:account.display_name||account.email,email:account.email,revision:0};
    } else if(draft.email!==existing.email || draft.name!==existing.name || draft.accountStatus!==existing.accountStatus) throw new BackendError("成员必须绑定已验证账号，不能在员工表改写真实身份。");
    if(state.staff.revision!==integer(p.revision) || (existing?.revision??0)!==draft.revision) throw new BackendError("员工资料已变化，请重新核对。",409);
    const next=updateStaffMember(state.staff,draft,integer(p.revision),member.id,requestId,time);
    const saved=next.members.find(row=>row.id===draft.id)!;
    if(accountId) await tx`insert into chinatech_v2.store_memberships(id,store_id,user_id,role,permissions,membership_status,revision) values(${saved.id},${state.storeId},${accountId},${saved.role},${saved.permissions},${saved.membershipStatus},${saved.revision})`;
    else await tx`update chinatech_v2.store_memberships set role=${saved.role},permissions=${saved.permissions},membership_status=${saved.membershipStatus},revision=${saved.revision} where store_id=${state.storeId} and id=${saved.id}`;
    await tx`update chinatech_v2_private.store_state set staff_audit=${tx.json(next.audit)} where store_id=${state.storeId}`;return draft.id;
  }
  throw new BackendError("此操作尚未接入正式后台。",400);
}

export async function executeCommand(identity:AuthIdentity,command:BackendCommand) {
  if(!uuid.test(command.requestId) || !uuid.test(command.storeId) || typeof command.kind!=="string") throw new BackendError("请求标识无效。");
  const payload=object(command.payload);const digest=createHash("sha256").update(JSON.stringify({kind:command.kind,payload})).digest("hex");
  return withDatabase(identity,command.storeId,async tx=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+command.storeId},0))`;
    // Establish a current write version before reading receipts or applying intent.
    // A serializable snapshot taken before the advisory wait must retry in full.
    await tx`select revision from chinatech_v2_private.store_state where store_id=${command.storeId} for update`;
    const member=await memberInTransaction(tx,command.storeId,identity.userId);
    if(command.memberId!==member.id) throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,"IDENTITY_CHANGED");
    const state=await loadState(tx,command.storeId,member);
    const [previous]=await tx`select digest from chinatech_v2_private.command_receipts where store_id=${command.storeId} and actor_id=${identity.userId} and request_id=${command.requestId}`;
    if(previous) {if(previous.digest==="cancelled") throw new BackendError("此提交已撤销，请重新核对后创建新操作。",410);if(previous.digest!==digest) throw new BackendError("同一请求标识不能用于不同操作。",409);return {...projectState(state,member),operation:await operationReceipt(tx,identity,command.storeId,command.requestId,true)};}
    const entityId=await apply(tx,state,member,command.kind,payload,command.requestId);
    await tx`insert into chinatech_v2_private.command_receipts(store_id,actor_id,request_id,digest) values(${command.storeId},${identity.userId},${command.requestId},${digest})`;
    await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${command.storeId},${identity.userId},${command.requestId},${command.kind},${entityId})`;
    await tx`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${command.storeId}`;
    return {...projectState(await loadState(tx,command.storeId,member),await memberInTransaction(tx,command.storeId,identity.userId)),operation:await operationReceipt(tx,identity,command.storeId,command.requestId,false)};
  });
}

async function operationReceipt(tx:TransactionSql,identity:AuthIdentity,storeId:string,requestId:string,replayed:boolean) {
  const [row]=await tx`select a.entity_id,a.kind,a.created_at from chinatech_v2_private.audit_events a
    join chinatech_v2_private.command_receipts r using(store_id,actor_id,request_id)
    where a.store_id=${storeId} and a.actor_id=${identity.userId} and a.request_id=${requestId}`;
  if(!row) return undefined;
  return {requestId,entityId:row.kind==="customer.save"?"":String(row.entity_id),kind:String(row.kind),committedAt:new Date(row.created_at).toISOString(),replayed};
}
export async function queryOperation(identity:AuthIdentity,storeId:string,memberId:string,requestId:string) {
  if(!uuid.test(storeId) || !uuid.test(requestId)) throw new BackendError("请求标识无效。");
  return withDatabase(identity,storeId,async tx=>{
    const member=await memberInTransaction(tx,storeId,identity.userId);
    if(member.id!==memberId) throw new BackendError("登录身份已变化。",409,"IDENTITY_CHANGED");
    const operation=await operationReceipt(tx,identity,storeId,requestId,true);
    // Not found does NOT prove failure: the original request may still be in flight.
    if(!operation) return {status:"not_found" as const};
    if(operation.kind==="operation.cancelled") return {status:"cancelled" as const};
    return {status:"committed" as const,operation,snapshot:{...projectState(await loadState(tx,storeId,member),member),operation}};
  });
}

export async function cancelOperation(identity:AuthIdentity,storeId:string,memberId:string,requestId:string) {
  if(!uuid.test(storeId) || !uuid.test(requestId)) throw new BackendError("请求标识无效。");
  return withDatabase(identity,storeId,async tx=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+storeId},0))`;
    await tx`select revision from chinatech_v2_private.store_state where store_id=${storeId} for update`;
    const member=await memberInTransaction(tx,storeId,identity.userId);
    if(member.id!==memberId) throw new BackendError("登录身份已变化。",409,"IDENTITY_CHANGED");
    const receipt=await operationReceipt(tx,identity,storeId,requestId,true);
    if(receipt && receipt.kind!=="operation.cancelled") return {status:"committed" as const,snapshot:{...projectState(await loadState(tx,storeId,member),member),operation:receipt}};
    if(!receipt){
      await tx`insert into chinatech_v2_private.command_receipts(store_id,actor_id,request_id,digest) values(${storeId},${identity.userId},${requestId},'cancelled')`;
      await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${storeId},${identity.userId},${requestId},'operation.cancelled','')`;
      await tx`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${storeId}`;
    }
    return {status:"cancelled" as const};
  });
}
