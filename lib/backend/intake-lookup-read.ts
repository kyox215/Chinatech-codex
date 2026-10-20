import {projectionQueryRulesHash} from "./query-rules-version";
import'server-only';import{repairReadVersionChangedCode}from'./repair-list-contract';import{createHash}from'node:crypto';import type{TransactionSql}from'postgres';import{BackendError}from'./database';import{backendScopeKey,type BackendReadScope}from'./read-plan';import{intakeHistoryIdentifier}from'../repair-intake';import{localIntakeId}from'../repair-intake-record';import{intakeHistoryQuery,type IntakeHistoryPage,type IntakeDraftMetadata}from'./intake-lookup-contract';

export async function readIntakeHistory(tx:TransactionSql,scope:BackendReadScope,raw:string,options:{cursor?:string;seek?:number}={}):Promise<IntakeHistoryPage>{
 if(!scope.permissions.includes('repairs.view'))throw new BackendError('当前账号没有此操作权限。',403);
 let query;try{if(typeof raw!=='string'||raw.length>2048)throw 0;query=intakeHistoryQuery(JSON.parse(raw));}catch{throw new BackendError('请求资料无效。',400);}
 if(options.cursor&&options.seek!==undefined||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000))throw new BackendError('请求资料无效。',400);
 const[model]=await tx`select ready,generation::text from chinatech_v2_private.repair_list_models where store_id=${scope.storeId} and query_rules_hash=${projectionQueryRulesHash} and format_version=1`;
 if(!model?.ready)throw new BackendError('后台资料暂不可用。',503);
 const generation=String(model.generation),stateToken=createHash('sha256').update(JSON.stringify([1,backendScopeKey(scope),projectionQueryRulesHash,generation,query])).digest('hex');let startIndex=options.seek??0;
 if(options.cursor)try{if(options.cursor.length>1024)throw 0;const value=JSON.parse(Buffer.from(options.cursor,'base64url').toString());if(value.token!==stateToken)throw new BackendError('资料已更新，请刷新后重试。',409,repairReadVersionChangedCode);if(!Number.isSafeInteger(value.offset)||value.offset<0||value.offset>1000000)throw 0;startIndex=value.offset;}catch(error){if(error instanceof BackendError)throw error;throw new BackendError('请求资料无效。',400);}
 const key=intakeHistoryIdentifier(query.serial),imei=/^\d{15}$/.test(key),brand=query.brand.toLowerCase(),modelKey=query.model.toLowerCase(),limit=query.kind==='related'?3:50;
 const[row]=await tx`with exact as materialized (
  select id,data->>'createdAt' created_at from chinatech_v2_private.repair_intakes where store_id=${scope.storeId} and ${key}<>''
  and pg_catalog.md5(chinatech_v2_private.intake_serial_key_v2(data->>'serial'))=pg_catalog.md5(${key}) and chinatech_v2_private.intake_serial_key_v2(data->>'serial')=${key} and (${imei} or ${brand}='' or pg_catalog.md5(chinatech_v2_private.query_lower(data->>'brand'))=pg_catalog.md5(${brand}) and chinatech_v2_private.query_lower(data->>'brand')=${brand})
 ), related as not materialized (
  select r.id,r.data->>'createdAt' created_at from chinatech_v2_private.repair_intakes r where r.store_id=${scope.storeId} and ${brand}<>'' and ${modelKey}<>''
  and pg_catalog.md5(chinatech_v2_private.query_lower(r.data->>'brand'))=pg_catalog.md5(${brand}) and chinatech_v2_private.query_lower(r.data->>'brand')=${brand} and pg_catalog.md5(chinatech_v2_private.query_lower(r.data->>'model'))=pg_catalog.md5(${modelKey}) and chinatech_v2_private.query_lower(r.data->>'model')=${modelKey} and not exists(select 1 from exact e where e.id=r.id)
 ), matched as (select * from exact where ${query.kind}='exact' union all select * from related where ${query.kind}='related'),
 position as (select case when ${startIndex}>=(select count(*) from matched) then greatest(0,(select count(*) from matched)-${limit}) else ${startIndex} end::integer start_index),
 page as (select id,created_at from matched order by created_at collate "C" desc,id offset(select start_index from position) limit ${limit})
 select (select count(*)::integer from exact) exact_total,(select count(*)::integer from related) related_total,(select count(*)::integer from matched) total,(select start_index from position) start_index,
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'createdAt',p.created_at,'brand',r.data->>'brand','model',r.data->>'model','stage',s.stage)
  ||case when ${query.kind}='related' then jsonb_build_object('issue',r.data->>'issue')||case when r.data?'faults' then jsonb_build_object('faults',r.data->'faults') else '{}'::jsonb end||case when r.data?'issueNote' then jsonb_build_object('issueNote',r.data->'issueNote') else '{}'::jsonb end else '{}'::jsonb end
  order by p.created_at collate "C" desc,p.id) from page p join chinatech_v2_private.repair_intakes r on r.store_id=${scope.storeId} and r.id=p.id join chinatech_v2_private.repair_list_sources s on s.store_id=r.store_id and s.id=r.id),'[]'::jsonb) items`;
 const total=Number(row.total),items=row.items as IntakeHistoryPage['items'];startIndex=Number(row.start_index);const next=startIndex+items.length;
 return{scope,raw,query,generation,stateToken,total,exactTotal:Number(row.exact_total),relatedTotal:Number(row.related_total),startIndex,items,nextCursor:next<total?Buffer.from(JSON.stringify({token:stateToken,offset:next})).toString('base64url'):null};
}

export async function readIntakeDraftMetadata(tx:TransactionSql,scope:BackendReadScope,id:string):Promise<IntakeDraftMetadata>{
 if(!scope.permissions.includes('repairs.view')||!scope.permissions.includes('repairs.edit'))throw new BackendError('当前账号没有此操作权限。',403);
 if(typeof id!=='string'||!localIntakeId(id))throw new BackendError('请求资料无效。',400);
 const[row]=await tx`select r.id,coalesce((r.data->>'revision')::integer,1) revision,jsonb_array_length(r.signatures) signature_count,r.data->'policy' frozen_policy,
  jsonb_build_object('months',st.settings->'repairWarrantyMonths','shopName',st.settings->'shopName','address',st.settings->'address','phone',st.settings->'phone') default_policy
  from chinatech_v2_private.store_state st left join chinatech_v2_private.repair_intakes r on r.store_id=st.store_id and r.id=${id} where st.store_id=${scope.storeId}`;
 if(!row)throw new BackendError('门店尚未完成初始化。',503);
 return{id,exists:Boolean(row.id),revision:row.id?Number(row.revision):0,signatureCount:row.id?Number(row.signature_count):0,policy:row.frozen_policy??{months:row.default_policy.months,shopName:row.default_policy.shopName,address:row.default_policy.address,phone:row.default_policy.phone}};
}
