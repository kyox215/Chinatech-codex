import {nativeSortRulesHash} from '../server/intl-sort-contract';
import {requireNativeSortRuntime} from '../server/intl-sort-keys';
import {projectionQueryRulesHash} from "./query-rules-version";
import'server-only';
import{createHash}from'node:crypto';
import type{TransactionSql}from'postgres';
import{BackendError}from'./database';
import{backendScopeKey,type BackendReadScope}from'./read-plan';
import{retailVocabularyHash}from'./retail-vocabulary-version';
import{retailListQuery,retailFacetQuery,retailListCursor,retailReadVersionChangedCode,type RetailListQuery,type RetailListPage,type RetailListSummary,type RetailFacetQuery,type RetailFacetPage}from'./retail-list-contract';
// The original retail index uses locale-independent lowercasing, after NFKC/trim.
const retailNeedle=(value:string)=>value.normalize('NFKC').trim().toLowerCase();
export async function retailModelGeneration(tx:TransactionSql,storeId:string){
 try{requireNativeSortRuntime();}catch{throw new BackendError('后台资料暂不可用。',503);}
 const[model]=await tx`select ready,generation::text,vocabulary_hash,sort_rules_hash from chinatech_v2_private.retail_list_models where store_id=${storeId} and query_rules_hash=${projectionQueryRulesHash} and format_version=1`;
 if(!model?.ready||model.vocabulary_hash!==retailVocabularyHash||model.sort_rules_hash!==nativeSortRulesHash)throw new BackendError('后台资料暂不可用。',503);
 return String(model.generation);
}
export function retailReadToken(scope:BackendReadScope,generation:string,query:RetailListQuery|RetailFacetQuery){return createHash('sha256').update(JSON.stringify([1,retailVocabularyHash,nativeSortRulesHash,backendScopeKey(scope),projectionQueryRulesHash,generation,query])).digest('hex');}
type Point={key:string;direction:'before'|'after'};
function requireStatementModel(row:{model_available?:boolean;model_generation?:string},generation:string){
 if(row.model_available!==true)throw new BackendError('后台资料暂不可用。',503);
 if(row.model_generation!==generation)throw new BackendError('资料已更新，请刷新后重试。',409,retailReadVersionChangedCode);
}
function statementModel(tx:TransactionSql,storeId:string){return tx`select ready and format_version=1 and vocabulary_hash=${retailVocabularyHash} and query_rules_hash=${projectionQueryRulesHash} and sort_rules_hash=${nativeSortRulesHash} available,generation::text generation from chinatech_v2_private.retail_list_models where store_id=${storeId}`;}

export async function readRetailList(tx:TransactionSql,scope:BackendReadScope,raw:Partial<RetailListQuery>={},options:{cursor?:string;anchor?:string;seek?:number;generation?:string}={}):Promise<RetailListPage>{
 if(!scope.permissions.includes('retail.view'))throw new BackendError('当前账号没有此操作权限。',403);
 const query=retailListQuery(raw),generation=options.generation??await retailModelGeneration(tx,scope.storeId),stateToken=retailReadToken(scope,generation,query);
 if(options.anchor&&(!/^(unit|history):[\s\S]{1,100}$/u.test(options.anchor)||options.cursor)||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000||options.anchor||options.cursor))throw new BackendError('请求资料无效。',400);
 let point:Point|null=null;
 if(options.cursor)try{
  if(options.cursor.length>2048)throw new Error();const value=JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8'));
  if(!Array.isArray(value)||value.length!==3||typeof value[0]!=='string'||typeof value[1]!=='string'||!/^(unit|history):[\s\S]{1,100}$/u.test(value[1])||!['before','after'].includes(value[2]))throw new Error();
  if(value[0]!==stateToken)throw new BackendError('资料已更新，请刷新后重试。',409,retailReadVersionChangedCode);
  point={key:value[1],direction:value[2]};
 }catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
 const[row]=await retailListSql(tx,scope,query,point,options.anchor,options.seek,false,generation);requireStatementModel(row,generation);const values:RetailListSummary[]=row.items;
 if(point&&!row.point_found)throw new BackendError('请求资料无效。',400);
 const items=point?.direction==='before'?values.slice(-50):values.slice(0,50),rank=Number(row.point_rank);
 let startIndex=point?point.direction==='before'?Math.max(0,rank-items.length):rank+1:(options.anchor||options.seek!==undefined)&&row.point_found?rank:0;
 const selectedFacets:{category?:import('./retail-list-contract').RetailFacet;status?:import('./retail-list-contract').RetailFacet}={};
 for(const kind of['category','status']as const)if(query[kind]!=='all'){const facet=await readRetailFacets(tx,scope,{view:query.view,kind,key:query[kind]},generation);if(facet.items[0])selectedFacets[kind]=facet.items[0];}
 const response=():RetailListPage=>({formatVersion:1,scope,generation,query,stateToken,total:Number(row.total),viewCounts:row.view_counts,conditionCounts:row.condition_counts,...(query.category!=='all'||query.status!=='all'?{selectedFacets}:{}),items,startIndex,previousCursor:startIndex&&items[0]?retailListCursor(stateToken,items[0].key,'before'):null,nextCursor:startIndex+items.length<Number(row.total)&&items.at(-1)?retailListCursor(stateToken,items.at(-1)!.key,'after'):null});
 while(items.length>1&&Buffer.byteLength(JSON.stringify(response()))>100000){if(point?.direction==='before'){items.shift();startIndex++;}else items.pop();}
 return response();
}

