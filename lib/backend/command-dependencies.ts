import type {TransactionSql} from 'postgres';
import type {BackendCommand} from './contracts';
import {BackendError} from './database';
import {can,type StaffData,type StaffMember} from '../staff';
import {normalizeCustomerPhone,type CustomerProfile} from '../customers';
import type {IntakeReceiptData,IntakeSignature} from '../repair-intake-record';
import type {RepairWorkflow} from '../repair-workflow';
import type {ProcurementRecord} from '../procurement';
import type {RetailUnit,RetailIdentity} from '../retail';
import type {RetailHistoryRecord} from '../retail-history';
import type {StoreSettings,SupplierProfile} from '../store-settings';
import {intakeRecordTime} from '../repair-intake-record';
import {commandRetailIdentities} from './retail-command-identities';

export type CommandWriteSet={repairs:Set<string>;procurement:Set<string>;retail:Set<string>;customers:Set<string>;settings:Set<string>;staff:Set<string>};
export function newCommandWriteSet():CommandWriteSet{return{repairs:new Set(),procurement:new Set(),retail:new Set(),customers:new Set(),settings:new Set(),staff:new Set()};}
export type CommandDefaults=Pick<StoreSettings,'revision'|'shopName'|'address'|'phone'|'paper'|'repairWarrantyMonths'|'retailWarrantyMonths'>;
/** A transaction-local dependency set, never a client snapshot or a statement
 * that omitted domains are empty. Every collection is restricted to the command
 * plan below. Staff and the legacy complete-settings protocol retain their
 * complete ledgers; explicit settings patches use scalar/position witnesses. */
