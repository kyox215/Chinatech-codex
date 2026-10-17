import'server-only';
import{createHash}from'node:crypto';
import type{TransactionSql}from'postgres';
import{BackendError}from'./database';
import{backendScopeKey,type BackendReadScope}from'./read-plan';
import{customerRecordRulesHash}from'./customer-detail-version';
import{customerModelGeneration,readCustomerList}from'./customer-list';
import{listSearchNeedle}from'./list-search';
import{customerRecordVersionChangedCode,customerDetailFormat,customerRecordsQuery,customerRecordCursor,type CustomerDetailPage,type CustomerDetailProfile,type CustomerRecordsQuery,type CustomerRecordCounts,type CustomerRecordSummary}from'./customer-detail-contract';
export async function customerRecordGeneration(tx:TransactionSql,storeId:string){const[row]=await tx`select ready,generation::text,rules_hash from chinatech_v2_private.customer_record_models where store_id=${storeId} and format_version=${customerDetailFormat}`;if(!row?.ready||row.rules_hash!==customerRecordRulesHash)throw new BackendError('后台资料暂不可用。',503);return String(row.generation);}
export async function readCustomerDetailProfile(tx:TransactionSql,scope:BackendReadScope,id:string,directoryGeneration:string):Promise<{profile:CustomerDetailProfile|null;counts:CustomerRecordCounts}>{
 const phone='+'+id.slice(6),directory=await readCustomerList(tx,scope,phone,undefined,directoryGeneration,'exact'),customer=directory.items[0],counts={repairs:customer?.repairCount??0,sales:customer?.saleCount??0,history:customer?.historyCount??0};
 if(!customer)return{profile:null,counts};
 const[explicit]=await tx`select data from chinatech_v2_private.customers where store_id=${scope.storeId} and normalized_phone=${phone}`;
 // Only the last nonempty frozen buyer address is needed. This never selects
 // a unit/sale body, photo, payment ledger or financial field into application memory.
 const[address]=scope.permissions.includes('retail.view')?await tx`select summary->>'customerAddress'address from chinatech_v2_private.customer_record_sources where store_id=${scope.storeId} and phone=${phone} and kind='sales'and summary->>'customerAddress'<>''order by event_at collate chinatech_v2_private.customer_record_dates desc,origin_id collate chinatech_v2_private.retail_list_ties desc,event_order desc limit 1`:[];
 return{profile:{id,phone,name:customer.name,email:customer.email,note:explicit?.data.note??'',version:explicit?.data.version??0,updatedAt:explicit?.data.updatedAt??'',address:address?.address??'',lastActivity:customer.lastActivity},counts};
}
export async function customerDetailReadContext(tx:TransactionSql,scope:BackendReadScope,raw:Partial<CustomerRecordsQuery>){
 if(!scope.permissions.includes('customers.view'))throw new BackendError('当前账号没有此操作权限。',403);
 let query:CustomerRecordsQuery;try{query=customerRecordsQuery(raw);}catch{throw new BackendError('请求资料无效。',400);}
 const recordGeneration=await customerRecordGeneration(tx,scope.storeId),directoryGeneration=await customerModelGeneration(tx,scope.storeId);
 let metadata:Awaited<ReturnType<typeof readCustomerDetailProfile>>|undefined;
 if(query.kind==='auto'){metadata=await readCustomerDetailProfile(tx,scope,query.id,directoryGeneration);query={...query,kind:metadata.counts.repairs?'repairs':metadata.counts.sales?'sales':metadata.counts.history?'history':'repairs'};}
 const resolved=query as CustomerRecordsQuery&{kind:Exclude<CustomerRecordsQuery['kind'],'auto'>};
 let repairGeneration='';if(resolved.kind==='repairs'&&scope.permissions.includes('repairs.view')){const[row]=await tx`select ready,generation::text from chinatech_v2_private.repair_list_models where store_id=${scope.storeId} and format_version=1`;if(!row?.ready)throw new BackendError('后台资料暂不可用。',503);repairGeneration=String(row.generation);}
 const generation=[recordGeneration,directoryGeneration,repairGeneration].join(':'),stateToken=createHash('sha256').update(JSON.stringify([customerDetailFormat,customerRecordRulesHash,backendScopeKey(scope),generation,resolved])).digest('hex');
 return{query:resolved,generation,stateToken,metadata};
}
type Options={cursor?:string;anchor?:string;seek?:number;known?:string;context?:Awaited<ReturnType<typeof customerDetailReadContext>>};
export async function readCustomerDetail(tx:TransactionSql,scope:BackendReadScope,raw:Partial<CustomerRecordsQuery>,options:Options={}):Promise<CustomerDetailPage|{unchanged:true;stateToken:string}>{
 if(options.anchor!==undefined&&(!options.anchor||options.anchor.length>1024||options.cursor)||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000||options.cursor||options.anchor!==undefined))throw new BackendError('请求资料无效。',400);
 const context=options.context??await customerDetailReadContext(tx,scope,raw),{query:resolved,generation,stateToken}=context;let metadata=context.metadata;const query=resolved;
 if(!options.cursor&&options.seek===undefined&&options.known===stateToken)return{unchanged:true,stateToken};
 let point:{key:string;direction:'before'|'after'}|null=null;
 if(options.cursor)try{if(options.cursor.length>2048)throw new Error();const value=JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8'));if(!Array.isArray(value)||value.length!==3||typeof value[0]!=='string'||typeof value[1]!=='string'||!value[1]||value[1].length>1024||!['before','after'].includes(value[2]))throw new Error();if(value[0]!==stateToken)throw new BackendError('资料已更新，请刷新后重试。',409,customerRecordVersionChangedCode);point={key:value[1],direction:value[2]};}catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
 metadata??=await readCustomerDetailProfile(tx,scope,query.id,generation.split(':')[1]);
 const[row]=await customerRecordsSql(tx,scope,resolved,point,options.anchor,options.seek);
 if(point&&!row.point_found)throw new BackendError('请求资料无效。',400);
 const values:CustomerRecordSummary[]=row.items,reverse=point?.direction==='before',items=reverse?values.slice(-50):values.slice(0,50),rank=Number(row.point_rank);
 let startIndex=point?reverse?Math.max(0,rank-items.length):rank+1:(options.anchor||options.seek!==undefined)&&row.point_found?rank:0;
 const response=():CustomerDetailPage=>({formatVersion:customerDetailFormat,scope,generation,query:resolved,stateToken,...metadata!,total:Number(row.total),items,startIndex,previousCursor:startIndex>0&&items[0]?customerRecordCursor(stateToken,items[0].key,'before'):null,nextCursor:startIndex+items.length<Number(row.total)&&items.at(-1)?customerRecordCursor(stateToken,items.at(-1)!.key,'after'):null});
 while(items.length>1&&Buffer.byteLength(JSON.stringify(response()))>100000){if(reverse){items.shift();startIndex++;}else items.pop();}return response();
}
export function customerRecordsSql(tx:TransactionSql,scope:BackendReadScope,query:CustomerRecordsQuery&{kind:Exclude<CustomerRecordsQuery['kind'],'auto'>},point:{key:string;direction:'before'|'after'}|null=null,anchor?:string,seek?:number,explain=false){
 const needle=listSearchNeedle(query.q,true),hasPoint=Boolean(point||anchor||seek!==undefined),reverse=point?.direction==='before';
 // Sort/count/project only narrow source rows. The preview and progress joins
 // occur after LIMIT51; original canonical JSON is never fetched for the list.
 return tx`${explain?tx`explain(analyze,buffers,format json)`:tx``}with filtered as(
  select key,origin_id,event_id,event_order,event_at from chinatech_v2_private.customer_record_sources where store_id=${scope.storeId} and phone=${'+'+query.id.slice(6)} and kind=${query.kind} and(${needle}=''or strpos(search,${needle})>0)
 ),ranked as(select *,row_number()over(order by event_at collate chinatech_v2_private.customer_record_dates desc,${query.kind==='history'?tx`event_order desc,origin_id collate chinatech_v2_private.retail_list_ties`:tx`origin_id collate chinatech_v2_private.retail_list_ties,event_order`},event_id collate "C")-1 rank from filtered),
 point as(select key,rank from ranked where ${seek!==undefined} or key=${point?.key??anchor??''} order by rank offset greatest(0,least(${seek??0},(select count(*)-1 from ranked)))limit 1),
 page as(select key,origin_id,event_id,rank from ranked where ${!hasPoint} or not exists(select 1 from point)or(${!reverse} and(rank>(select rank from point)or ${point===null} and rank=(select rank from point)))or(${reverse} and rank<(select rank from point))order by rank ${reverse?tx`desc`:tx`asc`} limit 51)
 select(select count(*)from filtered)::integer total,exists(select 1 from point)point_found,(select rank from point)::integer point_rank,
 coalesce((select jsonb_agg(s.summary||${query.kind==='repairs'?tx`jsonb_build_object('progress',r.summary->'progress')`:tx`'{}'::jsonb`} order by p.rank)from page p join chinatech_v2_private.customer_record_sources s on s.store_id=${scope.storeId} and s.kind=${query.kind} and s.origin_id=p.origin_id and s.event_id=p.event_id ${query.kind==='repairs'?tx`join chinatech_v2_private.repair_list_sources r on r.store_id=s.store_id and r.id=s.origin_id`:tx``}),'[]')items`;
}