// All ranking/count/search operate on narrow, transactionally projected facts.
// Wide original display fields are joined only for the chosen <=51 rows.
export function retailListSql(tx:TransactionSql,scope:BackendReadScope,query:RetailListQuery,point:Point|null=null,anchor?:string,seek?:number,explain=false,expectedGeneration?:string){
 const needle=retailNeedle(query.q),financial=scope.permissions.includes('financial.read'),reverse=point?.direction==='before',hasPoint=Boolean(point||anchor||seek!==undefined);
 const tie=tx`sort_tie`,stable=tx`case source when 'history' then 0 else 1 end,source_row nulls last,id collate "C"`,order=query.sort==='name-asc'?tx`sort_name,${tie},${stable}`:query.sort==='sold-newest'?tx`sort_sale desc nulls last,${tie},${stable}`:query.sort==='price-asc'?tx`price_cents asc nulls last,${tie},${stable}`:query.sort==='price-desc'?tx`price_cents desc nulls last,${tie},${stable}`:query.sort==='oldest'?tx`sort_intake,${tie},${stable}`:tx`sort_intake desc,sort_tie desc,${stable}`;
 return tx`${explain?tx`explain(analyze,buffers,format json)`:tx``}with model as materialized(${statementModel(tx,scope.storeId)}),scoped as not materialized(
  select s.key,s.view,s.condition,s.category_key,s.status_key,s.review_count,s.sort_name,s.sort_tie,s.sort_intake,s.sort_sale,s.source,s.source_row,s.id,s.price_cents,${financial?tx`coalesce(f.search,s.search)`:tx`s.search`} search
  from chinatech_v2_private.retail_list_sources s ${financial?tx`left join chinatech_v2_private.retail_list_financial_search f on f.store_id=s.store_id and f.key=s.key`:tx``}
  where s.store_id=${scope.storeId} and exists(select 1 from model where available and (${expectedGeneration??null}::text is null or generation=${expectedGeneration??null})) and s.active and (s.source='unit' or not exists(select 1 from chinatech_v2_private.retail_list_sources u where u.store_id=s.store_id and u.source='unit' and u.origin_id=s.id and u.active))
 ), filtered as(
  select key,condition,sort_name,sort_tie,sort_intake,sort_sale,source,source_row,id,price_cents from scoped where view=${query.view}
  and (${needle}='' or strpos(search,${needle})>0) and (${query.category}='all' or category_key=${query.category})
  and (${query.status}='all' or status_key=${query.status}) and (${!query.review} or review_count>0)
 ), ranked as(
  select key,row_number() over(order by ${order})-1 rank from filtered where ${query.condition}='all' or condition=${query.condition}
 ), point as(
  select key,rank from ranked where ${seek!==undefined} or key=${point?.key??anchor??''}
  order by rank offset greatest(0,least(${seek??0},(select count(*)-1 from ranked))) limit 1
 ), page as(
  select * from ranked where ${!hasPoint} or not exists(select 1 from point)
   or (${!reverse} and (rank>(select rank from point) or ${point===null} and rank=(select rank from point)))
   or (${reverse} and rank<(select rank from point)) order by ${reverse?tx`rank desc`:tx`rank`} limit 51
 )select(select available from model)model_available,(select generation from model)model_generation,(select count(*)::integer from ranked) total,exists(select 1 from point) point_found,(select rank from point) point_rank,
 (select jsonb_build_object('available',count(*)filter(where view='available')::integer,'sold',count(*)filter(where view='sold')::integer,'other',count(*)filter(where view='other')::integer) from scoped) view_counts,
 (select jsonb_build_object('all',count(*)::integer,${'新机'}::text,count(*)filter(where condition=${'新机'})::integer,${'翻新机'}::text,count(*)filter(where condition=${'翻新机'})::integer) from filtered) condition_counts,
 coalesce((select jsonb_agg(${retailSummarySql(tx)} order by p.rank)
 from page p join chinatech_v2_private.retail_list_sources s on s.store_id=${scope.storeId} and s.key=p.key),'[]'::jsonb)items`;
}