export type CommandDependencies={
 loadedIntakeIds:Set<string>;loadedSignatureIds:Set<string>;changes:CommandWriteSet;storeId:string;revision:number;settings:CommandDefaults&{suppliers?:SupplierProfile[];full?:StoreSettings};staff:StaffData|null;
 intakes:IntakeReceiptData[];signatures:IntakeSignature[];workflows:Record<string,RepairWorkflow>;procurement:ProcurementRecord[];
 retail:RetailUnit[];retailIdentities:RetailIdentity[];retailHistory:RetailHistoryRecord[];customers:CustomerProfile[];saleIdExists:boolean;quoteItemExists:boolean;
};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new BackendError('请求资料无效。');return value as Record<string,unknown>;}
function id(value:unknown){if(typeof value!=='string'||!value||value.length>100)throw new BackendError('记录标识无效。');return value;}
export function commandDependencyPlan(command:BackendCommand){
 const p=object(command.payload),repairIds=new Set<string>(),signatureIds=new Set<string>(),procurementIds=new Set<string>(),retailIds=new Set<string>(),historyIds=new Set<string>();
 const fullRepairIds=new Set<string>();let suppliers=false,retailIdentities=false,staff=false,settings=false,phone:string|undefined,saleId:string|undefined,quoteItem:string|undefined;
 const repair=(value:unknown,signatures=false)=>{const target=id(value);repairIds.add(target);if(signatures)signatureIds.add(target);};
 switch(command.kind){
  case'intake.save':{const draft=object(p.data);repair(draft.id,Boolean(p.signature));break;}
  case'intake.signature':repair(p.id,true);break;
  case'intake.photos':repair(p.id);break;
  case'repair.quote':repair(p.id);if(typeof p.item==='string')quoteItem=p.item;break;
  case'repair.workflow':{repair(p.id);const workflow=object(p.command);if(['requirement','arrival_notice'].includes(String(workflow.type))||workflow.type==='stage'&&workflow.status==='ready')fullRepairIds.add(id(p.id));break;}
  case'repair.rework':repair(p.sourceId);repair(p.repairId);break;
  case'procurement':{
   suppliers=true;
   if(p.type==='save-items'){repair(p.repairId);fullRepairIds.add(id(p.repairId));if(!Array.isArray(p.items)||p.items.length<1||p.items.length>100)throw new BackendError('须保存当前工单的1–100项维修项目，并核对打开时版本。');for(const row of p.items){const purchase=object(row).purchase;if(purchase!==undefined)procurementIds.add(id(object(purchase).id));}}
   else if(p.type==='create'||p.type==='edit'||p.type==='save-item'){const record=object(p.record);procurementIds.add(id(record.id));repair(record.repairId);if(p.type==='save-item')fullRepairIds.add(id(record.repairId));}
   else procurementIds.add(id(p.id));
   break;
  }
  case'procurement.reconfirm':repair(p.repairId);fullRepairIds.add(id(p.repairId));suppliers=true;break;
  case'procurement.batch':{
   suppliers=true;if(!Array.isArray(p.items)||p.items.length<1||p.items.length>100)throw new BackendError('每批须选择1–100条采购。');
   for(const item of p.items)procurementIds.add(id(object(item).id));break;
  }
  case'customer.save':phone=normalizeCustomerPhone(object(p.draft).phone as string);break;
  case'settings.save':settings=!Object.hasOwn(p,'patch');break;
  case'staff.save':staff=true;break;
  case'retail.workflow':{
   if(p.type==='create_ready'){const unit=object(p.unit);retailIds.add(id(unit.id));historyIds.add(id(unit.id));retailIdentities=true;}
   else{retailIds.add(id(p.id));if(p.type==='checkout')saleId=command.requestId+':sale';}
   break;
  }
  case'retail':{
   if(p.type==='create'){const unit=object(p.unit);retailIds.add(id(unit.id));historyIds.add(id(unit.id));retailIdentities=true;}
   else{retailIds.add(id(p.id));const value=object(p.command);if(value.type==='edit')retailIdentities=true;if(value.type==='after_sale_link')repair(value.repairId);}
   break;
  }
  case'retail.prepare':historyIds.add(id(p.id));retailIdentities=true;break;
  case'retail.aftersale_repair':retailIds.add(id(p.unitId));repair(p.repairId);break;
  default:throw new BackendError('此操作尚未接入正式后台。',400);
 }
 return{repairIds,signatureIds,procurementIds,retailIds,historyIds,fullRepairIds,suppliers,retailIdentities,staff,settings,phone,saleId,quoteItem};
}
export function commandSuppliers(state:CommandDependencies){if(!state.settings.suppliers)throw new BackendError('后台暂时不可用，请稍后重试。',503);return state.settings.suppliers;}
export function commandSettings(state:CommandDependencies){if(!state.settings.full)throw new BackendError('后台暂时不可用，请稍后重试。',503);return state.settings.full;}
export function commandStaff(state:CommandDependencies){if(!state.staff)throw new BackendError('后台暂时不可用，请稍后重试。',503);return state.staff;}

