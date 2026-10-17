import "server-only";
import {createHash} from "node:crypto";
import type {TransactionSql} from "postgres";
import {BackendError} from "./database";
import {listSearchNeedle} from "./list-search";
import {backendScopeKey,type BackendReadScope} from "./read-plan";
import {procurementListQuery,procurementCursor,procurementReadVersionChangedCode,type ProcurementListPage,type ProcurementListQuery,type ProcurementListSummary} from "./procurement-list-contract";

export async function procurementModelGeneration(tx:TransactionSql,storeId:string) {
 const [model]=await tx`select ready,generation::text from chinatech_v2_private.procurement_list_models where store_id=${storeId} and format_version=1`;
 if(!model?.ready)throw new BackendError("后台资料暂不可用。",503);return String(model.generation);
}
export function procurementListToken(scope:BackendReadScope,generation:string,query:ProcurementListQuery) {return createHash("sha256").update(JSON.stringify([1,backendScopeKey(scope),generation,query])).digest("hex");}
type Point={groupFirst:string;id:string;direction:"before"|"after"};
export async function readProcurementList(tx:TransactionSql,scope:BackendReadScope,raw:Partial<ProcurementListQuery>={},options:{cursor?:string;anchor?:string;seek?:number;generation?:string}={}):Promise<ProcurementListPage> {
 if(!scope.permissions.includes("repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
 const query=procurementListQuery(raw),generation=options.generation??await procurementModelGeneration(tx,scope.storeId),stateToken=procurementListToken(scope,generation,query);
 if(options.anchor&&(options.anchor.length>100||options.cursor)||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000||options.cursor||options.anchor))throw new BackendError("请求资料无效。",400);
 let point:Point|null=null;
 if(options.cursor)try{
  if(options.cursor.length>2048)throw new Error();const value=JSON.parse(Buffer.from(options.cursor,"base64url").toString("utf8"));
  if(!Array.isArray(value)||value.length!==4||typeof value[0]!=="string"||typeof value[1]!=="string"||typeof value[2]!=="string"||!value[1]||!value[2]||value[1].length>100||value[2].length>100||!["before","after"].includes(value[3]))throw new Error();
  if(value[0]!==stateToken)throw new BackendError("资料已更新，请刷新后重试。",409,procurementReadVersionChangedCode);point={groupFirst:value[1],id:value[2],direction:value[3]};
 }catch(error){if(error instanceof BackendError)throw error;throw new BackendError("请求资料无效。",400);}
 const [row]=await procurementListSql(tx,scope,query,point,options.anchor,options.seek),values:ProcurementListSummary[]=row.items;
 if(point&&!row.point_found)throw new BackendError("请求资料无效。",400);
 const items=point?.direction==="before"?values.slice(-50):values.slice(0,50),rank=Number(row.point_rank),startIndex=point?point.direction==="before"?Math.max(0,rank-items.length):rank+1:(options.anchor||options.seek!==undefined)&&row.point_found?rank:0;
 return{formatVersion:1,scope,generation,query,stateToken,total:Number(row.total),groupTotal:Number(row.group_total),stats:row.stats,items,startIndex,previousCursor:startIndex&&items[0]?procurementCursor(stateToken,items[0],"before"):null,nextCursor:startIndex+items.length<Number(row.total)&&items.at(-1)?procurementCursor(stateToken,items.at(-1)!,"after"):null};
}

// Exactly the old insertion-ordered Map: the first canonical ID orders groups;
// IDs within each group use the same database collation as canonical loadState.
// draft/cart share a display group, while each row preserves its actual status.
export function procurementListSql(tx:TransactionSql,scope:BackendReadScope,query:ProcurementListQuery,point:Point|null=null,anchor?:string,seek?:number,explain=false) {
 const needle=listSearchNeedle(query.q),reverse=point?.direction==="before",hasPoint=Boolean(point||anchor||seek!==undefined),order=reverse?tx`group_first desc,id desc`:tx`group_first asc,id asc`;
 return tx`${explain?tx`explain (analyze,buffers,format json)`:tx``} with scoped as (
  select id,repair_id,repair_model,item,supplier,quantity,arrived,status,expected_at,ledger_revision,search from chinatech_v2_private.procurement_list_sources where store_id=${scope.storeId}
 ), filtered as (
  select *,case ${query.groupBy} when 'status' then case when status='cart' then 'draft' else status end when 'supplier' then supplier when 'repair' then repair_id else 'all' end as group_key
  from scoped where (${needle}='' or strpos(search,${needle})>0) and (${query.repairId}='' or repair_id=${query.repairId})
  and (${query.filter}='all' or ${query.filter}='draft' and status in ('draft','cart') or ${query.filter}='open' and status in ('ordered','partial') or ${query.filter}='complete' and status='complete')
 ), ranked as (
  select *,min(id) over(partition by group_key) group_first,count(*) over(partition by group_key)::integer group_count from filtered
 ), point as (
  select group_first,id from ranked where (${seek!==undefined} or id=${point?.id??anchor??""}) and (${point===null} or group_first=${point?.groupFirst??""})
  order by group_first,id offset greatest(0,least(${seek??0},(select count(*)-1 from ranked))) limit 1
 ), page as (
  select * from ranked where ${!hasPoint} or not exists(select 1 from point)
   or (${!reverse} and ((group_first,id)>(select group_first,id from point) or ${point===null} and (group_first,id)=(select group_first,id from point)))
   or (${reverse} and (group_first,id)<(select group_first,id from point))
  order by ${order} limit 51
 ) select (select count(*)::integer from filtered) total,(select count(distinct group_key)::integer from ranked) group_total,
  (select jsonb_build_object('all',count(*)::integer,'draft',count(*) filter(where status in ('draft','cart'))::integer,'open',count(*) filter(where status in ('ordered','partial'))::integer,'complete',count(*) filter(where status='complete')::integer) from scoped) stats,
  exists(select 1 from point) point_found,(select count(*)::integer from ranked where (group_first,id)<(select group_first,id from point)) point_rank,
  coalesce((select jsonb_agg(jsonb_build_object('id',id,'repairId',repair_id,'repairModel',repair_model,'item',item,'supplier',supplier,'quantity',quantity,'arrived',arrived,'status',status,'expectedAt',expected_at,'ledgerRevision',ledger_revision,'groupKey',group_key,'groupFirst',group_first,'groupCount',group_count) order by group_first,id) from page),'[]'::jsonb) items`;
}