export async function readRetailFacets(tx:TransactionSql,scope:BackendReadScope,raw:Partial<RetailFacetQuery>={},generation?:string):Promise<RetailFacetPage>{
 if(!scope.permissions.includes('retail.view'))throw new BackendError('当前账号没有此操作权限。',403);
 const query=retailFacetQuery(raw),version=generation??await retailModelGeneration(tx,scope.storeId),field=query.kind==='category'?tx`category`:tx`status`,key=query.kind==='category'?tx`category_key`:tx`status_key`,order=query.kind==='category'?tx`category_order`:tx`status_order`,needle=retailNeedle(query.q);
 const search=query.kind==='category'?tx`s.category_search`:tx`s.status_search`;
 const[row]=await tx`with model as materialized(${statementModel(tx,scope.storeId)}),facets as(
  select ${key} key,min(s.key) source_key,count(*)::integer count from chinatech_v2_private.retail_list_sources s where store_id=${scope.storeId} and exists(select 1 from model where available and generation=${version}) and active and view=${query.view}
  and(source='unit' or not exists(select 1 from chinatech_v2_private.retail_list_sources u where u.store_id=s.store_id and u.source='unit' and u.origin_id=s.id and u.active))group by ${key}
 ),matches as(select f.key,f.count,${field} label,${order} label_order from facets f join chinatech_v2_private.retail_list_sources s on s.store_id=${scope.storeId} and s.key=f.source_key where (${query.key}='all' or f.key=${query.key})and(${needle}='' or strpos(${search},${needle})>0))
 select(select available from model)model_available,(select generation from model)model_generation,(select count(*)::integer from matches)total,coalesce((select jsonb_agg(jsonb_build_object('key',key,'label',left(label,160),'preview',length(label)>160,'count',count)order by label_order)from(select * from matches order by label_order limit 12)p),'[]'::jsonb)items`;
 requireStatementModel(row,version);return{formatVersion:1,scope,generation:version,query,stateToken:retailReadToken(scope,version,query),total:Number(row.total),items:row.items};
}

export function retailSummarySql(tx:TransactionSql){return tx`jsonb_build_object('key',s.key,'id',s.id,'source',s.source,'view',s.view,'code',left(s.code,100),'title',left(s.title,200),'condition',s.condition,'category',left(s.category,160),'color',left(s.color,100),'specification',left(s.specification,240),'specificationFacts',case when s.specification_facts is not null then jsonb_set(s.specification_facts,'{edition}',to_jsonb(left(s.specification_facts->>'edition',160))) else null end,'identifier',left(s.identifier,160),'phone',left(s.phone,100),'intakeDate',s.intake_date,'pickupDate',s.pickup_date,'saleSortDate',s.sale_sort_date,'priceCents',s.price_cents,'salePriceCents',s.sale_price_cents,'status',left(s.status,160),'reviewCount',s.review_count)
 ||case when length(s.code)>100 or length(s.title)>200 or length(s.category)>160 or length(s.color)>100 or length(s.specification)>240 or length(s.identifier)>160 or length(s.phone)>100 or length(s.status)>160 or length(s.specification_facts->>'edition')>160 then jsonb_build_object('previews',to_jsonb(array_remove(array[case when length(s.code)>100 then 'code' end,case when length(s.title)>200 then 'title' end,case when length(s.category)>160 then 'category' end,case when length(s.color)>100 then 'color' end,case when length(s.specification)>240 then 'specification' end,case when length(s.identifier)>160 then 'identifier' end,case when length(s.phone)>100 then 'phone' end,case when length(s.status)>160 then 'status' end,case when length(s.specification_facts->>'edition')>160 then 'edition' end],null))) else '{}'::jsonb end`;}
