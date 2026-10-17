// Explicit local operator. Production connection/approval is a separate runbook.
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import postgres from'postgres';
import{sourceLoader}from'../tests/helpers/typescript-source.mjs';
import{retailFormCanonicalBatch,verifyRetailFormProjection}from'./lib/retail-form-projection-verifier.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const at=value.indexOf('=');return[value.slice(0,at),value.slice(at+1)];})),storeId=args['--store-id'],file=args['--connection-file'];
assert.match(storeId??'',/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i);assert(file,'Explicit project-local owner connection required');
const config=JSON.parse(readFileSync(file)),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert(['55432','55442'].includes(url.port));assert.equal(url.pathname,url.port==='55432'?'/ct_perf_acceptance_icu_20261017':'/ct_perf_http_20261017');
const{retailFormProjectionHash,retailFormModelFormat}=sourceLoader()('./lib/backend/unicode17-version'),sql=postgres(config.DB_URL,{max:1,prepare:false}),lock=tx=>tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+storeId},0))`;
try{
 await sql.begin(async tx=>{await lock(tx);assert.equal((await tx`select count(*)::integer n from chinatech_v2.stores where id=${storeId}`)[0].n,1);await tx`insert into chinatech_v2_private.retail_form_models(store_id)values(${storeId})on conflict do nothing`;await tx`update chinatech_v2_private.retail_form_models set ready=false,verified_at=null,backfill_cursor=case when ready or rules_hash<>${retailFormProjectionHash} then null else backfill_cursor end where store_id=${storeId}`;const[model]=await tx`select format_version from chinatech_v2_private.retail_form_models where store_id=${storeId}`;assert.equal(model.format_version,retailFormModelFormat,'Expected the exact reviewed Unicode/model migration before backfill');});
 const[trigger]=await sql`select tgenabled from pg_trigger where tgname='retail_form_unit_sync'`;assert.equal(trigger?.tgenabled,'O','Canonical form projection must be active');
 let batches=0,sourceRecords=0;
 for(;;){const done=await sql.begin(async tx=>{await lock(tx);const[model]=await tx`select backfill_cursor from chinatech_v2_private.retail_form_models where store_id=${storeId} for update`,rows=await retailFormCanonicalBatch(tx,storeId,model.backfill_cursor??'');for(const row of rows)await tx`select chinatech_v2_private.project_retail_form(${storeId},${row.id},${tx.json(row.data)})`;batches++;sourceRecords+=rows.length;if(rows.length)await tx`update chinatech_v2_private.retail_form_models set backfill_cursor=${rows.at(-1).id} where store_id=${storeId}`;return rows.length<200;});if(done)break;}
 const verified=await sql.begin('isolation level serializable',async tx=>{await lock(tx);const result=await verifyRetailFormProjection(tx,storeId);await tx`update chinatech_v2_private.retail_form_models set ready=true,rules_hash=${retailFormProjectionHash},generation=generation+1,verified_at=now()where store_id=${storeId}`;return result;});
 console.log(JSON.stringify({pass:true,batchLimit:200,batches,sourceRecords,...verified,activated:true,condition:'Local owner-only bounded canonical oracle; not production activation/performance.'}));
}finally{await sql.end();}
