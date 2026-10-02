import { createHash, randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { can, updateStaffMember, type Permission, type StaffMember } from "../staff";
import { parseStoreSettings, type StoreSettings } from "../store-settings";
import { normalizeCustomerPhone, updateCustomerProfile, type CustomerProfile } from "../customers";
import { appendIntakeSignature, intakeDirectoryEntry, intakeRecordTime, validLocalIntake, type IntakeReceiptData, type IntakeSignatureDraft, type IntakePolicy } from "../repair-intake-record";
import { initialRepairWorkflow, applyWorkflowCommand, type WorkflowCommand } from "../repair-workflow";
import { appendProcurementEvent, isPreorder, procurementStatus, validateProcurementDraft, type ProcurementRecord, type ProcurementEvent } from "../procurement";
import { createRetailUnit, applyRetailCommand, currentRetailSale, saleProductUnit, retailCategories, type RetailUnit, type RetailCommand } from "../retail";
import { emptyIntakeServices } from "../intake-services";
import { projectState, loadState } from "./state";
import { memberInTransaction } from "./context";
import { retailCommandPermission, requireRetailAfterSaleRepair } from "../retail-access";
import { BackendError, withDatabase, type AuthIdentity } from "./database";
import type { BackendCommand, BackendSnapshot } from "./contracts";
import { parseIntakePhotoAttachments, putIntakePhotos } from "./intake-photos";
import { fields, intakeFields, procurementFields, customerFields, settingsFields, memberFields, retailFields, commandFields } from "./input";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function authorize(member: StaffMember, permission: Permission) { if (!can(member,permission)) throw new BackendError("当前账号没有此操作权限。",403); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new BackendError("请求资料无效。"); return value as Record<string,unknown>; }
function integer(value: unknown) { if (!Number.isSafeInteger(value) || Number(value)<0) throw new BackendError("请核对记录版本。"); return Number(value); }
function identifier(value: unknown) { if (typeof value!=="string" || !value || value.length>100) throw new BackendError("记录标识无效。");return value; }
function policy(settings:StoreSettings):IntakePolicy { return {months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone}; }
function exactKeys(value:Record<string,unknown>, allowed:string[]) {if(Object.keys(value).some(key=>!allowed.includes(key))) throw new BackendError("请求包含不支持的字段。");}

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

async function apply(tx:TransactionSql,state:BackendSnapshot,member:StaffMember,kind:string,p:Record<string,unknown>,requestId:string) {
  const time=intakeRecordTime();
  if(kind==="intake.save") {
    exactKeys(p,["data","revision","signature","signatureCount","photos"]);authorize(member,"repairs.edit");
    const draft=p.data as IntakeReceiptData;fields(draft,intakeFields); if(!validLocalIntake(draft) || draft.retailOrigin) throw new BackendError("请核对接机资料及来源。");
    const existing=state.intakes.find(row=>row.id===draft.id);const revision=integer(p.revision);
    if((existing?.revision??0)!==revision) throw new BackendError("接机资料已变化，请重新核对。",409);
    if(existing?.retailOrigin) throw new BackendError("售后接机快照不能改写。");
    const photos=await parseIntakePhotoAttachments(p.photos,draft.photoCount);
    if(photos.length) authorize(member,"repairs.view");
    const frozen=existing?.policy??policy(state.settings);
    if(draft.policy && JSON.stringify(draft.policy)!==JSON.stringify(frozen)) throw new BackendError("门店保修已变化，请重新核对。",409);
    const data={...draft,createdAt:existing?.createdAt??time,updatedAt:time,previewAt:time,policy:frozen,revision:revision+1,photos:photos.map(({id,slot})=>({id,slot})),photoCount:photos.length};
    const signatures=p.signature?appendIntakeSignature(state.signatures,data,frozen,{...p.signature as IntakeSignatureDraft,signedAt:time},member.id,integer(p.signatureCount)):state.signatures;
    await putIntake(tx,state,data,signatures.filter(row=>row.orderId===data.id));await putIntakePhotos(tx,state.storeId,data.id,photos);return data.id;
  }
  if(kind==="intake.signature") {
    exactKeys(p,["id","revision","policy","signature","count"]);authorize(member,"repairs.edit");
    const data=state.intakes.find(row=>row.id===identifier(p.id));if(!data) throw new BackendError("工单不存在。",404);
    if((data.revision??1)!==integer(p.revision)) throw new BackendError("工单已变化，请重新核对。",409);
    const frozen=data.policy??policy(state.settings);if(JSON.stringify(p.policy)!==JSON.stringify(frozen)) throw new BackendError("门店保修已变化。",409);
    const signatures=appendIntakeSignature(state.signatures,data,frozen,{...p.signature as IntakeSignatureDraft,signedAt:time},member.id,integer(p.count));
    await putIntake(tx,state,data,signatures.filter(row=>row.orderId===data.id));return data.id;
  }
  if(kind==="repair.workflow") {
    exactKeys(p,["id","command","revision"]);authorize(member,"repairs.edit");
    const data=state.intakes.find(row=>row.id===identifier(p.id));if(!data) throw new BackendError("工单不存在。",404);
    const current=state.workflows[data.id]??initialRepairWorkflow(intakeDirectoryEntry(data));
    const next=applyWorkflowCommand(current,p.command as WorkflowCommand,{id:requestId,time},state.procurement,data.id,integer(p.revision));
    await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(next)} where store_id=${state.storeId} and id=${data.id}`;return data.id;
  }
  if(kind==="procurement") {
    exactKeys(p,["type","record","id","event","revision"]);authorize(member,"repairs.edit");
    let next:ProcurementRecord;
    if(p.type==="create") {
      const draft=p.record as ProcurementRecord;fields(draft,procurementFields);identifier(draft.id);validateProcurementDraft(draft);
      if(draft.events.length || state.procurement.some(row=>row.id===draft.id)) throw new BackendError("采购编号已存在或包含历史事件。",409);
      if(draft.unitCostCents!==null) authorize(member,"financial.edit");next={...draft,events:[],reference:""};
    } else {
      const id=p.type==="edit"?(p.record as ProcurementRecord)?.id:identifier(p.id);const record=state.procurement.find(row=>row.id===id);
      if(!record) throw new BackendError("采购记录不存在。",404);
      if(record.events.length!==integer(p.revision)) throw new BackendError("采购记录已变化，请重新核对。",409);
      if(p.type==="edit") {
        if(!isPreorder(record)) throw new BackendError("已下单配件不能改写。");
        const draft=p.record as ProcurementRecord;fields(draft,procurementFields);validateProcurementDraft({...draft,events:[]});
        if(draft.repairId!==record.repairId) throw new BackendError("不能更换关联工单。");
        if(!can(member,"financial.edit")){if(draft.unitCostCents!==null && draft.unitCostCents!==undefined) throw new BackendError("当前账号不能编辑采购成本。",403);draft.unitCostCents=record.unitCostCents;}
        let history=record;if(procurementStatus(record)==="cart") history=appendProcurementEvent(history,{id:randomUUID(),type:"cart_removed",quantity:0,time,note:"配件资料更正，取消原加车标记。"});
        history=appendProcurementEvent(history,{id:requestId,type:"details_changed",quantity:0,time,note:"配件资料已更正。"});next={...draft,reference:record.reference,events:history.events};
      } else if(p.type==="append") { const event=p.event as ProcurementEvent;next=appendProcurementEvent(record,{...event,time,id:requestId},record.events.length); }
      else throw new BackendError("未知采购操作。");
    }
    const repair=state.intakes.find(row=>row.id===next.repairId);if(!repair) throw new BackendError("关联工单不存在。",404);
    await tx`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data) values(${state.storeId},${next.id},${next.repairId},${tx.json(next)}) on conflict(store_id,id) do update set data=excluded.data`;
    await putIntake(tx,state,{...repair,updatedAt:time});return next.id;
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
    fields(p.draft,customerFields);const draft={...p.draft as Omit<CustomerProfile,"version">,updatedAt:time};const next=updateCustomerProfile(state.customers,draft,integer(p.version));
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
    const member=await memberInTransaction(tx,command.storeId,identity.userId);
    const state=await loadState(tx,command.storeId,member);
    const [previous]=await tx`select digest from chinatech_v2_private.command_receipts where store_id=${command.storeId} and actor_id=${identity.userId} and request_id=${command.requestId}`;
    if(previous) {if(previous.digest!==digest) throw new BackendError("同一请求标识不能用于不同操作。",409);return projectState(state,member);}
    const entityId=await apply(tx,state,member,command.kind,payload,command.requestId);
    await tx`insert into chinatech_v2_private.command_receipts(store_id,actor_id,request_id,digest) values(${command.storeId},${identity.userId},${command.requestId},${digest})`;
    await tx`insert into chinatech_v2_private.audit_events(store_id,actor_id,request_id,kind,entity_id) values(${command.storeId},${identity.userId},${command.requestId},${command.kind},${entityId})`;
    await tx`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${command.storeId}`;
    return projectState(await loadState(tx,command.storeId,member),await memberInTransaction(tx,command.storeId,identity.userId));
  });
}
