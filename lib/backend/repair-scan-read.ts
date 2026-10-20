import {projectionQueryRulesHash} from "./query-rules-version";
import "server-only";
import {createHash} from "node:crypto";
import type {TransactionSql} from "postgres";
import {repairScanCode} from "../repair-scan";
import {BackendError} from "./database";
import {backendScopeKey,type BackendReadScope} from "./read-plan";
import {repairScanVersionChangedCode,type RepairScanPage} from "./repair-scan-contract";

/** Exact identifier lookup; no workflow/signature/photo/canonical JSON leaves SQL. */
export async function readRepairScan(tx:TransactionSql,scope:BackendReadScope,raw:string,origin:string,options:{cursor?:string;seek?:number}={}):Promise<RepairScanPage>{
 if(!scope.permissions.includes("repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
 if(typeof raw!=="string"||raw.trim().length>512||options.cursor&&options.seek!==undefined||options.seek!==undefined&&(!Number.isSafeInteger(options.seek)||options.seek<0||options.seek>1000000))throw new BackendError("请求资料无效。",400);
 const code=repairScanCode(raw,origin);
 const [model]=await tx`select generation::text,ready from chinatech_v2_private.repair_list_models where store_id=${scope.storeId} and query_rules_hash=${projectionQueryRulesHash} and format_version=1`;
 if(!model?.ready)throw new BackendError("后台资料暂不可用。",503);
 const generation=String(model.generation),stateToken=createHash("sha256").update(JSON.stringify([1,backendScopeKey(scope),projectionQueryRulesHash,generation,code])).digest("hex");
 let startIndex=options.seek??0;
 if(options.cursor)try{if(options.cursor.length>1024)throw 0;const cursor=JSON.parse(Buffer.from(options.cursor,"base64url").toString());if(cursor.token!==stateToken)throw new BackendError("资料已更新，请刷新后重试。",409,repairScanVersionChangedCode);if(!Number.isSafeInteger(cursor.offset)||cursor.offset<0||cursor.offset>1000000)throw 0;startIndex=cursor.offset;}catch(error){if(error instanceof BackendError)throw error;throw new BackendError("请求资料无效。",400);}
 if(code===null)return{scope,raw,generation,stateToken,startIndex:0,total:0,items:[],nextCursor:null};
 const [row]=await tx`with matched as materialized (
  select id from chinatech_v2_private.repair_intakes where store_id=${scope.storeId}
  and ((pg_catalog.md5(chinatech_v2_private.query_upper(id))=pg_catalog.md5(${code}) and chinatech_v2_private.query_upper(id)=${code}) or (pg_catalog.md5(chinatech_v2_private.query_upper(chinatech_v2_private.directory_trim(data->>'serial')))=pg_catalog.md5(${code}) and chinatech_v2_private.query_upper(chinatech_v2_private.directory_trim(data->>'serial'))=${code}))
 ), position as (select case when ${startIndex}>=(select count(*) from matched) then greatest(0,(select count(*) from matched)-50) else ${startIndex} end::integer as start_index),
 page as (select id from matched order by id offset (select start_index from position) limit 50)
 select (select count(*)::integer from matched) total,(select start_index from position) start_index,
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'model',r.data->>'model','serial',r.data->>'serial') order by r.id) from page p join chinatech_v2_private.repair_intakes r on r.store_id=${scope.storeId} and r.id=p.id),'[]') items`;
 startIndex=Number(row.start_index);
 const total=Number(row.total),items=row.items as RepairScanPage["items"],next=startIndex+items.length;
 return{scope,raw,generation,stateToken,startIndex,total,items,nextCursor:next<total?Buffer.from(JSON.stringify({token:stateToken,offset:next})).toString("base64url"):null};
}
