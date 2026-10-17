import "server-only";
import {createHash} from "node:crypto";
import type {TransactionSql} from "postgres";
import {BackendError} from "./database";
import {listSearchNeedle} from "./list-search";
import {backendScopeKey,type BackendReadScope} from "./read-plan";
import {parseRepairGroups,visibleRepairGroups} from "../repair-groups";
import {repairListQuery,repairCursor,repairReadVersionChangedCode,type RepairListPage,type RepairListQuery,type RepairListGroup,type RepairListSummary} from "./repair-list-contract";

export async function repairReadContext(tx:TransactionSql,scope:BackendReadScope,raw:Partial<RepairListQuery>={}) {
 if(!scope.permissions.includes("repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
 const [model]=await tx`select ready,generation::text from chinatech_v2_private.repair_list_models where store_id=${scope.storeId} and format_version=1`;
 if(!model?.ready)throw new BackendError("后台资料暂不可用。",503);
 const [settings]=await tx`select settings->'repairGroups' as groups,revision::text from chinatech_v2_private.store_state where store_id=${scope.storeId}`;
 if(!settings)throw new BackendError("门店尚未完成初始化。",503);
 const query=repairListQuery(raw),generation=String(model.generation),configured=parseRepairGroups(settings.groups??undefined);
 const groups=query.view==="history"?[{key:"all",label:"历史工单"}]:query.groupBy==="none"?[{key:"all",label:"全部工单"}]:query.groupBy==="parts"?visibleRepairGroups(configured,"parts"):[...visibleRepairGroups(configured,"workflow"),...(query.view==="all"?[{key:"history",label:"历史工单"}]:[])];
 const stateToken=createHash("sha256").update(JSON.stringify([1,backendScopeKey(scope),generation,query,groups,visibleRepairGroups(configured,"parts")])).digest("hex");
 return{query,generation,observedRevision:settings.revision,groups,stateToken,partGroups:visibleRepairGroups(configured,"parts")};
}
type ReadContext=Awaited<ReturnType<typeof repairReadContext>>;
type Point={id:string;direction:"before"|"after"};
export function validateRepairListOptions(context:ReadContext,options:{group?:string;cursor?:string;anchor?:string;seek?:number}) {
 if(options.group!==undefined&&!context.groups.some(group=>group.key===options.group)||options.anchor!==undefined&&(!options.anchor||options.anchor.length>100||options.cursor)||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000||options.cursor||options.anchor!==undefined))throw new BackendError("请求资料无效。",400);
}
export async function readRepairList(tx:TransactionSql,scope:BackendReadScope,raw:Partial<RepairListQuery>={},options:{group?:string;cursor?:string;anchor?:string;seek?:number;context?:ReadContext}={}):Promise<RepairListPage> {
 const context=options.context??await repairReadContext(tx,scope,raw),{query,generation,stateToken}=context;
 validateRepairListOptions(context,options);
 let point:Point|null=null;
 if(options.cursor)try{
  if(options.cursor.length>2048)throw new Error();const value=JSON.parse(Buffer.from(options.cursor,"base64url").toString("utf8"));
  if(!Array.isArray(value)||value.length!==4||value.some(item=>typeof item!=="string")||!value[2]||value[2].length>100||value[1]!==options.group||!["before","after"].includes(value[3]))throw new Error();
  if(value[0]!==stateToken)throw new BackendError("资料已更新，请刷新后重试。",409,repairReadVersionChangedCode);point={id:value[2],direction:value[3]};
 }catch(error){if(error instanceof BackendError)throw error;throw new BackendError("请求资料无效。",400);}
 const [row]=await repairListSql(tx,scope,context,options.group,point,options.anchor,options.seek);
 if(point&&!row.point_found)throw new BackendError("请求资料无效。",400);
 const metadata:RepairListGroup[]=row.groups,group:string|null=row.selected_group,groupTotal=metadata.find(value=>value.key===group)?.visibleCount??0,values:RepairListSummary[]=row.items;
 const items=point?.direction==="before"?values.slice(-50):values.slice(0,50),rank=Number(row.point_rank);
 let startIndex=point?point.direction==="before"?Math.max(0,rank-items.length):rank+1:(options.anchor||options.seek!==undefined)&&row.point_found?rank:0;
 const response=():RepairListPage=>({formatVersion:1,scope,generation,observedRevision:context.observedRevision,query,stateToken,total:Number(row.total),stats:row.stats,groups:metadata,partGroups:context.partGroups,group,items,startIndex,previousCursor:startIndex&&items[0]&&group?repairCursor(stateToken,group,items[0].id,"before"):null,nextCursor:startIndex+items.length<groupTotal&&items.at(-1)&&group?repairCursor(stateToken,group,items.at(-1)!.id,"after"):null});
 // Valid long multilingual originals can fill the three previews. A page has
 // at most 50 rows and a strict byte budget; the cursor resumes at the actual
 // last delivered row, so smaller pages never omit results or alter counts.
 while(items.length>1&&Buffer.byteLength(JSON.stringify(response()))>100000){if(point?.direction==="before"){items.shift();startIndex++;}else items.pop();}
 return response();
}

// Canonical sorting is ascending in every mode. Only the target page joins its
// JSON summaries: counting/ranking never materializes all summary bodies.
export function repairListSql(tx:TransactionSql,scope:BackendReadScope,context:ReadContext,group?:string,point:Point|null=null,anchor?:string,seek?:number,explain=false) {
 const {query,groups}=context,needle=listSearchNeedle(query.q),reverse=point?.direction==="before",hasPoint=Boolean(point||anchor||seek!==undefined);
 const order=query.sort==="created"?tx`created_at,id`:query.sort==="priority"?tx`priority,updated_at,created_at,id`:tx`updated_at,created_at,id`;
 return tx`${explain?tx`explain (analyze,buffers,format json)`:tx``} with scoped as not materialized (
  select id,created_at,updated_at,priority,stage,history,current_handover,collected_unpaid,workflow_group,parts_group,notified,search from chinatech_v2_private.repair_list_sources where store_id=${scope.storeId}
 ), filtered as (
  select id,created_at,updated_at,priority,notified,case when ${query.view}='history' or ${query.groupBy}='none' then 'all' when ${query.groupBy}='parts' then parts_group when history then 'history' else workflow_group end group_key
  from scoped where (${query.view}='all' or history=(${query.view}='history')) and (${query.status} in ('all','including_cancelled') or ${query.status}='handover' and current_handover and collected_unpaid or stage=${query.status})
  and (${query.partsFilter}='all' or parts_group=${query.partsFilter}) and (${needle}='' or strpos(search,${needle})>0)
 ), configured as (select value->>'key' key,value->>'label' label,ordinal from jsonb_array_elements(${tx.json(groups)}) with ordinality a(value,ordinal)),
 metadata as (
  select c.key,c.label,c.ordinal,count(f.id)::integer count,count(f.id) filter(where f.notified)::integer notified,
   count(f.id) filter(where c.key<>'ready' or ${query.noticeFilter}='all' or f.notified=(${query.noticeFilter}='notified'))::integer visible_count
  from configured c left join filtered f on f.group_key=c.key group by c.key,c.label,c.ordinal
 ), selected as (
  select key from metadata where (${group!==undefined} and key=${group??""}) or (${group===undefined&&!(query.groupBy==="parts"&&query.view!=="history")} and count>0) order by ordinal limit 1
 ), ranked as (
  select *,row_number() over(order by ${order})-1 as rank from filtered where group_key=(select key from selected)
  and (group_key<>'ready' or ${query.noticeFilter}='all' or notified=(${query.noticeFilter}='notified'))
 ), point as (
  select id,rank from ranked where ${seek!==undefined} or id=${point?.id??anchor??""} order by rank offset greatest(0,least(${seek??0},(select count(*)-1 from ranked))) limit 1
 ), page as (
  select id,rank from ranked where ${!hasPoint} or not exists(select 1 from point)
  or (${!reverse} and (rank>(select rank from point) or ${point===null} and rank=(select rank from point)))
  or (${reverse} and rank<(select rank from point)) order by rank ${reverse?tx`desc`:tx`asc`} limit 51
 ) select (select count(*)::integer from filtered) total,
  (select jsonb_build_object('all',count(*)::integer,'active',count(*) filter(where not history)::integer,'history',count(*) filter(where history)::integer) from scoped) stats,
  coalesce((select jsonb_agg(jsonb_build_object('key',key,'label',label,'count',count,'visibleCount',visible_count,'notified',notified) order by ordinal) from metadata where ${query.groupBy==="parts"&&query.view!=="history"} or count>0),'[]') groups,
  (select key from selected) selected_group,exists(select 1 from point) point_found,(select rank::integer from point) point_rank,
  coalesce((select jsonb_agg(s.summary order by p.rank) from page p join chinatech_v2_private.repair_list_sources s on s.store_id=${scope.storeId} and s.id=p.id),'[]') items`;
}
