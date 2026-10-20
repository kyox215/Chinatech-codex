import {projectionQueryRulesHash} from "./query-rules-version";
import "server-only";
import {createHash} from "node:crypto";
import type {TransactionSql} from "postgres";
import {BackendError} from "./database";
import {listSearchNeedle} from "./list-search";
import {backendScopeKey,type BackendReadScope} from "./read-plan";
import {procurementModelGeneration} from "./procurement-list";
import {procurementReadVersionChangedCode} from "./procurement-list-contract";
import {procurementBatchQuery,type ProcurementBatchQuery,type ProcurementBatchPage,type ProcurementRepairCandidate} from "./procurement-batch-contract";

export async function readProcurementBatch(tx:TransactionSql,scope:BackendReadScope,raw:Partial<ProcurementBatchQuery>,options:{cursor?:string;ids?:string[];seek?:number}={}):Promise<ProcurementBatchPage|{scope:BackendReadScope;items:ProcurementRepairCandidate[]}> {
 const query=procurementBatchQuery(raw),needle=listSearchNeedle(query.q);
 if(!scope.permissions.includes("repairs.view")||query.kind!=="repairs"&&!scope.permissions.includes("repairs.edit"))throw new BackendError("当前账号没有此操作权限。",403);
 if(query.kind==="repairs") {
  const rows=await tx`select id,data->>'model' as model from chinatech_v2_private.repair_intakes where store_id=${scope.storeId} and (${query.repairId}='' or id=${query.repairId}) and (${needle}='' or strpos(chinatech_v2_private.query_lower(id||' '||coalesce(data->>'model','')),${needle})>0) order by id limit 12`;
  return {scope,items:rows.map(row=>({id:row.id,model:row.model}))};
 }
 const generation=await procurementModelGeneration(tx,scope.storeId);
 const [settings]=await tx`select revision from chinatech_v2_private.store_state where store_id=${scope.storeId}`;
 if(!settings)throw new BackendError("后台资料暂不可用。",503);
 const stateToken=createHash("sha256").update(JSON.stringify([1,backendScopeKey(scope),projectionQueryRulesHash,generation,settings.revision,query])).digest("hex");
 let after="",startIndex=options.seek??0;
 if(options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000||options.cursor||options.ids))throw new BackendError("请求资料无效。",400);
 if(options.cursor)try{const value=JSON.parse(Buffer.from(options.cursor,"base64url").toString("utf8"));if(!Array.isArray(value)||value.length!==3||typeof value[1]!=="string"||value[1].length>100||!Number.isSafeInteger(value[2])||value[2]<0||value[2]>1000000)throw new Error();if(value[0]!==stateToken)throw new BackendError("资料已更新，请刷新后重试。",409,procurementReadVersionChangedCode);after=value[1];startIndex=value[2]+1;}catch(error){if(error instanceof BackendError)throw error;throw new BackendError("请求资料无效。",400);}
 if(options.ids&&(options.cursor||options.ids.length>100||options.ids.some(id=>typeof id!=="string"||!id||id.length>100)||new Set(options.ids).size!==options.ids.length))throw new BackendError("请求资料无效。",400);
 // Only supplier identity/name/active is projected inside SQL. Finance, other
 // settings and canonical event arrays never leave this read transaction.
 const [result]=await tx`with supplier_rows as (
  select value->>'id' as id,value->>'name' as name,coalesce((value->>'active')::boolean,false) active from chinatech_v2_private.store_state st cross join lateral jsonb_array_elements(coalesce(settings->'suppliers','[]'::jsonb)) where st.store_id=${scope.storeId}
 ), keys as (
  select 'ID:'||id as key,id from supplier_rows union all select 'NAME:'||chinatech_v2_private.directory_trim(name),id from supplier_rows
 ), resolved_keys as (select key,min(id) id from keys group by key having count(*)=1), eligible as (
  select p.*,k.id resolved_supplier from chinatech_v2_private.procurement_list_sources p left join resolved_keys k on k.key=p.supplier_key where p.store_id=${scope.storeId} and p.status in ('ordered','partial') and (${query.repairId}='' or p.repair_id=${query.repairId})
 ), supplier_counts as (
  select s.id,s.name,s.active,count(e.id)::integer count from supplier_rows s join eligible e on e.resolved_supplier=s.id group by s.id,s.name,s.active
 ), matching as (
  select * from eligible where resolved_supplier=${query.supplierId} and (${needle}='' or strpos(search_v2||' '||chinatech_v2_private.query_lower(coalesce(specification,'')),${needle})>0)
 ), selected as (
  select * from matching where ${options.ids?tx`id=any(${tx.array(options.ids,25)})`:tx`id>${after}`} order by id offset ${options.seek??0} limit ${options.ids?100:51}
 ) select (select count(*)::integer from matching) total,(select count(*)::integer from eligible) eligible,(select count(*)::integer from eligible where resolved_supplier is null) unresolved,
  coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active,'count',count) order by id) from (select * from supplier_counts where ${needle}='' or strpos(chinatech_v2_private.query_lower(name||' '||id),${needle})>0 order by id limit 12) s),'[]'::jsonb) suppliers,
  (select jsonb_build_object('id',id,'name',name,'active',active,'count',count) from supplier_counts where id=${query.supplierId}) supplier,
  coalesce((select jsonb_agg(jsonb_build_object('id',id,'repairId',repair_id,'repairModel',repair_model,'repairCancelled',repair_cancelled,'item',item,'specification',specification,'quantity',quantity,'arrived',arrived,'ledgerRevision',ledger_revision,'supplierId',resolved_supplier) order by id) from selected),'[]'::jsonb) items`;
 const more=!options.ids&&result.items.length>50,items=options.ids?result.items:result.items.slice(0,50);
 return {scope,stateToken,total:result.total,eligible:result.eligible,unresolved:result.unresolved,suppliers:query.kind==="suppliers"?result.suppliers:[],supplier:result.supplier,items:query.kind==="rows"?items:[],startIndex,nextCursor:query.kind==="rows"&&more?Buffer.from(JSON.stringify([stateToken,items.at(-1).id,startIndex+items.length-1])).toString("base64url"):null};
}