export async function loadCommandDependencies(tx:TransactionSql,command:BackendCommand,member:StaffMember,time=intakeRecordTime()):Promise<CommandDependencies>{
 const plan=commandDependencyPlan(command),storeId=command.storeId;
 const[header]=await tx`select revision,jsonb_build_object('revision',settings->'revision','shopName',settings->'shopName','address',settings->'address','phone',settings->'phone','paper',settings->'paper','repairWarrantyMonths',settings->'repairWarrantyMonths','retailWarrantyMonths',settings->'retailWarrantyMonths')defaults,
  case when ${plan.suppliers} then settings->'suppliers' else null end suppliers,case when ${plan.settings} then settings else null end full_settings,case when ${plan.staff} then staff_audit else null end audit
  from chinatech_v2_private.store_state where store_id=${storeId}`;
 if(!header)throw new BackendError('门店尚未完成初始化。',503);
 const state:CommandDependencies={loadedIntakeIds:plan.repairIds,loadedSignatureIds:plan.signatureIds,changes:newCommandWriteSet(),storeId,revision:Number(header.revision),settings:{...header.defaults,...(plan.suppliers?{suppliers:header.suppliers}:{}),...(plan.settings?{full:header.full_settings}:{})},staff:null,intakes:[],signatures:[],workflows:{},procurement:[],retail:[],retailIdentities:[],retailHistory:[],customers:[],saleIdExists:false,quoteItemExists:false};
 if(plan.procurementIds.size){const records=await tx`select data,repair_id from chinatech_v2_private.procurement_records where store_id=${storeId} and id in ${tx([...plan.procurementIds])} order by id`;state.procurement=records.map(row=>row.data as ProcurementRecord);for(const row of records)plan.repairIds.add(row.repair_id);}
 if(plan.retailIds.size){const units=await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} and id in ${tx([...plan.retailIds])} order by id`;state.retail=units.map(row=>row.data as RetailUnit);
  // Linked after-sale repair identity comes from the current canonical sale, not
  // from a guessed caller ID. Both old relation and proposed target are checked.
  const payload=object(command.payload);if(command.kind==='retail.aftersale_repair'||command.kind==='retail'&&payload.type==='command'&&['after_sale_link','after_sale_close'].includes(String(object(payload.command).type))){const selection=command.kind==='retail'?object(payload.command):payload;for(const unit of state.retail){for(const sale of unit.sales)if(sale.id===selection.saleId)for(const after of sale.afterSales??[])if(after.id===selection.caseId&&after.repairId)plan.repairIds.add(after.repairId);const related=await tx`select id from chinatech_v2_private.repair_intakes where store_id=${storeId} and data ? 'retailOrigin' and data->'retailOrigin'->>'unitId'=${unit.id} and data->'retailOrigin'->>'saleId'=${id(selection.saleId)} and data->'retailOrigin'->>'caseId'=${id(selection.caseId)}`;for(const row of related)plan.repairIds.add(row.id);}}
 }
 if(plan.repairIds.size){const records=await tx`select data,workflow,case when id=any(${[...plan.signatureIds]}::text[]) then signatures else null end signatures from chinatech_v2_private.repair_intakes where store_id=${storeId} and id in ${tx([...plan.repairIds])} order by id`;state.intakes=records.map(row=>row.data as IntakeReceiptData);state.signatures=records.flatMap(row=>(row.signatures??[]) as IntakeSignature[]);state.workflows=Object.fromEntries(records.filter(row=>row.workflow).map(row=>[(row.data as IntakeReceiptData).id,row.workflow as RepairWorkflow]));}
 if(plan.fullRepairIds.size){const records=await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and(repair_id=any(${[...plan.fullRepairIds]}::text[])or id=any(${[...plan.procurementIds]}::text[]))order by id`;state.procurement=records.map(row=>row.data as ProcurementRecord);}
 if(plan.quoteItem!==undefined){const[row]=await tx`select exists(select 1 from chinatech_v2_private.procurement_records where store_id=${storeId} and repair_id=${[...plan.repairIds][0]} and(data->>'item')collate"C"=${plan.quoteItem})present`;state.quoteItemExists=row.present;}
 if(plan.historyIds.size){const ids=[...plan.historyIds].filter(value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value));if(ids.length&&can(member,'retail.view'))state.retailHistory=(await tx`select data from chinatech_v2_private.retail_history_records where store_id=${storeId} and id in ${tx(ids)}`).map(row=>row.data as RetailHistoryRecord);}
 if(plan.retailIdentities)state.retailIdentities=await commandRetailIdentities(tx,command,member,state.retail,state.retailHistory,state.settings,time);else state.retailIdentities=state.retail;
 if(plan.phone!==undefined)state.customers=(await tx`select data from chinatech_v2_private.customers where store_id=${storeId} and normalized_phone=${plan.phone}`).map(row=>row.data as CustomerProfile);
 if(plan.saleId){const[row]=await tx`select chinatech_v2_private.command_retail_sale_exists_v1(${storeId},${plan.saleId})present`;state.saleIdExists=row.present;}
 if(plan.staff){const roster=await tx`select m.id,m.role,m.permissions,m.revision,m.membership_status,a.account_status,a.display_name,a.email from chinatech_v2.store_memberships m join chinatech_v2.accounts a on a.id=m.user_id where m.store_id=${storeId} order by m.id`;state.staff={revision:state.revision,currentId:member.id,audit:header.audit,members:roster.map(row=>({id:row.id,name:row.display_name||row.email,email:row.email,role:row.role,permissions:row.permissions,revision:row.revision,accountStatus:row.account_status,membershipStatus:row.membership_status}))};}
 return state;
}
