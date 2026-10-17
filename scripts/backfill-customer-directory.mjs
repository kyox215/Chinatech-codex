// Operator-only local verification tool; never loaded by the web runtime.
// Production execution needs a separately approved migration/connection path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';
import ts from 'typescript';
const options=Object.fromEntries(process.argv.slice(2).map(value=>{const i=value.indexOf('=');return [value.slice(0,i),value.slice(i+1)];}));
const storeId=options['--store-id'], file=options['--connection-file'];
assert.match(storeId??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert(file,'Explicit project-local connection file required');
const config=JSON.parse(readFileSync(file)), endpoint=new URL(config.DB_URL);
assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.port,'55422');
const sql=postgres(config.DB_URL,{max:1,prepare:false}), native=createRequire(resolve('package.json')), modules=new Map();
function load(name,from=process.cwd()) {if(name==='server-only')return{};if(!name.startsWith('.'))return native(name);const file=resolve(from,name).replace(/\.ts$/,'')+'.ts';if(modules.has(file))return modules.get(file).exports;const loadedModule={exports:{}};modules.set(file,loadedModule);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(n=>load(n,dirname(file)),loadedModule,loadedModule.exports);return loadedModule.exports;}
const {buildCustomerDirectory}=load('./lib/customers'),{intakeDirectoryEntry}=load('./lib/repair-intake-record'),{readCustomerList}=load('./lib/backend/customer-list');
const kinds=['profile','repair','sale','history'];
const tables={profile:'customers',repair:'repair_intakes',sale:'retail_units',history:'retail_history_records'};
async function lock(tx){await tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+storeId},0))`;}
try {
 await sql.begin(async tx=>{await lock(tx);assert.equal((await tx`select count(*)::integer n from chinatech_v2.stores where id=${storeId}`)[0].n,1);await tx`insert into chinatech_v2_private.customer_directory_models(store_id) values(${storeId}) on conflict do nothing`;});
 let batches=0,records=0;
 for(;;){const done=await sql.begin(async tx=>{
   await lock(tx);const [model]=await tx`select * from chinatech_v2_private.customer_directory_models where store_id=${storeId} for update`;
   if(model.ready)return true;
   let [kind,last]=model.backfill_cursor?JSON.parse(model.backfill_cursor):[kinds[0],''];
   if(!kinds.includes(kind))return true;
   const column=kind==='profile'?'normalized_phone':'id';
   const rows=await tx`select ${tx(column)}::text as id,data,${kind==='history'?tx('published'):tx`true`} as published from ${tx('chinatech_v2_private.'+tables[kind])} where store_id=${storeId} and ${tx(column)}::text collate "C">${last} collate "C" order by ${tx(column)}::text collate "C" limit 200`;
   for(const row of rows)await tx`select chinatech_v2_private.project_customer_directory(${storeId},${kind},${row.id},${tx.json(row.data)},${row.published})`;
   records+=rows.length;batches++;
   const next=rows.length===200?[kind,rows.at(-1).id]:[kinds[kinds.indexOf(kind)+1]??'done',''];
   await tx`update chinatech_v2_private.customer_directory_models set backfill_cursor=${JSON.stringify(next)} where store_id=${storeId}`;
   return next[0]==='done';
  });if(done)break;}
 const verified=await sql.begin(async tx=>{
   await lock(tx);
   const intakes=(await tx`select data from chinatech_v2_private.repair_intakes where store_id=${storeId} order by id`).map(row=>row.data);
   const units=(await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} order by id`).map(row=>row.data);
   const profiles=(await tx`select data from chinatech_v2_private.customers where store_id=${storeId} order by normalized_phone`).map(row=>row.data);
   const history=(await tx`select data from chinatech_v2_private.retail_history_records where store_id=${storeId} and published order by source_row`).map(row=>row.data);
   const expected=buildCustomerDirectory(intakes.map(intakeDirectoryEntry),units,profiles,intakes.map(row=>({phone:row.phone,name:row.customerName,email:row.email})),history).map(row=>({id:row.id,phone:row.phone,name:row.name,email:row.email,repairCount:row.repairs.length,saleCount:row.sales.length,historyCount:row.history.length,lastActivity:row.lastActivity}));
   const scope={formatVersion:2,accountId:'operator-local',sessionId:'operator-local',memberId:'operator-local',memberRevision:1,permissions:['customers.view','repairs.view','retail.view'],storeId};
   const [model]=await tx`select generation::text from chinatech_v2_private.customer_directory_models where store_id=${storeId}`;
   let actual=[],cursor;do{const page=await readCustomerList(tx,scope,'',cursor,model.generation);actual.push(...page.items);cursor=page.nextCursor??undefined;}while(cursor);
   assert.deepEqual(actual,expected,'Canonical customer directory and relationship facts must agree before activation');
   await tx`update chinatech_v2_private.customer_directory_models set ready=true,generation=generation+1,verified_at=now() where store_id=${storeId}`;
   return expected.length;
 });
 console.log(JSON.stringify({pass:true,storeId,batchLimit:200,batches,sourceRecords:records,verifiedCustomers:verified,activated:true,condition:'Local operator-only backfill; oracle compares all canonical sources under the existing store advisory lock. Not production throughput evidence.'}));
}finally{await sql.end()}
