import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
import {sourceLoader} from './helpers/typescript-source.mjs';

// One bounded diagnosis, not a retry of the preserved 158s write and not an API
// benchmark. EXPLAIN ANALYZE executes every canonical trigger; the encompassing
// transaction is always rolled back (PG17 /docs/17/using-explain.html).
const migration='supabase/migrations/20261017122335_performance_unicode_case_execution.sql';
const execution='supabase/migrations/20261017133040_performance_customer_record_execution.sql';
const sha=value=>createHash('sha256').update(value).digest('hex');
const prior='supabase/migrations/20261017063155_performance_unicode17_compatibility.sql';
const inputs=[migration,execution,prior,'tests/customer-record-canonical.integration.mjs','lib/retail.ts','lib/customer-record-projection.ts'];
const sourceSha256=Object.fromEntries(inputs.map(path=>[path,sha(readFileSync(path))]));
const load=sourceLoader(),{emptyRetailUnit,parseStoredRetailUnits}=load('./lib/retail'),{customerRecordFact}=load('./lib/customer-record-projection');
function fixture(count){
 const id='DEMO-BOUNDED-WRITE-'+count;
 const unit={...emptyRetailUnit(),id,code:id,category:'phone',brand:'DEMO',model:'꟎'+'型'.repeat(4990)+'MODEL-END',serial:'DEMO-SN-'+count,storeOwned:true,status:'sold',photos:[],events:[],sales:Array.from({length:count},(_,index)=>({id:'DEMO-SALE-'+count+'-'+index,time:'2026-10-17T12:00:00',priceCents:100,paidCents:null,delivered:false,note:'DEMO private sale note excluded from customer search',customerPhone:'+39320000011'}))};
 assert.equal(unit.model.length,5000);assert.equal(parseStoredRetailUnits(JSON.stringify({version:1,units:[unit]}),[]).length,1);
 return unit;
}
const fixtures=[1,10,1000].map(fixture);
if(!process.argv.includes('--run')){
 console.log(JSON.stringify({planOnly:true,target:'Only task-owned SQL-only127.0.0.1:55432/ct_perf_acceptance_icu_20261017',sourceSha256,validated:fixtures.map(unit=>({sales:unit.sales.length,modelUtf16:unit.model.length,canonicalBytes:Buffer.byteLength(JSON.stringify(unit))})),condition:'All original canonical/projector/FK/quota/RLS triggers stay enabled;14 equivalent lower +15 equivalent customer-record execution and new owned stores only inside one always-rolled-back transaction',limits:{statementTimeoutMs:8000,lockTimeoutMs:1000,ordinaryWriteBudgetMs:1000},stop:'Stop progression immediately after first timeout/resource violation or first completed sample over ordinary budget; no30 samples/no retries',proof:'Actual canonical INSERT EXPLAIN ANALYZE BUFFERS JSON, per-trigger times; projected search compared by complete old actual fact JSON equality in SQL plus independent Node search SHA/full summary/phone/time in<=50/100KB read batches; actual6arg legacy writer; original function restored/owned0/resources checked even after failure'}));
 process.exit(0);
}
const output=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6);
assert(output&&/^\.\.\/proof\/[a-z0-9-]+\.json$/.test(output)&&!existsSync(output),'Explicit fresh proof output required before connection');
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json','utf8'));
const url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const stores=fixtures.map(()=>randomUUID());writeFileSync(output+'.owned.private.json',JSON.stringify({stores,target:url.pathname,condition:'Only these new DEMO stores, all writes must rollback'})+'\n',{flag:'wx',mode:0o600});
const sql=postgres(config.DB_URL,{max:1,prepare:false}),rollback=new Error('Rollback bounded candidate canonical diagnosis');
const report={condition:'SQL-only PG17.11 ICU disk/32MiB, idle Storage held; one bounded canonical diagnosis, not HTTP/Auth/ordinary command or P95 evidence. No photos; same1/10/1000 sale fixtures as preserved canonical-first, one completed sample each before any30-sample consideration.',sourceSha256,complete:false,correctnessPassed:false,budgetPassed:true,samples:[],resourceSamples:[]};
function resources(){const raw=execFileSync('docker',['exec','ct-performance-isolated-20261017','cat','/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory.events','/proc/meminfo'],{encoding:'utf8',timeout:5000}),lines=raw.split('\n');return{current:Number(lines[0]),limit:Number(lines[1]),available:Number(/^MemAvailable:\s+(\d+) kB$/m.exec(raw)[1])*1024,oom:Number(/^oom_kill (\d+)$/m.exec(raw)[1])};}
const signatures=['chinatech_v2_private.unicode17_lower(text)','chinatech_v2_private.customer_record_fact(text,jsonb,integer)','chinatech_v2_private.project_customer_record_fact(uuid,text,text,text,integer,jsonb)','chinatech_v2_private.customer_record_sync()'];
async function definitions(){return sql`select s.signature,pg_get_functiondef(p.oid)definition,p.proowner::text,p.proacl::text from jsonb_array_elements_text(${sql.json(signatures)})s(signature)join pg_proc p on p.oid=to_regprocedure(s.signature)order by s.signature`;}
let baseline,definition,attributes,before,connected=false;
function guard(label){const value=resources();baseline??=value;report.resourceSamples.push({label,...value});assert.equal(value.limit,384*1024*1024);assert(value.current<value.limit*.85,label+' cgroup');assert(value.available>=128*1024*1024,label+' VM');assert.equal(value.oom,baseline.oom,label+' OOM unchanged');}
async function triggers(tx){return tx`select tgname,tgenabled from pg_trigger where tgrelid='chinatech_v2_private.retail_units'::regclass and not tgisinternal order by tgname`;}
try{
 guard('before connection');connected=true;before=await definitions();assert.equal(before.length,4);definition=(await sql`select pg_get_functiondef('chinatech_v2_private.unicode17_lower(text)'::regprocedure)body`)[0].body;report.originalDefinitionSha256=sha(definition);report.ownedBackendPid=(await sql`select pg_backend_pid()pid`)[0].pid;const expectedBody=/as \$\$([\s\S]*?)\$\$;/.exec(readFileSync(prior,'utf8').split('create function chinatech_v2_private.unicode17_lower(value text)returns text\n')[1])[1];attributes=(await sql`select prosrc,proowner::text,proacl::text from pg_proc where oid='chinatech_v2_private.unicode17_lower(text)'::regprocedure`)[0];assert.equal(attributes.prosrc,expectedBody);
 try{await sql.begin(async tx=>{
  await tx`set local statement_timeout='8s'`;await tx`set local lock_timeout='1s'`;
  report.triggersBefore=await triggers(tx);assert(report.triggersBefore.every(row=>row.tgenabled==='O'));
  await tx.unsafe(before.find(row=>row.signature==='chinatech_v2_private.customer_record_fact(text,jsonb,integer)').definition.replace('chinatech_v2_private.customer_record_fact','pg_temp.customer_record_fact_before'));
  await tx.unsafe(readFileSync(migration,'utf8'));await tx.unsafe(readFileSync(execution,'utf8'));guard('candidates applied only in transaction');
  for(let index=0;index<fixtures.length;index++){
   const unit=fixtures[index],store=stores[index];guard('before canonical '+unit.sales.length);
   await tx`insert into chinatech_v2.stores(id,name)values(${store},'DEMO bounded canonical execution')`;
   const started=performance.now();const rows=await tx`explain(analyze,buffers,format json)insert into chinatech_v2_private.retail_units(store_id,id,data)values(${store},${unit.id},${tx.json(unit)})`;
   const wallMs=performance.now()-started,plan=rows[0]['QUERY PLAN'][0],sample={sales:unit.sales.length,canonicalBytes:Buffer.byteLength(JSON.stringify(unit)),wallMs,executionMs:plan['Execution Time'],triggers:plan.Triggers,plan};report.samples.push(sample);guard('after canonical '+unit.sales.length);
   const[count]=await tx`select count(*)::integer n from chinatech_v2_private.customer_record_sources where store_id=${store} and kind='sales'`;assert.equal(count.n,unit.sales.length);
   const expected=new Map(unit.sales.map(sale=>{const fact=customerRecordFact('sales',{id:unit.id,code:unit.code,brand:unit.brand,model:unit.model,sale});assert(fact);return[sale.id,{phone:fact.phone,event_at:fact.eventAt,search_hash:sha(fact.search),summary:fact.summary}];}));
   for(let start=0;start<unit.sales.length;start+=50){
    const batch=unit.sales.slice(start,start+50),ids=batch.map(sale=>sale.id),actual=await tx`select s.event_id,s.phone,s.event_at,encode(sha256(convert_to(s.search,'UTF8')),'hex')search_hash,s.summary-'key'summary,s.key,jsonb_build_object('phone',s.phone,'eventAt',s.event_at,'search',s.search,'summary',s.summary-'key')=pg_temp.customer_record_fact_before('sales',jsonb_build_object('id',${unit.id}::text,'code',${unit.code}::text,'brand',${unit.brand}::text,'model',${unit.model}::text,'sale',item.value),s.event_order)old_fact_equal from chinatech_v2_private.customer_record_sources s join jsonb_array_elements(${tx.json(batch)})item(value)on item.value->>'id'=s.event_id where s.store_id=${store} and s.kind='sales'and s.event_id in(select jsonb_array_elements_text(${tx.json(ids)}))`;
    assert.equal(actual.length,ids.length);assert(actual.length<=50);assert(Buffer.byteLength(JSON.stringify(actual))<=100000);
    for(const {event_id,key,old_fact_equal,...fact}of actual){assert.equal(old_fact_equal,true);assert.deepEqual(JSON.parse(key),['sales',unit.id,event_id]);assert.deepEqual(fact,expected.get(event_id));}
   }
   const sale=unit.sales[0],document={id:unit.id,code:unit.code,brand:unit.brand,model:unit.model,sale};
   const beforeLegacy=(await tx`select phone,event_at,encode(sha256(convert_to(search,'UTF8')),'hex')search_hash,summary,key,event_order from chinatech_v2_private.customer_record_sources where store_id=${store} and kind='sales'and event_id=${sale.id}`)[0];
   assert.equal(beforeLegacy.event_order,1);assert(Number.isSafeInteger(beforeLegacy.event_order));
   await tx`select chinatech_v2_private.project_customer_record_fact(${store},'sales',${unit.id},${sale.id},${beforeLegacy.event_order},${tx.json(document)})`;
   assert.deepEqual((await tx`select phone,event_at,encode(sha256(convert_to(search,'UTF8')),'hex')search_hash,summary,key,event_order from chinatech_v2_private.customer_record_sources where store_id=${store} and kind='sales'and event_id=${sale.id}`)[0],beforeLegacy);
   sample.completeOriginalFactsCompared=unit.sales.length;sample.legacy6ArgWriterEqual=true;
   sample.projectionSearchHashesCompared=unit.sales.length;assert.deepEqual(await triggers(tx),report.triggersBefore);guard('after full oracle '+unit.sales.length);
   if(wallMs>1000){report.budgetPassed=false;report.stoppedAfterCompletedBudgetRed=unit.sales.length;break;}
  }
  report.correctnessPassed=true;throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 report.complete=true;
}catch(error){report.error={name:error.name,code:error.code,message:error.message};if(error.code==='57014')report.budgetPassed=false;else if(!report.samples.length)report.budgetPassed=null;}
finally{
 try{if(!connected){report.cleanup='No SQL started';}else{await sql`set statement_timeout='3s'`;if(before){report.originalDefinitionsRestored=JSON.stringify(await definitions())===JSON.stringify(before);assert(report.originalDefinitionsRestored);}report.newHelpersAfter=(await sql`select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='chinatech_v2_private'and(p.proname in('customer_record_search','customer_record_sale_prepared','customer_record_fact_prepared')or p.proname='project_customer_record_fact'and p.pronargs=7)`)[0].n;assert.equal(report.newHelpersAfter,0);if(definition){const after=(await sql`select pg_get_functiondef('chinatech_v2_private.unicode17_lower(text)'::regprocedure)body`)[0].body;report.originalDefinitionRestored=after===definition;assert.equal(after,definition,'Original installed function must survive success/failure rollback byte-for-byte');if(attributes)assert.deepEqual((await sql`select prosrc,proowner::text,proacl::text from pg_proc where oid='chinatech_v2_private.unicode17_lower(text)'::regprocedure`)[0],attributes);}
  report.ownedRemaining=[];const tables=await sql`select table_schema,table_name from information_schema.columns where table_schema in('chinatech_v2','chinatech_v2_private')and column_name='store_id'order by table_schema,table_name`;
  for(const table of tables){assert.match(table.table_schema,/^[a-z0-9_]+$/);assert.match(table.table_name,/^[a-z0-9_]+$/);const[row]=await sql.unsafe('select count(*)::integer n from '+table.table_schema+'.'+table.table_name+' where store_id=any($1::uuid[])',[stores]);assert.equal(row.n,0);report.ownedRemaining.push({table:table.table_schema+'.'+table.table_name,rows:row.n});}
  assert.equal((await sql`select count(*)::integer n from chinatech_v2.stores where id=any(${txArray(stores)})`)[0].n,0);guard('after rollback verification');}
 }catch(error){report.cleanupError={name:error.name,code:error.code,message:error.message};report.complete=false;}
 finally{await sql.end();writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({complete:report.complete,correctnessPassed:report.correctnessPassed,budgetPassed:report.budgetPassed,samples:report.samples.map(({sales,wallMs,executionMs})=>({sales,wallMs,executionMs})),restored:report.originalDefinitionRestored,error:report.error,cleanupError:report.cleanupError}));if(!report.complete||!report.correctnessPassed||!report.budgetPassed)process.exitCode=1;}
}
function txArray(values){return sql.array(values,2950);}
