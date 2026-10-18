// Shared original operator implementation. Entry points own target admission, connection and reporting.
import {requireProjectionQueryContract} from "./query-contract-verifier.mjs";
import assert from 'node:assert/strict';
import {verifyRepairProjection} from './repair-projection-verifier.mjs';
export async function runOperator({sql,storeId}) {
const lock=tx=>tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+storeId},0))`;
await sql.begin(async tx=>{
  await lock(tx);assert.equal((await tx`select count(*)::integer n from chinatech_v2.stores where id=${storeId}`)[0].n,1);
  await requireProjectionQueryContract(tx,storeId,"procurement_list");const [procurement]=await tx`select ready from chinatech_v2_private.procurement_list_models where store_id=${storeId} and format_version=1`;assert.equal(procurement?.ready,true,'Verify and activate procurement sources first');
  await tx`insert into chinatech_v2_private.repair_list_models(store_id) values(${storeId}) on conflict do nothing`;await requireProjectionQueryContract(tx,storeId,"repair_list");
  // A previously ready model must become unavailable before it is rebuilt;
  // any failed verification leaves it explicitly unready, never falsely live.
  await tx`update chinatech_v2_private.repair_list_models set ready=false,backfill_cursor=case when ready then null else backfill_cursor end,verified_at=null where store_id=${storeId}`;
 });
 let batches=0,sourceRecords=0;
 for(;;){const done=await sql.begin(async tx=>{
  await lock(tx);const [model]=await tx`select backfill_cursor from chinatech_v2_private.repair_list_models where store_id=${storeId} for update`;
  const rows=await tx`select id from chinatech_v2_private.repair_intakes where store_id=${storeId} and id>${model.backfill_cursor??''} order by id limit 200`;
  for(const row of rows)await tx`select chinatech_v2_private.project_repair_list(${storeId},${row.id})`;
  batches++;sourceRecords+=rows.length;if(rows.length)await tx`update chinatech_v2_private.repair_list_models set backfill_cursor=${rows.at(-1).id} where store_id=${storeId}`;return rows.length<200;
 });if(done)break;}
 const verified=await sql.begin('isolation level serializable',async tx=>{
  await lock(tx);await requireProjectionQueryContract(tx,storeId,"repair_list");await requireProjectionQueryContract(tx,storeId,"procurement_list");const [procurement]=await tx`select ready from chinatech_v2_private.procurement_list_models where store_id=${storeId}`;assert.equal(procurement?.ready,true,'Related projection must remain verified');
  const result=await verifyRepairProjection(tx,storeId);
  await tx`update chinatech_v2_private.repair_list_models set ready=true,generation=generation+1,verified_at=now() where store_id=${storeId}`;return result;
 });
 return ({pass:true,storeId,batchLimit:200,batches,sourceRecords,...verified,activated:true,condition:'Local owner-only bounded canonical verification under the store lock; independent fact semantics are tested separately. No production activation or throughput claim.'});
}
