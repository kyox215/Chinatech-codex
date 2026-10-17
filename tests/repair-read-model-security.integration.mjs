import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import postgres from 'postgres';
import {sourceLoader} from './helpers/typescript-source.mjs';
const folder='../../../.company-tmp/performance-20261017/clean-database/fresh-instance/',ownerConfig=JSON.parse(readFileSync(folder+'icu-connection.private.json')),runtimeConfig=JSON.parse(readFileSync(folder+'icu-runtime-connection.private.json'));
for(const value of[ownerConfig.DB_URL,runtimeConfig.DATABASE_URL]){const url=new URL(value);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');}assert.equal(new URL(runtimeConfig.DATABASE_URL).username,'chinatech_runtime');
const owner=postgres(ownerConfig.DB_URL,{max:1,prepare:false}),runtime=postgres(runtimeConfig.DATABASE_URL,{max:1,prepare:false}),load=sourceLoader(),{readRepairList}=load('./lib/backend/repair-list'),{fixtureIntakeReceipt}=load('./lib/repair-intake-record'),{repairOrders}=load('./lib/repair-fixtures'),{defaultStoreSettings}=load('./lib/store-settings');
const {readRepairScan}=load('./lib/backend/repair-scan-read');
const user=randomUUID(),session=randomUUID(),store=randomUUID(),repairId='LOCAL-ABCDEF0000000001';let member;
const scope=()=>({formatVersion:2,accountId:user,sessionId:session,storeId:store,memberId:member,memberRevision:1,permissions:['repairs.view']});
const result={condition:'Independent stock PostgreSQL17.11 ICU en-US; exact bcbc + four performance migrations. Actual NOINHERIT/NOBYPASS restricted runtime connection with entirely synthetic claims/users/session rows. No HTTP Auth, password hashes, original user records, production latency, or Realtime transport evidence.',migrationSha256:createHash('sha256').update(readFileSync('supabase/migrations/20261017015301_performance_repair_read_model.sql')).digest('hex'),security:[]};
const withRuntime=(run,{claims={sub:user,session_id:session,role:'authenticated'},storeId=store}={})=>runtime.begin('isolation level serializable',async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify(claims)},true),set_config('app.store_id',${storeId},true),set_config('statement_timeout','10000',true)`;return run(tx);});
const count=options=>withRuntime(async tx=>{const[row]=await tx`select (select count(*) from chinatech_v2_private.repair_list_sources)::integer sources,(select count(*) from chinatech_v2_private.repair_list_models)::integer models`;if(row.sources===0)await assert.rejects(readRepairScan(tx,scope(),repairId,'https://repair.example'),error=>error.status===503);return row;},options);
try{
 const[role]=await runtime`select current_user as name,rolsuper,rolbypassrls,rolinherit from pg_roles where rolname=current_user`;assert.deepEqual(role,{name:'chinatech_runtime',rolsuper:false,rolbypassrls:false,rolinherit:false});result.runtime=role;
 await owner.begin(async tx=>{
  await tx`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(${user},'DEMO-repair-security@example.test',now(),'{"display_name":"DEMO repair security"}')`;
  await tx`insert into chinatech_v2.accounts(id,email,display_name,account_status) values(${user},'DEMO-repair-security@example.test','DEMO repair security','active') on conflict(id) do update set account_status='active'`;
  await tx`insert into auth.sessions(id,user_id,created_at,updated_at,not_after) values(${session},${user},now(),now(),now()+interval '1 hour')`;
  await tx`insert into chinatech_v2.stores(id,name) values(${store},'DEMO repair RLS')`;
  const[m]=await tx`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${store},${user},'viewer','active',array['repairs.view']) returning id`;member=m.id;
  await tx`insert into chinatech_v2_private.login_sessions(session_id,user_id) values(${session},${user})`;await tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id) values(${store},${session},${user})`;
  await tx`insert into chinatech_v2_private.store_state(store_id,settings) values(${store},${tx.json(defaultStoreSettings)})`;
  const[c]=await tx`insert into chinatech_v2_private.customers(store_id,normalized_phone,data) values(${store},'+390000999111','{"phone":"+390000999111","name":"DEMO","email":"","note":"","version":1,"updatedAt":"2026-10-17 12:00:00"}') returning id`;
  const[d]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data) values(${store},${c.id},'{}') returning id`;
  const intake={...fixtureIntakeReceipt(repairOrders[0]),id:repairId,customerName:'DEMO security',phone:'+390000999111'};
  await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures) values(${store},${repairId},${c.id},${d.id},${tx.json(intake)},'[]')`;
 });
 assert.deepEqual(await count(),{sources:1,models:1});const page=await withRuntime(tx=>readRepairList(tx,scope(),{groupBy:'none'}));assert.equal(page.total,1);assert.equal(page.items[0].id,repairId);result.summaryBytes=Buffer.byteLength(JSON.stringify(page));result.security.push('actual canonical projection is readable by a live authorized restricted identity');
 const scan=await withRuntime(tx=>readRepairScan(tx,scope(),repairId,'https://repair.example'));assert.equal(scan.total,1);assert.equal(scan.items[0].id,repairId);result.security.push('scanner canonical narrow lookup authorized; every following denied role/session/scope also cannot read its model/candidates');
 for(const[description,options]of[['anonymous',{claims:{}}],['session claim does not match Auth session',{claims:{sub:user,session_id:randomUUID(),role:'authenticated'}}],['cross-store',{storeId:randomUUID()}]]){assert.deepEqual(await count(options),{sources:0,models:0});result.security.push(description+' => both private tables zero');}
 for(const change of [
  {label:'permission removed',set:tx=>tx`update chinatech_v2.store_memberships set permissions='{}' where id=${member}`,restore:tx=>tx`update chinatech_v2.store_memberships set permissions=array['repairs.view'] where id=${member}`},
  {label:'membership disabled',set:tx=>tx`update chinatech_v2.store_memberships set membership_status='disabled' where id=${member}`,restore:tx=>tx`update chinatech_v2.store_memberships set membership_status='active' where id=${member}`},
  {label:'account disabled',set:tx=>tx`update chinatech_v2.accounts set account_status='disabled' where id=${user}`,restore:tx=>tx`update chinatech_v2.accounts set account_status='active' where id=${user}`},
  {label:'project session revoked',set:tx=>tx`update chinatech_v2_private.login_sessions set revoked_at=now() where session_id=${session}`,restore:tx=>tx`update chinatech_v2_private.login_sessions set revoked_at=null where session_id=${session}`},
  {label:'store session revoked',set:tx=>tx`update chinatech_v2_private.store_login_sessions set revoked_at=now() where store_id=${store} and session_id=${session}`,restore:tx=>tx`update chinatech_v2_private.store_login_sessions set revoked_at=null where store_id=${store} and session_id=${session}`},
  {label:'Auth session expired',set:tx=>tx`update auth.sessions set not_after=now()-interval '1 second' where id=${session}`,restore:tx=>tx`update auth.sessions set not_after=now()+interval '1 hour' where id=${session}`}
 ]){await change.set(owner);assert.deepEqual(await count(),{sources:0,models:0});await change.restore(owner);assert.deepEqual(await count(),{sources:1,models:1});result.security.push(change.label+' => zero, restored => authorized1');}
 for(const operation of [
  ()=>runtime`delete from chinatech_v2_private.repair_list_sources where store_id=${store}`,
  ()=>runtime`update chinatech_v2_private.repair_list_models set ready=true where store_id=${store}`,
  ()=>runtime`select chinatech_v2_private.project_repair_list(${store}::uuid,${repairId})`,
  ()=>runtime`select chinatech_v2_private.repair_list_facts('{}',null,'[]')`,
  ()=>runtime`select chinatech_v2_private.repair_array_json('[]')`
 ])await assert.rejects(operation,error=>error.code==='42501');result.security.push('runtime cannot mutate either projection/model or execute any of the three owner derivation helpers');
 result.assertionsPass=true;
}finally{
 try{await owner.begin(async tx=>{
  await tx`delete from chinatech_v2_private.procurement_records where store_id=${store}`;await tx`delete from chinatech_v2_private.repair_intakes where store_id=${store}`;await tx`delete from chinatech_v2_private.customer_devices where store_id=${store}`;await tx`delete from chinatech_v2_private.customers where store_id=${store}`;await tx`delete from chinatech_v2_private.store_login_sessions where store_id=${store}`;await tx`delete from chinatech_v2_private.store_state where store_id=${store}`;await tx`delete from chinatech_v2.store_memberships where store_id=${store}`;await tx`delete from chinatech_v2.stores where id=${store}`;await tx`delete from auth.sessions where id=${session}`;await tx`delete from auth.users where id=${user}`;
 });const[after]=await owner`select (select count(*) from auth.users)::integer users,(select count(*) from auth.sessions)::integer sessions,(select count(*) from chinatech_v2.accounts)::integer accounts,(select count(*) from chinatech_v2.stores)::integer stores,(select count(*) from chinatech_v2_private.repair_list_sources)::integer repairSources,(select count(*) from chinatech_v2_private.repair_list_models)::integer repairModels`;assert(Object.values(after).every(value=>value===0));result.cleanup=after;result.cleanupPass=true;}finally{await runtime.end();await owner.end();}
}
result.pass=true;writeFileSync(process.env.CT_PERF_REPAIR_SECURITY_PROOF??'../proof/repair-read-model-security.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
