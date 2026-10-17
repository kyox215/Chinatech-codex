import {requireProjectionQueryContract} from "./lib/query-contract-verifier.mjs";
// Operator-only local proof path. Production activation requires the separately
// reviewed migration/backfill/verification/flag runbook; this never guesses a DB.
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import postgres from'postgres';
import{sourceLoader}from'../tests/helpers/typescript-source.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const at=value.indexOf('=');return[value.slice(0,at),value.slice(at+1)];})),storeId=args['--store-id'],file=args['--connection-file'];
assert.match(storeId??'',/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);assert(file,'Explicit local connection file required');
const config=JSON.parse(readFileSync(file)),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert(['55432','55442'].includes(url.port));assert.equal(url.pathname,url.port==='55432'?'/ct_perf_acceptance_icu_20261017':'/ct_perf_http_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),load=sourceLoader(),{arrivedQuantity,procurementStatus}=load('./lib/procurement');
const lock=tx=>tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+storeId},0))`;
try{
 await sql.begin(async tx=>{await lock(tx);assert.equal((await tx`select count(*)::integer n from chinatech_v2.stores where id=${storeId}`)[0].n,1);await tx`insert into chinatech_v2_private.procurement_list_models(store_id) values(${storeId}) on conflict do nothing`;await requireProjectionQueryContract(tx,storeId,"procurement_list");await tx`update chinatech_v2_private.procurement_list_models set ready=false,verified_at=null,backfill_cursor=case when ready then null else backfill_cursor end where store_id=${storeId}`;});
 let batches=0,records=0;
 for(;;){const done=await sql.begin(async tx=>{
  await lock(tx);const[model]=await tx`select ready,backfill_cursor from chinatech_v2_private.procurement_list_models where store_id=${storeId} for update`;if(model.ready)return true;
  const rows=await tx`select p.id,p.data,r.data->>'model' repair_model,coalesce(r.workflow->>'status'='cancelled',false) repair_cancelled from chinatech_v2_private.procurement_records p left join chinatech_v2_private.repair_intakes r on r.store_id=p.store_id and r.id=p.repair_id where p.store_id=${storeId} and p.id>${model.backfill_cursor??''} order by p.id limit 200`;
  for(const row of rows)await tx`select chinatech_v2_private.project_procurement_list(${storeId},${row.id},${tx.json(row.data)},${row.repair_model},${row.repair_cancelled})`;
  records+=rows.length;batches++;if(rows.length)await tx`update chinatech_v2_private.procurement_list_models set backfill_cursor=${rows.at(-1).id} where store_id=${storeId}`;
  return rows.length<200;
 });if(done)break;}
 const verified=await sql.begin('isolation level serializable',async tx=>{
  await lock(tx);await requireProjectionQueryContract(tx,storeId,"procurement_list");
  const[counts]=await tx`select (select count(*)::integer from chinatech_v2_private.procurement_records where store_id=${storeId}) canonical,(select count(*)::integer from chinatech_v2_private.procurement_list_sources where store_id=${storeId}) projected`;
  assert.equal(counts.projected,counts.canonical,'Projection must contain no extra or missing canonical records');
  let cursor='',verifiedCount=0;
  for(;;){
   const rows=await tx`select p.id,p.data,r.data->>'model' repair_model,coalesce(r.workflow->>'status'='cancelled',false) repair_cancelled from chinatech_v2_private.procurement_records p left join chinatech_v2_private.repair_intakes r on r.store_id=p.store_id and r.id=p.repair_id where p.store_id=${storeId} and p.id>${cursor} order by p.id limit 200`;
   if(!rows.length)break;
   const expected=rows.map(({data:row,repair_model,repair_cancelled})=>({id:row.id,repairId:row.repairId,repairModel:repair_model,item:row.item,supplier:row.supplier,quantity:row.quantity,arrived:arrivedQuantity(row),status:procurementStatus(row),expectedAt:row.expectedAt??'',ledgerRevision:row.events.length,hasSupplierId:Object.hasOwn(row,'supplierId'),supplierId:row.supplierId??null,specification:row.specification??null,repairCancelled:repair_cancelled,supplierKey:Object.hasOwn(row,'supplierId')?'ID:'+(row.supplierId??''):'NAME:'+row.supplier.trim(),search:[row.id,row.item,row.supplier,row.repairId,repair_model??''].join(' ').toLowerCase()}));
   const ids=rows.map(row=>row.id),actual=await tx`select id,repair_id as "repairId",repair_model as "repairModel",item,supplier,quantity,arrived,status,expected_at as "expectedAt",ledger_revision as "ledgerRevision",has_supplier_id as "hasSupplierId",supplier_id as "supplierId",specification,repair_cancelled as "repairCancelled",supplier_key as "supplierKey",search_v2 as search from chinatech_v2_private.procurement_list_sources where store_id=${storeId} and id=any(${tx.array(ids,25)}) order by id`;
   assert.deepEqual([...actual],[...expected],'Each bounded canonical ledger/model batch must match its complete derived facts');
   verifiedCount+=rows.length;cursor=rows.at(-1).id;
  }
  assert.equal(verifiedCount,counts.canonical,'Every canonical ID must be verified, including the keyset boundary');
  await tx`update chinatech_v2_private.procurement_list_models set ready=true,generation=generation+1,verified_at=now() where store_id=${storeId}`;
  return verifiedCount;
 });
 console.log(JSON.stringify({pass:true,storeId,batchLimit:200,batches,sourceRecords:records,verifiedRecords:verified,activated:true,condition:'Local owner-only bounded backfill and complete canonical-oracle verification under the existing store lock; not production throughput.'}));
}finally{await sql.end();}
