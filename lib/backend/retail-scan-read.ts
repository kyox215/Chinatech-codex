import'server-only';
import{createHash}from'node:crypto';
import type{TransactionSql}from'postgres';
import{normalizeIdentifier,normalizeImei}from'../retail';
import{BackendError}from'./database';
import{backendScopeKey,type BackendReadScope}from'./read-plan';
import{retailVocabularyHash}from'./retail-vocabulary-version';
import{retailScanQuery,type RetailScanQuery,type RetailScanPage}from'./retail-scan-contract';
import{retailModelGeneration}from'./retail-list-read';
import{retailReadVersionChangedCode}from'./retail-list-contract';
export async function readRetailScan(tx:TransactionSql,scope:BackendReadScope,raw:Partial<RetailScanQuery>,options:{cursor?:string;seek?:number}={}):Promise<RetailScanPage>{
 if(!scope.permissions.includes('retail.view'))throw new BackendError('当前账号没有此操作权限。',403);
 let query:RetailScanQuery;try{query=retailScanQuery(raw);}catch(error){throw new BackendError(error instanceof Error?error.message:'请求资料无效。',400);}
 const generation=await retailModelGeneration(tx,scope.storeId),stateToken=createHash('sha256').update(JSON.stringify([1,'retail-scan',retailVocabularyHash,backendScopeKey(scope),generation,query])).digest('hex');
 let offset=options.seek??0;
 if(options.cursor)try{if(options.cursor.length>1024||options.seek!==undefined)throw new Error();const point=JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8'));if(!Array.isArray(point)||point.length!==2)throw new Error();if(point[0]!==stateToken)throw new BackendError('资料已更新，请刷新后重试。',409,retailReadVersionChangedCode);offset=point[1];}catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new BackendError('请求资料无效。',400);
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex'),normal=hash(normalizeIdentifier(query.raw)),imei=hash(normalizeImei(query.raw));
 const match=query.kind==='internal'?tx`s.code_hash=${normal}`:query.kind==='serial'?tx`s.serial_hash=${normal}`:query.kind==='product'?tx`s.product_hash=${normal}`:tx`(s.source='unit' and(s.imei1_hash=${imei} or s.imei2_hash=${imei})or s.source='history' and s.serial_hash=${normal})`;
 const[row]=await tx`with matches as(
  select s.key,s.source,s.source_row from chinatech_v2_private.retail_list_sources s where s.store_id=${scope.storeId} and s.active and ${match}
  and(s.source='unit'or not exists(select 1 from chinatech_v2_private.retail_list_sources u where u.store_id=s.store_id and u.source='unit' and u.active and u.origin_id=s.id))
 ),ranked as(select *,row_number()over(order by case when source='unit'then 0 else 1 end,case when source='unit'then key end,source_row,key)-1 rank from matches),point as(select case when ${offset}>=count(*)then greatest(0,count(*)-50)else ${offset} end start from ranked),page as(select * from ranked where rank>=(select start from point)order by rank limit 50)
 select(select count(*)::integer from matches)total,(select start from point)::integer start_index,coalesce((select jsonb_agg(jsonb_build_object('key',s.key,'id',s.id,'source',s.source,'code',left(s.code,100),'title',left(s.title,200),'status',left(s.status,160))||case when length(s.code)>100 or length(s.title)>200 or length(s.status)>160 then jsonb_build_object('previews',to_jsonb(array_remove(array[case when length(s.code)>100 then 'code' end,case when length(s.title)>200 then 'title' end,case when length(s.status)>160 then 'status' end],null)))else '{}'::jsonb end order by p.rank)from page p join chinatech_v2_private.retail_list_sources s on s.store_id=${scope.storeId} and s.key=p.key),'[]'::jsonb)items`;
 const items=row.items,startIndex=Number(row.start_index),response=():RetailScanPage=>({formatVersion:1,scope,generation,query,raw:JSON.stringify(query),stateToken,total:Number(row.total),startIndex,items,nextCursor:startIndex+items.length<Number(row.total)?Buffer.from(JSON.stringify([stateToken,startIndex+items.length])).toString('base64url'):null});
 while(items.length>1&&Buffer.byteLength(JSON.stringify(response()))>100000)items.pop();
 return response();
}
