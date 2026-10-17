import type {TransactionSql} from 'postgres';
import {createRetailUnit,validateRetailFieldEdit,type RetailIdentity,type RetailUnit,type RetailFieldEdit} from '../retail';
import {prepareRetailRecord,type RetailRecordPreparation} from '../retail-record';
import type {RetailHistoryRecord} from '../retail-history';
import type {StaffMember} from '../staff';
import type {BackendCommand} from './contracts';
import type {CommandDefaults} from './command-dependencies';

type IdentityRow={id:string;code:string;brand:string;serial:string;imei1:string;imei2:string;history_origin:RetailIdentity['historyOrigin']|null};
const identity=(row:IdentityRow):RetailIdentity=>({id:row.id,code:row.code,brand:row.brand,serial:row.serial,imei1:row.imei1,imei2:row.imei2,...(row.history_origin?{historyOrigin:row.history_origin}:{})});
/** Only witnesses are transferred. The unchanged domain validator still chooses
 * the error and the final identity, under the original store transaction lock.
 * Every bucket predicate has a full normalized equality beside it. */
export async function commandRetailIdentities(tx:TransactionSql,command:BackendCommand,member:StaffMember,units:readonly RetailUnit[],history:readonly RetailHistoryRecord[],settings:CommandDefaults,time:string):Promise<RetailIdentity[]>{
 const p=command.payload as Record<string,unknown>,storeId=command.storeId;
 const event={id:command.requestId,time,title:'单机操作',detail:'本次事实已核对。',actorId:member.id,actorName:member.name};
 let candidate:RetailUnit;const selected=new Set<string>();
 const readSelected=async(ids:string[])=>ids.length?(await tx<IdentityRow[]>`select id,data->>'code' code,data->>'brand' brand,data->>'serial' serial,data->>'imei1' imei1,data->>'imei2' imei2,data->'historyOrigin' history_origin from chinatech_v2_private.retail_units where store_id=${storeId} and id=any(${ids}::text[]) order by id`).map(identity):[];
 if(command.kind==='retail.prepare'){
  const record=history.find(row=>row.id===p.id);
  // Let the original command reject absence/stale intent before draft parsing.
  if(!record||record.sourceSnapshot!==p.sourceSnapshot||settings.revision!==p.settingsRevision)return[];
  const taken=await tx<{id:string}[]>`select id from chinatech_v2_private.command_retail_origin_witness_v1(${storeId},${record.id})`;
  if(taken.length)return readSelected(taken.map(row=>row.id));
  candidate=prepareRetailRecord(record,p.draft as RetailRecordPreparation,settings.retailWarrantyMonths,event,[]);
 }else if(p.type==='create'||p.type==='create_ready'){
  const draft=p.unit as RetailUnit;
  if(history.some(row=>row.id===draft.id)||p.type==='create_ready'&&settings.revision!==p.settingsRevision)return[];
  const current=units.find(row=>row.id===draft.id);if(current)return[current];
  const prefix=`CT-${time.slice(0,10).replaceAll('-','')}-`;
  // Any unsafe original suffix keeps nextRetailCode's original rejection;
  // otherwise one exact maximum witnesses the complete safe numeric set.
  const maximum=await tx<{id:string;code:string}[]>`select id,code from chinatech_v2_private.command_retail_code_witness_v1(${storeId},${prefix})`;
  maximum.forEach(row=>selected.add(row.id));
  candidate=createRetailUnit(draft,[],event,maximum);
 }else{
  const current=units.find(row=>row.id===p.id);if(!current||current.version!==p.version)return[];
  candidate=validateRetailFieldEdit(current,(p.command as {change:RetailFieldEdit}).change,[]);
 }
 const conflicts=await tx<{id:string}[]>`select id from chinatech_v2_private.command_retail_conflict_v1(${storeId},${candidate.id},${candidate.code},${candidate.brand},${candidate.serial},${candidate.imei1},${candidate.imei2})`;
 conflicts.forEach(row=>selected.add(row.id));if(!selected.size)return[];
 // Preserve the canonical loader's database ID order for first-conflict errors.
 return readSelected([...selected]);
}
