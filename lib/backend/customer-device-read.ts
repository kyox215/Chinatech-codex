import {projectionQueryRulesHash} from "./query-rules-version";
import'server-only';
import{createHash} from'node:crypto';
import type{TransactionSql} from'postgres';
import{BackendError} from'./database';
import{backendScopeKey,type BackendReadScope} from'./read-plan';
import{customerDeviceRulesHash,customerDeviceFormat} from'./customer-device-version';
import{customerDeviceQuery,customerDeviceCursor,customerDeviceVersionChangedCode,type CustomerDeviceQuery,type CustomerDevicePage,type CustomerDeviceSummary,type CustomerDeviceRecordSummary} from'./customer-device-contract';
export async function customerDeviceGeneration(tx:TransactionSql,storeId:string){
 const[row]=await tx`select ready,generation::text,rules_hash from chinatech_v2_private.customer_device_models where store_id=${storeId} and query_rules_hash=${projectionQueryRulesHash} and format_version=${customerDeviceFormat}`;
 if(!row?.ready||row.rules_hash!==customerDeviceRulesHash)throw new BackendError('后台资料暂不可用。',503);return String(row.generation);
}
type Point={id:string;direction:'before'|'after'};
type Options={generation?:string;cursor?:string;anchor?:string;seek?:number;known?:string};
export async function readCustomerDevices(tx:TransactionSql,scope:BackendReadScope,raw:Partial<CustomerDeviceQuery>,options:Options={}):Promise<CustomerDevicePage|{unchanged:true;stateToken:string}>{
 if(!scope.permissions.some(p=>p==='repairs.view'||p==='retail.view'))throw new BackendError('当前账号没有此操作权限。',403);
 let query:CustomerDeviceQuery;try{query=customerDeviceQuery(raw);} catch{throw new BackendError('请求资料无效。',400);}
 if(options.anchor!==undefined&&(!options.anchor||options.anchor.length>1024||options.cursor)||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000||options.cursor||options.anchor!==undefined))throw new BackendError('请求资料无效。',400);
 const generation=options.generation??await customerDeviceGeneration(tx,scope.storeId),stateToken=createHash('sha256').update(JSON.stringify([customerDeviceFormat,customerDeviceRulesHash,backendScopeKey(scope),projectionQueryRulesHash,generation,query])).digest('hex');
 if(query.kind==='original'&&(options.cursor||options.anchor||options.seek!==undefined))throw new BackendError('请求资料无效。',400);
 if(!options.cursor&&options.seek===undefined&&options.known===stateToken)return{unchanged:true,stateToken};
 if(query.kind==='original'){const items=await customerDeviceOriginalSql(tx,scope,query.deviceId),response:CustomerDevicePage={formatVersion:customerDeviceFormat,scope,generation,query,stateToken,total:items.length,items,startIndex:0,previousCursor:null,nextCursor:null};if(Buffer.byteLength(JSON.stringify(response))>100000)throw new BackendError('后台资料暂不可用。',503);return response;}
 let point:Point|null=null;
 if(options.cursor)try{
  if(options.cursor.length>2048)throw new Error();const value=JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8'));
  if(!Array.isArray(value)||value.length!==3||typeof value[0]!=='string'||typeof value[1]!=='string'||!value[1]||value[1].length>1024||!['before','after'].includes(value[2]))throw new Error();
  if(value[0]!==stateToken)throw new BackendError('资料已更新，请刷新后重试。',409,customerDeviceVersionChangedCode);point={id:value[1],direction:value[2]};
 } catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
 const[row]=await customerDevicesSql(tx,scope,query,point,options.anchor,options.seek);
 if(point&&!row.point_found)throw new BackendError('请求资料无效。',400);
 const values:Array<CustomerDeviceSummary|CustomerDeviceRecordSummary>=row.items,reverse=point?.direction==='before',items=reverse?values.slice(-50):values.slice(0,50),rank=Number(row.point_rank);
 let startIndex=point?reverse?Math.max(0,rank-items.length):rank+1:(options.anchor||options.seek!==undefined)&&row.point_found?rank:0;
 const response=():CustomerDevicePage=>({formatVersion:customerDeviceFormat,scope,generation,query,stateToken,total:Number(row.total),items,startIndex,previousCursor:startIndex>0&&items[0]?customerDeviceCursor(stateToken,items[0].id,'before'):null,nextCursor:startIndex+items.length<Number(row.total)&&items.at(-1)?customerDeviceCursor(stateToken,items.at(-1)!.id,'after'):null});
 while(items.length>1&&Buffer.byteLength(JSON.stringify(response()))>100000){if(reverse){items.shift();startIndex++;} else items.pop();} return response();
}
export function customerDevicesSql(tx:TransactionSql,scope:BackendReadScope,query:CustomerDeviceQuery,point:Point|null=null,anchor?:string,seek?:number,explain=false){
 const reverse=point?.direction==='before',hasPoint=Boolean(point||anchor||seek!==undefined),needle=query.q.toLowerCase();
 const ranked=query.kind==='devices'?tx`
  with records as materialized(
   select f.device_id,r.kind,r.origin_id,r.event_order,r.event_at,r.event_lex,r.search from chinatech_v2_private.customer_device_records r join chinatech_v2_private.customer_device_facts f using(store_id,kind,origin_id)where r.store_id=${scope.storeId}
  ),first_facts as(
   select distinct on(f.device_id)f.device_id,f.kind,f.origin_id from chinatech_v2_private.customer_device_facts f where f.store_id=${scope.storeId} and exists(select 1 from records r where r.kind=f.kind and r.origin_id=f.origin_id)order by f.device_id,case f.kind when'repair'then 0 else 1 end,f.origin_id
  ),latest as(select distinct on(device_id)device_id,event_at from records order by device_id,event_lex desc),
  totals as(select device_id,count(*)::integer record_count from records group by device_id),
  filtered as(
   select f.device_id,f.kind,f.origin_id,t.record_count,l.event_at from first_facts f join totals t using(device_id)join latest l using(device_id)join chinatech_v2_private.customer_device_facts meta on meta.store_id=${scope.storeId} and meta.kind=f.kind and meta.origin_id=f.origin_id where ${needle}=''or
   case when ${needle.includes(' ')} then strpos(meta.search||' '||(select string_agg(r.search,' 'order by case r.kind when'repair'then 0 else 1 end,r.origin_id,r.event_order)from records r where r.device_id=f.device_id),${needle})>0
   else strpos(meta.search,${needle})>0 or exists(select 1 from records r where r.device_id=f.device_id and strpos(r.search,${needle})>0)end
  )select device_id id,row_number()over(order by event_at collate chinatech_v2_private.customer_record_dates desc,case kind when'repair'then 0 else 1 end,origin_id)-1 rank,
   kind,origin_id,null::text event_id,record_count,event_at from filtered
 `:tx`
  select jsonb_build_array(r.kind,r.origin_id,r.event_id)::text id,row_number()over(order by r.event_at collate chinatech_v2_private.customer_record_dates desc,case r.kind when'repair'then 0 else 1 end,r.origin_id,r.event_order)-1 rank,
   r.kind,r.origin_id,r.event_id,null::integer record_count,r.event_at
  from chinatech_v2_private.customer_device_records r join chinatech_v2_private.customer_device_facts f using(store_id,kind,origin_id)where r.store_id=${scope.storeId} and f.device_id=${query.deviceId}
 `;
 return tx`${explain?tx`explain(analyze,buffers,format json)`:tx``} with ranked as materialized(${ranked}),point as(
  select id,rank from ranked where ${seek!==undefined} or id=${point?.id??anchor??''} order by rank offset greatest(0,least(${seek??0},(select count(*)-1 from ranked)))limit 1
 ),page as(
  select * from ranked where ${!hasPoint} or not exists(select 1 from point)or(${!reverse} and(rank>(select rank from point)or ${point===null} and rank=(select rank from point)))or(${reverse} and rank<(select rank from point))order by rank ${reverse?tx`desc`:tx`asc`} limit 51
 )select(select count(*)from ranked)::integer total,exists(select 1 from point)point_found,(select rank from point)::integer point_rank,coalesce((select jsonb_agg(${query.kind==='devices'?tx`jsonb_build_object('id',p.id,'category',f.category,'model',left(f.model,200),'serial',left(f.serial,200),'recordCount',p.record_count,'latestAt',p.event_at,'previews',case when length(f.model)>200 then'["model"]'::jsonb else'[]'::jsonb end||case when length(f.serial)>200 then'["serial"]'::jsonb else'[]'::jsonb end)`:tx`jsonb_build_object('id',p.id,'displayId',r.display_id,'phone',r.phone,'time',p.event_at,'type',p.kind,'href',case p.kind when'repair'then'/app/repairs/'else'/app/retail/units/'end||p.origin_id)`} order by p.rank)from page p join chinatech_v2_private.customer_device_facts f on f.store_id=${scope.storeId} and f.kind=p.kind and f.origin_id=p.origin_id ${query.kind==='records'?tx`join chinatech_v2_private.customer_device_records r on r.store_id=f.store_id and r.kind=p.kind and r.origin_id=p.origin_id and r.event_id=p.event_id`:tx``}),'[]')items`;
}

/** Only an explicit expansion reads full metadata for this authorized physical
 * identity; history rows never duplicate the long first-source model. */
export function customerDeviceOriginalSql(tx:TransactionSql,scope:BackendReadScope,deviceId:string):Promise<CustomerDeviceSummary[]>{
 return tx`with records as materialized(select r.kind,r.origin_id,r.event_at,r.event_lex from chinatech_v2_private.customer_device_records r join chinatech_v2_private.customer_device_facts f using(store_id,kind,origin_id)where r.store_id=${scope.storeId} and f.device_id=${deviceId})
 select f.device_id id,f.category,f.model,f.serial,(select count(*)from records)::integer "recordCount",(select event_at from records order by event_lex desc limit 1)"latestAt",'[]'::jsonb previews from chinatech_v2_private.customer_device_facts f where f.store_id=${scope.storeId} and f.device_id=${deviceId} and exists(select 1 from records r where r.kind=f.kind and r.origin_id=f.origin_id)order by case f.kind when'repair'then 0 else 1 end,f.origin_id limit 1`;
}
