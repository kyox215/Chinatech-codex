import {directoryCanonicalBatch} from './lib/customer-directory-canonical.mjs';
import {requireProjectionQueryContract} from "./lib/query-contract-verifier.mjs";
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
assert.equal(endpoint.hostname,'127.0.0.1');assert(['55432','55442'].includes(endpoint.port));assert.equal(endpoint.pathname,endpoint.port==='55432'?'/ct_perf_acceptance_icu_20261017':'/ct_perf_http_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false,connection:{statement_timeout:30000,lock_timeout:5000}}), native=createRequire(resolve('package.json')), modules=new Map();
function load(name,from=process.cwd()) {if(name==='server-only')return{};if(!name.startsWith('.'))return native(name);const file=resolve(from,name).replace(/\.ts$/,'')+'.ts';if(modules.has(file))return modules.get(file).exports;const loadedModule={exports:{}};modules.set(file,loadedModule);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(n=>load(n,dirname(file)),loadedModule,loadedModule.exports);return loadedModule.exports;}
const {buildCustomerDirectory,normalizeCustomerPhone}=load('./lib/customers'),{readCustomerList}=load('./lib/backend/customer-list');
const kinds=['profile','repair','sale','history'];
const tables={profile:'customers',repair:'repair_intakes',sale:'retail_units',history:'retail_history_records'};
async function lock(tx){await tx`select pg_advisory_xact_lock(hashtextextended(${'ct:'+storeId},0))`;}
async function producers(tx){const rows=await tx`select tg.tgname,tg.tgenabled from pg_trigger tg where(tg.tgrelid,tg.tgname)in(('chinatech_v2_private.customers'::regclass,'customer_directory_profile'),('chinatech_v2_private.repair_intakes'::regclass,'customer_directory_repair'),('chinatech_v2_private.retail_units'::regclass,'customer_directory_sale'),('chinatech_v2_private.retail_history_records'::regclass,'customer_directory_history'))`;assert.equal(rows.length,4);assert(rows.every(row=>row.tgenabled==='O'),'Canonical customer-directory producers must remain enabled');}
try {
 await sql.begin(async tx=>{await lock(tx);assert.equal((await tx`select count(*)::integer n from chinatech_v2.stores where id=${storeId}`)[0].n,1);await producers(tx);await tx`insert into chinatech_v2_private.customer_directory_models(store_id) values(${storeId}) on conflict do nothing`;await requireProjectionQueryContract(tx,storeId,"customer_directory");await tx`update chinatech_v2_private.customer_directory_models set ready=false,verified_at=null,backfill_cursor=case when ready then null else backfill_cursor end where store_id=${storeId}`;});
 let batches=0,records=0,oracleBoundary;
 for(;;){const done=await sql.begin(async tx=>{
   await lock(tx);const [model]=await tx`select * from chinatech_v2_private.customer_directory_models where store_id=${storeId} for update`;
   if(model.ready)return true;
   let [kind,last]=model.backfill_cursor?JSON.parse(model.backfill_cursor):[kinds[0],''];
   if(!kinds.includes(kind))return true;
   const column=kind==='profile'?'normalized_phone':'id';
   const rows=await tx`select ${tx(column)}::text as id,${kind==='history'?tx('published'):tx`true`} as published from ${tx('chinatech_v2_private.'+tables[kind])} where store_id=${storeId} and ${tx(column)}::text collate "C">${last} collate "C" order by ${tx(column)}::text collate "C" limit 200`;
   for(const row of rows)await tx`select chinatech_v2_private.project_customer_directory(${storeId},${kind},${row.id},(select data from ${tx('chinatech_v2_private.'+tables[kind])} where store_id=${storeId} and ${tx(column)}=${row.id}),${row.published})`;
   records+=rows.length;batches++;
   const next=rows.length===200?[kind,rows.at(-1).id]:[kinds[kinds.indexOf(kind)+1]??'done',''];
   await tx`update chinatech_v2_private.customer_directory_models set backfill_cursor=${JSON.stringify(next)} where store_id=${storeId}`;
   return next[0]==='done';
  });if(done)break;}
 const verified=await sql.begin('isolation level serializable',async tx=>{
   await lock(tx);
   // Exclude rollback/producer disable through verification and ready commit,
   // while allowing ordinary row writers. The store lock also excludes the
   // query-contract rollback which replaces producers before invalidation.
   await tx`lock table chinatech_v2.stores,chinatech_v2_private.customers,chinatech_v2_private.repair_intakes,chinatech_v2_private.retail_units,chinatech_v2_private.retail_history_records in share update exclusive mode`;
   const [current]=await tx`select ready,backfill_cursor from chinatech_v2_private.customer_directory_models where store_id=${storeId} for update`;
   assert(current&&!current.ready&&JSON.parse(current.backfill_cursor??'null')?.[0]==='done','A complete current canonical pass is required');
   await producers(tx);await requireProjectionQueryContract(tx,storeId,"customer_directory");
   // Projection reconstruction passes only canonical IDs to the original SQL
   // producer. The independent JS summary oracle reads <=200 thin/flat facts,
   // never the enclosing unit's photos, private events or complete sale bodies.
   const intakes=[],seeds=[],units=[],profiles=[],history=[],unitsById=new Map(),sourceCounts={profile:0,repair:0,sale:0,history:0};let maximumOracleRows=0,maximumOracleBytes=0;
   const validPhone=value=>{try{return normalizeCustomerPhone(value);}catch{return null;}};
   async function batches(kind,consume){let cursor=null;for(;;){const rows=await directoryCanonicalBatch(tx,storeId,kind,cursor);if(!rows.length)return;maximumOracleRows=Math.max(maximumOracleRows,rows.length);maximumOracleBytes=Math.max(maximumOracleBytes,Buffer.byteLength(JSON.stringify(rows)));for(const row of rows)consume(row.data,row);cursor=kind==='sale'?[rows.at(-1).id,rows.at(-1).position]:rows.at(-1).id;}}
   await batches('repair',row=>{intakes.push({id:row.id,createdAt:row.createdAt,updatedAt:row.updatedAt,customer:{name:row.customerName||'未填写姓名',phone:row.phone}});seeds.push({phone:row.phone,name:row.customerName,email:row.email});if(validPhone(row.phone))sourceCounts.repair++;});
   await batches('sale',(sale,row)=>{let unit=unitsById.get(row.id);if(!unit){unit={id:row.id,code:'',brand:'',model:'',sales:[]};unitsById.set(row.id,unit);units.push(unit);}unit.sales.push(sale);if(validPhone(sale.customerPhone))sourceCounts.sale++;});
   await batches('profile',row=>{profiles.push(row);if(validPhone(row.phone))sourceCounts.profile++;});
   await batches('history',row=>{history.push(row);if(validPhone(row.customerPhone))sourceCounts.history++;});
   history.sort((a,b)=>a.sourceRow-b.sourceRow);
   const expected=buildCustomerDirectory(intakes,units,profiles,seeds,history).map(row=>({id:row.id,phone:row.phone,name:row.name,email:row.email,repairCount:row.repairs.length,saleCount:row.sales.length,historyCount:row.history.length,lastActivity:row.lastActivity}));
   const actualCounts=Object.fromEntries(kinds.map(kind=>[kind,0]));for(const row of await tx`select origin_kind,count(*)::integer n from chinatech_v2_private.customer_directory_sources where store_id=${storeId} group by origin_kind`)actualCounts[row.origin_kind]=row.n;
   assert.deepEqual(actualCounts,sourceCounts,'Every valid canonical identity/event must have exactly one projected fact');
   const[orphan]=await tx`select exists(select 1 from chinatech_v2_private.customer_directory_sources s where s.store_id=${storeId} and (
     s.origin_kind='profile' and not exists(select 1 from chinatech_v2_private.customers c where c.store_id=s.store_id and c.normalized_phone=s.origin_id and s.event_id=s.origin_id)
     or s.origin_kind='repair' and not exists(select 1 from chinatech_v2_private.repair_intakes r where r.store_id=s.store_id and r.id=s.origin_id and s.event_id=s.origin_id)
     or s.origin_kind='history' and not exists(select 1 from chinatech_v2_private.retail_history_records h where h.store_id=s.store_id and h.id::text=s.origin_id and h.published and s.event_id=s.origin_id and h.source_row=s.event_order)
     or s.origin_kind='sale' and not exists(select 1 from chinatech_v2_private.retail_units u where u.store_id=s.store_id and u.id::text=s.origin_id and s.event_order>0 and u.data->'sales'->(s.event_order-1)->>'id'=s.event_id)
    )) found`;
   assert.equal(orphan.found,false,'Projection links and sale ordinals must reference actual canonical sources');
   const scope={formatVersion:2,accountId:'operator-local',sessionId:'operator-local',memberId:'operator-local',memberRevision:1,permissions:['customers.view','repairs.view','retail.view'],storeId};
   const [model]=await tx`select generation::text from chinatech_v2_private.customer_directory_models where store_id=${storeId}`;
   let actual=[],cursor;do{const page=await readCustomerList(tx,scope,'',cursor,model.generation);actual.push(...page.items);cursor=page.nextCursor??undefined;}while(cursor);
   const expectedSummaries=expected.map(row=>{const chars=[...row.name];return chars.length>200?{...row,name:chars.slice(0,200).join(''),namePreview:true}:row;});
   assert.deepEqual(actual,expectedSummaries,'Canonical customer directory and relationship facts must agree before activation');
   for(const row of expected.filter(value=>[...value.name].length>200)){const full=await readCustomerList(tx,scope,row.phone,undefined,model.generation,'exact');assert.equal(full.total,1);assert.deepEqual(full.items,[row],'Preview never substitutes the complete canonical identity');}
   oracleBoundary={maximumOracleRows,maximumOracleBytes,fullIdentityChecks:expected.filter(value=>[...value.name].length>200).length};
   await tx`update chinatech_v2_private.customer_directory_models set ready=true,generation=generation+1,verified_at=now() where store_id=${storeId}`;
   return expected.length;
 });
 console.log(JSON.stringify({pass:true,storeId,batchLimit:200,batches,sourceRecords:records,verifiedCustomers:verified,...oracleBoundary,projectionTransport:'IDs only; original producer reads canonical JSON inside database',activated:true,condition:'Local operator-only backfill; oracle compares all canonical sources under the existing store advisory lock. Not production throughput evidence.'}));
}finally{await sql.end()}
