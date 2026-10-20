import type {TransactionSql} from 'postgres';
import {can,type StaffMember} from '../staff';
import type {AuthIdentity} from './database';
import {BackendError} from './database';
import type {OperationReceipt} from './contracts';
import type {CommandWriteSet} from './command-dependencies';
export type CommandEffectDomain='repairs'|'procurement'|'retail'|'customers'|'settings'|'staff';
export type CommandEffect={domain:CommandEffectDomain;id:string;version:number;workflowRevision?:number;signatureCount?:number;updatedAt?:string};
export type CommandResult={formatVersion:2;storeId:string;revision:number|null;operation:OperationReceipt;effects:{available:boolean;domains:CommandEffectDomain[];count:number}};
export type CommandEffectsPage={formatVersion:2;storeId:string;requestId:string;items:CommandEffect[];total:number;nextOffset:number|null};
export async function commandEffects(tx:TransactionSql,storeId:string,changes:CommandWriteSet):Promise<CommandEffect[]>{
 const effects:CommandEffect[]=[];
 if(changes.repairs.size){const rows=await tx`select id,coalesce((data->>'revision')::integer,1)version,coalesce((workflow->>'revision')::integer,0)workflow_revision,jsonb_array_length(signatures)signature_count,data->>'updatedAt'updated_at from chinatech_v2_private.repair_intakes where store_id=${storeId} and id in ${tx([...changes.repairs])} order by id`;for(const row of rows)effects.push({domain:'repairs',id:row.id,version:row.version,workflowRevision:row.workflow_revision,signatureCount:row.signature_count,...(row.updated_at?{updatedAt:row.updated_at}:{})});}
 if(changes.procurement.size){const rows=await tx`select id,jsonb_array_length(data->'events')version from chinatech_v2_private.procurement_records where store_id=${storeId} and id in ${tx([...changes.procurement])} order by id`;for(const row of rows)effects.push({domain:'procurement',id:row.id,version:row.version});}
 if(changes.retail.size){const rows=await tx`select id,(data->>'version')::integer version from chinatech_v2_private.retail_units where store_id=${storeId} and id in ${tx([...changes.retail])} order by id`;for(const row of rows)effects.push({domain:'retail',id:row.id,version:row.version});}
 if(changes.customers.size){const rows=await tx`select normalized_phone id,(data->>'version')::integer version from chinatech_v2_private.customers where store_id=${storeId} and normalized_phone in ${tx([...changes.customers])} order by normalized_phone`;for(const row of rows)effects.push({domain:'customers',id:row.id,version:row.version});}
 if(changes.settings.size){const[row]=await tx`select(settings->>'revision')::integer version from chinatech_v2_private.store_state where store_id=${storeId}`;effects.push({domain:'settings',id:storeId,version:row.version});}
 if(changes.staff.size){const rows=await tx`select id,revision from chinatech_v2.store_memberships where store_id=${storeId} and id in ${tx([...changes.staff])} order by id`;for(const row of rows)effects.push({domain:'staff',id:row.id,version:Number(row.revision)});}
 if(effects.length>500||effects.some(effect=>!Number.isSafeInteger(effect.version)||effect.version<0))throw new BackendError('后台核对结果无效，请稍后重试。',503);
 return effects;
}
export function nativeCommandResult(storeId:string,revision:number,operation:OperationReceipt,effects:CommandEffect[]):CommandResult{return{formatVersion:2,storeId,revision,operation,effects:{available:true,domains:[...new Set(effects.map(effect=>effect.domain))],count:effects.length}};}
export function replayCommandResult(value:unknown,storeId:string,operation:OperationReceipt):CommandResult{
 if(value===null||value===undefined)return{formatVersion:2,storeId,revision:null,operation,effects:{available:false,domains:[],count:0}};
 const result=value as CommandResult;if(result.formatVersion!==2||result.storeId!==storeId||result.operation?.requestId!==operation.requestId||!Number.isSafeInteger(result.revision)||result.revision===null||result.revision<0||!result.effects?.available)throw new BackendError('后台核对结果无效，请稍后重试。',503);
 return{...result,operation:{...result.operation,replayed:true}};
}
export function canReadCommandEffect(member:StaffMember,domain:CommandEffectDomain){return domain==='repairs'||domain==='procurement'?can(member,'repairs.view'):domain==='retail'?can(member,'retail.view'):domain==='customers'?can(member,'customers.view'):domain==='staff'?can(member,'staff.manage'):can(member,'settings.edit')||can(member,'financial.read');}
export async function readCommandEffects(tx:TransactionSql,identity:AuthIdentity,storeId:string,requestId:string,member:StaffMember,offset:number):Promise<CommandEffectsPage>{
 if(!Number.isSafeInteger(offset)||offset<0||offset>500)throw new BackendError('请求资料无效。');
 const[row]=await tx`select result is not null available from chinatech_v2_private.command_receipts where store_id=${storeId} and actor_id=${identity.userId} and request_id=${requestId}`;
 if(!row)throw new BackendError('暂时无法核对提交结果。',404);
 if(!row.available)throw new BackendError('此操作尚未接入正式后台。',409);
 const domains=(['repairs','procurement','retail','customers','settings','staff'] as const).filter(domain=>canReadCommandEffect(member,domain));
 const rows=await tx`with scoped as(select value,ordinality from chinatech_v2_private.command_receipts r cross join lateral jsonb_array_elements(r.effects)with ordinality e where r.store_id=${storeId} and r.actor_id=${identity.userId} and r.request_id=${requestId} and value->>'domain'=any(${domains}::text[]))select coalesce(jsonb_agg(value order by ordinality)filter(where rank>${offset} and rank<=${offset+50}),'[]'::jsonb)items,count(*)::integer total from(select *,row_number()over(order by ordinality)rank from scoped)numbered`;
 const page=rows[0];return{formatVersion:2,storeId,requestId,items:page.items,total:page.total,nextOffset:offset+page.items.length<page.total?offset+page.items.length:null};
}
