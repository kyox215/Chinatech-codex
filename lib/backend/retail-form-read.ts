import {projectionQueryRulesHash} from "./query-rules-version";
import'server-only';
import{createHash}from'node:crypto';
import type{TransactionSql}from'postgres';
import{canonicalCatalogBrand,catalogSearchTerms,catalogNormalize,catalogBrandAliases}from'../device-catalog';
import{retailCatalogOptions}from'../retail-catalog';
import{normalizeIdentifier,normalizeImei,type RetailUnit}from'../retail';
import{BackendError}from'./database';
import{backendScopeKey,type BackendReadScope}from'./read-plan';
import{retailModelGeneration}from'./retail-list-read';
import{retailFormKnownBrands,retailFormBrandKeyMax}from'./retail-form-rules-version';
import{retailFormModelFormat,retailFormProjectionHash}from'./unicode17-version';
import{retailFormCandidateQuery,type RetailCreationDefaults,type RetailFormCandidatePage,type RetailFormCandidateValue,type RetailFormCandidateQuery,type RetailIdentityCheck}from'./retail-form-contract';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const valueKey=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const brandSearch=retailFormKnownBrands.map(brand=>({brand,aliases:catalogBrandAliases(brand).slice(1).map(catalogNormalize)}));
export async function retailFormGeneration(tx:TransactionSql,storeId:string){
 const[model]=await tx`select ready,generation::text,rules_hash from chinatech_v2_private.retail_form_models where store_id=${storeId} and query_rules_hash=${projectionQueryRulesHash} and format_version=${retailFormModelFormat}`;
 if(!model?.ready||model.rules_hash!==retailFormProjectionHash)throw new BackendError('后台资料暂不可用。',503);
 return String(model.generation);
}
export async function readRetailCreationDefaults(tx:TransactionSql,scope:BackendReadScope,copyId?:string):Promise<RetailCreationDefaults>{
 if(!scope.permissions.includes('retail.view')||!scope.permissions.includes('retail.edit'))throw new BackendError('当前账号没有此操作权限。',403);
 const[row]=await tx`select (settings->>'revision')::integer revision,(settings->>'retailWarrantyMonths')::integer warranty_months from chinatech_v2_private.store_state where store_id=${scope.storeId}`;
 if(!row)throw new BackendError('门店尚未完成初始化。',503);
 const[target]=copyId?await tx`select jsonb_build_object('id',id,'code',data->'code','category',data->'category','brand',data->'brand','model',data->'model','color',data->'color','ramGb',data->'ramGb','bodyStorage',data->'bodyStorage','disks',data->'disks','cpu',data->'cpu','gpu',data->'gpu','keyboard',data->'keyboard','edition',data->'edition','productCode',data->'productCode') facts from chinatech_v2_private.retail_units where store_id=${scope.storeId} and id=${copyId}`:[];
 return{revision:Number(row.revision),warrantyMonths:row.warranty_months,copy:target?.facts??null};
}
function presets(query:RetailFormCandidateQuery){
 if(query.field==='brand'||query.field==='model')return[];
 return retailCatalogOptions(query.field,query.category,query.brand).map((row,index)=>({...row,key:hash(row.value),valueKeyHash:hash(valueKey(row.value)),search:[row.value,row.label,row.detail??''].join(' ').toLowerCase(),position:index}));
}
function applies(query:RetailFormCandidateQuery){return query.field==='cpu'||query.field==='gpu'?['laptop','desktop'].includes(query.category):query.field==='keyboard'?query.category==='laptop':query.field==='edition'?['phone','tablet','console'].includes(query.category):true;}
export async function readRetailFormCandidates(tx:TransactionSql,scope:BackendReadScope,raw:unknown):Promise<RetailFormCandidatePage|RetailFormCandidateValue>{
 if(!scope.permissions.includes('retail.view')||!scope.permissions.includes('retail.edit'))throw new BackendError('当前账号没有此操作权限。',403);
 const query=retailFormCandidateQuery(raw),generation=await retailFormGeneration(tx,scope.storeId),stateToken=hash(JSON.stringify([1,'retail-form',retailFormProjectionHash,backendScopeKey(scope),projectionQueryRulesHash,generation,query]));
 const rows=presets(query),terms=catalogSearchTerms(query.q),needle=query.q.toLowerCase(),identity=query.field==='brand'||query.field==='model',brand=canonicalCatalogBrand(query.brand),termRows=terms.map(term=>({term,brands:query.field==='brand'?brandSearch.filter(row=>row.aliases.some(alias=>alias.includes(term))).map(row=>row.brand):[]}));
 const[row]=await tx`with query_terms as(select * from jsonb_to_recordset(${tx.json(termRows)})as x(term text,brands text[])),presets as(
  select key option_key,"valueKeyHash" value_key_hash,search,position,value,label,detail from jsonb_to_recordset(${tx.json(rows)})as x(key text,"valueKeyHash" text,search text,position integer,value text,label text,detail text)
 ),recorded as(
  select unit_id,option_key,value_key_hash,catalog_key_hash from chinatech_v2_private.retail_form_values where store_id=${scope.storeId} and field=${query.field} and category=${query.category} and ${applies(query)} and(${query.field!=='model'||!query.brand} or brand_key_hash=${hash(brand)} and brand_key=${brand})
 ),candidates as(
  select option_key,value_key_hash dedupe_key,0 priority,position,''::text unit_id from presets
  union all select option_key,${query.field==='brand'?tx`catalog_key_hash`:query.field==='model'?tx`option_key`:tx`value_key_hash`},1,0,unit_id from recorded
 ),deduped as(
  select distinct on(dedupe_key)option_key,priority,position,unit_id from candidates order by dedupe_key,priority,position,unit_id
 ),matches as(
  select * from deduped d where(${query.key}=''or d.option_key=${query.key})and(${Boolean(query.key)} or d.priority=0 and exists(select 1 from presets p where p.option_key=d.option_key and(${needle}=''or strpos(p.search,${needle})>0))or d.priority=1 and exists(
   select 1 from chinatech_v2_private.retail_form_values v where v.store_id=${scope.storeId} and v.unit_id=d.unit_id and v.field=${query.field} and ${identity?tx`not exists(select 1 from query_terms t where strpos(v.catalog_key,t.term)=0 and not(v.brand_key=any(t.brands)))`:tx`(${needle}=''or strpos(v.search,${needle})>0)`}
  ))
 ),page as(select * from matches order by priority,position,unit_id limit ${query.key?1:12})
 select(select count(*)::integer from matches)total,coalesce((select jsonb_agg(jsonb_build_object('key',p.option_key,'value',coalesce(pr.value,v.value),'detail',coalesce(pr.detail,${'已登记值 · 实物仍须核对'}::text))order by p.priority,p.position,p.unit_id)from page p left join presets pr on p.priority=0 and pr.option_key=p.option_key left join chinatech_v2_private.retail_form_values v on p.priority=1 and v.store_id=${scope.storeId} and v.unit_id=p.unit_id and v.field=${query.field}),'[]'::jsonb)items`;
 if(query.key){const found=row.items[0];if(!found)throw new BackendError('资料已更新，请刷新后重试。',409);return{formatVersion:1,scope,query,key:found.key,value:found.value};}
 return{formatVersion:1,scope,generation,query,stateToken,total:Number(row.total),items:row.items.map((item:{key:string;value:string;detail?:string})=>{const catalogKey=query.field==='brand'?catalogNormalize(item.value):null;return{key:item.key,label:[...item.value].slice(0,160).join(''),preview:[...item.value].length>160,...(item.detail?{detail:item.detail}:{}),...(query.field==='brand'?{catalogKey:catalogKey!.length<=retailFormBrandKeyMax?catalogKey:null}:{})};})};
}
export async function readRetailIdentityConflict(tx:TransactionSql,scope:BackendReadScope,raw:Pick<RetailUnit,'id'|'code'|'brand'|'serial'|'imei1'|'imei2'>):Promise<RetailIdentityCheck|null>{
 if(!scope.permissions.includes('retail.view')||!scope.permissions.includes('retail.edit'))throw new BackendError('当前账号没有此操作权限。',403);
 if(!raw||typeof raw!=='object'||Object.keys(raw).some(key=>!['id','code','brand','serial','imei1','imei2'].includes(key))||['id','code','brand','serial','imei1','imei2'].some(key=>typeof raw[key as keyof typeof raw]!=='string'||raw[key as keyof typeof raw].length>(key==='id'?100:5000)))throw new BackendError('请求资料无效。',400);
 const imeis=[raw.imei1,raw.imei2].map(normalizeImei).filter(Boolean);if(imeis.length===2&&imeis[0]===imeis[1])throw new BackendError('同一台的 IMEI 1 与 IMEI 2 不能重复。',400);
 await retailModelGeneration(tx,scope.storeId);
 const code=normalizeIdentifier(raw.code),serial=normalizeIdentifier(raw.serial),brand=normalizeIdentifier(raw.brand),imeiHashes=imeis.map(hash);
 const[row]=await tx`select id,code from chinatech_v2_private.retail_list_sources where store_id=${scope.storeId} and source='unit' and id<>${raw.id} and(${Boolean(code)} and code_hash=${hash(code)} or ${Boolean(raw.serial.trim())} and brand_hash=${hash(brand)} and serial_hash=${hash(serial)} or imei1_hash=any(${tx.array(imeiHashes,25)})or imei2_hash=any(${tx.array(imeiHashes,25)}))order by id limit 1`;
 return row?{id:row.id,code:row.code}:null;
}
