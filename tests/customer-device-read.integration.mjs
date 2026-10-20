import assert from'node:assert/strict';
import{readFileSync,writeFileSync} from'node:fs';
import{createHash,randomUUID} from'node:crypto';
import postgres from'postgres';
import{reviewedCustomerDeviceMigration}from'./helpers/customer-device-migration.mjs';
import{sourceLoader} from'./helpers/typescript-source.mjs';
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json')),url=new URL(config.DB_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),load=sourceLoader(),{readCustomerDevices,customerDevicesSql}=load('./lib/backend/customer-device-read'),{buildCustomerDevices,queryCustomerDevices,latestCustomerDeviceTime}=load('./lib/customer-devices'),{fixtureIntakeReceipt,validLocalIntake,intakeDirectoryEntry}=load('./lib/repair-intake-record'),{repairOrders}=load('./lib/repair-fixtures'),{emptyRetailUnit,validateRetailUnit,parseStoredRetailUnits}=load('./lib/retail'),{defaultStoreSettings}=load('./lib/store-settings');
const migration='supabase/migrations/20261017112354_performance_customer_device_reads.sql',sha=x=>createHash('sha256').update(x).digest('hex'),store=randomUUID(),other=randomUUID(),user=randomUUID(),session=randomUUID(),scope={formatVersion:2,storeId:store,accountId:user,sessionId:session,memberId:randomUUID(),memberRevision:1,permissions:['repairs.view','retail.view']},phone='+390007771111',repairs=[],units=[],rollback=new Error('owned rollback');
const report={complete:false,condition:'Actual canonical triggers and reader on dedicated SQL-only17.11 ICU153.128 disk32MiB; owner oracle plus restricted synthetic claims/live-session RLS, not HTTP/Auth/browser/P95.',migration:{path:migration,sha256:sha(readFileSync(migration))},sources:Object.fromEntries(['lib/customer-devices.ts','lib/backend/customer-device-read.ts','lib/backend/customer-device-contract.ts','lib/backend/customer-device-version.ts','tests/customer-device-read.integration.mjs','tests/helpers/customer-device-migration.mjs'].map(p=>[p,sha(readFileSync(p))])),nodeIcu:process.versions.icu,checks:[],pages:[]};
const expectedId=key=>sha(key),trim=v=>[...v].slice(0,200).join('');
try{try{await sql.begin(async tx=>{
 report.installedMigration=await reviewedCustomerDeviceMigration(tx);
 await tx`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values(${user},'DEMO-device-oracle@example.test',now(),'{}')`;
 await tx`insert into chinatech_v2.accounts(id,email,display_name,account_status)values(${user},'DEMO-device-oracle@example.test','DEMO','active')on conflict(id)do update set account_status='active'`;
 await tx`insert into auth.sessions(id,user_id,created_at,updated_at,not_after)values(${session},${user},now(),now(),now()+interval'1 hour')`;
 await tx`insert into chinatech_v2.stores(id,name)values(${store},'DEMO physical device oracle'),(${other},'DEMO foreign physical devices')`;
 const[member]=await tx`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions)values(${store},${user},'viewer','active',${scope.permissions})returning id`;scope.memberId=member.id;
 await tx`insert into chinatech_v2_private.login_sessions(session_id,user_id)values(${session},${user})`;
 await tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id)values(${store},${session},${user})`;
 await tx`insert into chinatech_v2_private.store_state(store_id,settings)values(${store},${tx.json(defaultStoreSettings)})`;
 const[customer]=await tx`insert into chinatech_v2_private.customers(store_id,normalized_phone,data)values(${store},${phone},'{}')returning id`,[device]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data)values(${store},${customer.id},'{}')returning id`;
 function repair(index,brand,serial,model='DEMO model',buyer=phone){const row={...fixtureIntakeReceipt(repairOrders[0]),id:'LOCAL-'+index.toString(16).toUpperCase().padStart(16,'0'),brand,serial,model,phone:buyer,customerName:'DEMO',createdAt:'2026-10-17 10:00:00',updatedAt:'2026-10-17 10:00:00',previewAt:'2026-10-17 10:00:00',photoCount:0,photos:[]};assert(validLocalIntake(row));repairs.push(row);return row;}
 for(let i=0;i<550;i++)repair(i,'DEMO',' s n\uFEFFß ',i?'Later model':'First model',i===549?'+39099999549':phone);
 repair(550,'Other','SNSS');repair(551,'DEMO','123456789012345');repair(552,'Other','123456789012345');repair(553,'DEMO','');repair(554,'DEMO','');repair(555,'DEMO ꟎','꟏','Unicode ꟎ model');repair(556,'ＤＥＭＯ','Ａ');
 for(let i=557;i<620;i++)repair(i,'DEMO','UNIQUE-'+i,'普通型号 '+i);
 for(let start=0;start<repairs.length;start+=100)await tx`insert into chinatech_v2_private.repair_intakes ${tx(repairs.slice(start,start+100).map(data=>({store_id:store,id:data.id,customer_id:customer.id,device_id:device.id,data})),'store_id','id','customer_id','device_id','data')}`;
 for(let i=0;i<3;i++){
  const row={...emptyRetailUnit(),id:'DEMO-UNIT-'+i,code:'SAME-CODE',brand:'DEMO',model:i===2?'长'.repeat(4990)+'MODEL-END':'Store unit '+i,category:'phone',serial:'SNSS',storeOwned:true,status:'sold',sales:Array.from({length:i===0?70:2},(_,n)=>({id:'SALE-'+i+'-'+n,time:'2026-10-17T10:00'+(n%3?'':'A'),priceCents:100,paidCents:null,delivered:false,note:'PRIVATE-NOTE',customerPhone:n===69?'+39088888999':phone}))};validateRetailUnit(row);units.push(row);
 }
 const legacy={...emptyRetailUnit(),id:'DEMO-UNICODE-DATES',code:'DEMO-UNICODE-DATES',brand:'DEMO',model:'Unicode latest',serial:'SNSS',storeOwned:true,status:'sold',sales:[{id:'A',time:'2026-10-17T10:00😀',priceCents:100,paidCents:null,delivered:false,note:'',customerPhone:phone},{id:'B',time:'2026-10-17T10:00\uE000',priceCents:100,paidCents:null,delivered:false,note:'',customerPhone:phone}]};assert.equal(parseStoredRetailUnits(JSON.stringify({version:1,units:[legacy]}),[]).length,1);units.push(legacy);
 await tx`insert into chinatech_v2_private.retail_units ${tx(units.map(data=>({store_id:store,id:data.id,data})),'store_id','id','data')}`;
 const orderedRepairs=repairs.slice().sort((a,b)=>a.id.localeCompare(b.id)),orderedUnits=units.slice().sort((a,b)=>a.id.localeCompare(b.id)),oracle=buildCustomerDevices(orderedRepairs.map(intakeDirectoryEntry),orderedUnits);
 async function readAll(query){let page=await readCustomerDevices(tx,scope,query),all=[];const first=page;for(;;){const bytes=Buffer.byteLength(JSON.stringify(page));assert(bytes<=100000);assert(page.items.length<=50);report.pages.push({kind:query.kind??'devices',bytes,rows:page.items.length});all.push(...page.items);if(!page.nextCursor)break;page=await readCustomerDevices(tx,scope,query,{cursor:page.nextCursor});} assert.equal(all.length,first.total);return{first,items:all};}
 for(const q of['','99999549','first model','later model','꟏','ＤＥＭＯ','MODEL-END','model snss '+phone,'SAME-CODE']){
  const expected=queryCustomerDevices(oracle,q),actual=await readAll({q});assert.deepEqual(actual.items.map(r=>r.id),expected.map(r=>expectedId(r.key)),'whole-scope devices/order q='+q);
  for(let i=0;i<expected.length;i++){const a=actual.items[i],e=expected[i];assert.equal(a.model,trim(e.model));assert.equal(a.category,e.category);assert.equal(a.serial,trim(e.serial));assert.equal(a.recordCount,e.records.length);assert.equal(a.latestAt,latestCustomerDeviceTime(e));assert(!('records'in a));}
 }
 report.checks.push('Actual SQL summaries match original source identity/first model/category/Unicode search/full-group counts/latest UTF16 selection/stable locale order across nine queries');
 const list=await readAll({q:''});assert(list.first.nextCursor);const next=await readCustomerDevices(tx,scope,{q:''},{cursor:list.first.nextCursor}),back=await readCustomerDevices(tx,scope,{q:''},{cursor:next.previousCursor});assert.deepEqual(back.items,list.first.items);
 const deep=await readCustomerDevices(tx,scope,{q:''},{seek:99999});assert(deep.items.length>0&&deep.startIndex<deep.total);const anchored=await readCustomerDevices(tx,scope,{q:''},{anchor:list.items[55].id});assert.equal(anchored.items[0].id,list.items[55].id);
 const unchanged=await readCustomerDevices(tx,scope,{q:''},{known:list.first.stateToken,anchor:list.items[55].id});assert(unchanged.unchanged);assert(Buffer.byteLength(JSON.stringify(unchanged))<1000);
 report.checks.push('Forward/reverse cursor, deep shrink clamp, stable anchor and known+anchor unchanged budgets');
 for(const key of[expectedId('DEMO:SNSS'),expectedId('retail:DEMO-UNIT-0')]){
  const expected=oracle.find(d=>expectedId(d.key)===key).records.toSorted((a,b)=>b.time.localeCompare(a.time)),actual=await readAll({kind:'records',deviceId:key});
  assert.deepEqual(actual.items.map(({id,displayId,...r})=>({id:displayId,...r})),expected);assert(new Set(actual.items.map(r=>r.id)).size===expected.length);
 }
 const original=await readCustomerDevices(tx,scope,{kind:'original',deviceId:expectedId('retail:DEMO-UNIT-2')});assert.equal(original.total,1);assert.equal(original.items[0].model,'DEMO '+units[2].model);assert.equal(original.items[0].serial,'SNSS');assert.deepEqual(original.items[0].previews,[]);assert(Buffer.byteLength(JSON.stringify(original))<100000);const originalKnown=await readCustomerDevices(tx,scope,original.query,{known:original.stateToken});assert(originalKnown.unchanged);await assert.rejects(readCustomerDevices(tx,scope,original.query,{seek:0}),e=>e.status===400);
 report.checks.push('Expanded repair550 and sales70 histories remain separate, full count with stable time ties and paginated source-qualified identities');
 const generation=Number((await tx`select generation from chinatech_v2_private.customer_device_models where store_id=${store}`)[0].generation);
 await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(load('./lib/repair-workflow').initialRepairWorkflow(intakeDirectoryEntry(repairs[0])))},signatures='[]',data=jsonb_set(data,'{revision}','2')where store_id=${store} and id=${repairs[0].id}`;
 await tx`update chinatech_v2_private.retail_units set data=jsonb_set(data,'{costCents}','12345')where store_id=${store} and id=${units[0].id}`;
 assert.equal(Number((await tx`select generation from chinatech_v2_private.customer_device_models where store_id=${store}`)[0].generation),generation);
 await tx`update chinatech_v2_private.repair_intakes set data=jsonb_set(data,'{model}','"Changed device model"')where store_id=${store} and id=${repairs[0].id}`;
 assert.equal(Number((await tx`select generation from chinatech_v2_private.customer_device_models where store_id=${store}`)[0].generation),generation+1);
 await assert.rejects(readCustomerDevices(tx,scope,{q:''},{cursor:list.first.nextCursor}),e=>e.code==='READ_VERSION_CHANGED');
 report.checks.push('Unrelated workflow/revision/signature/cost updates preserve generation; physical facts advance it and invalidate old cursors');
 async function runtime(run,storeId=store){return tx.savepoint(async r=>{await r`set local role chinatech_runtime`;await r`select set_config('request.jwt.claims',${JSON.stringify({sub:user,session_id:session,role:'authenticated'})},true),set_config('app.store_id',${storeId},true)`;const value=await run(r);await r`reset role`;return value;});}
 const restrictedOriginal=await runtime(r=>readCustomerDevices(r,scope,{kind:'original',deviceId:expectedId('retail:DEMO-UNIT-2')}));assert.equal(restrictedOriginal.items[0].model,'DEMO '+units[2].model);report.checks.push('Explicit original metadata returns the full first authorized model/serial only on demand; current scope/generation/format and unchanged remain bound');
 const full=await runtime(r=>readCustomerDevices(r,scope,{}));assert.equal(full.total,list.first.total);
 for(const perms of[['repairs.view'],['retail.view'],[]]){
  await tx`update chinatech_v2.store_memberships set permissions=${perms} where id=${scope.memberId}`;
  const[actual]=await runtime(r=>r`select(select count(*)from chinatech_v2_private.customer_device_facts where kind='repair')::integer repairs,(select count(*)from chinatech_v2_private.customer_device_facts where kind='sale')::integer sales,(select count(*)from chinatech_v2_private.customer_device_records where kind='repair')::integer repair_records,(select count(*)from chinatech_v2_private.customer_device_records where kind='sale')::integer sale_records`);
  if(!perms.includes('retail.view'))assert.equal((await runtime(r=>readCustomerDevices(r,scope,{kind:'original',deviceId:expectedId('retail:DEMO-UNIT-2')}))).items.length,0);
  assert.equal(actual.repairs,perms.includes('repairs.view')?repairs.length:0);assert.equal(actual.sales,perms.includes('retail.view')?units.length:0);assert.equal(actual.repair_records,perms.includes('repairs.view')?repairs.length:0);assert.equal(actual.sale_records,perms.includes('retail.view')?76:0);
 }
 await tx`update chinatech_v2.store_memberships set permissions=${scope.permissions} where id=${scope.memberId}`;
 const[foreign]=await runtime(r=>r`select count(*)::integer n from chinatech_v2_private.customer_device_records`,other);assert.equal(foreign.n,0);
 await tx`update chinatech_v2.store_memberships set membership_status='disabled'where id=${scope.memberId}`;
 assert.equal((await runtime(r=>r`select count(*)::integer n from chinatech_v2_private.customer_device_facts`))[0].n,0);
 await tx`update chinatech_v2.store_memberships set membership_status='active'where id=${scope.memberId}`;
 await tx`update chinatech_v2.accounts set account_status='disabled'where id=${user}`;
 assert.equal((await runtime(r=>r`select count(*)::integer n from chinatech_v2_private.customer_device_facts`))[0].n,0);
 report.checks.push('Actual runtime per-domain RLS gates facts and records; no customers.view required; foreign store/revoked membership/disabled account all zero');
 report.plan=(await customerDevicesSql(tx,scope,{kind:'devices',q:'',deviceId:''},null,undefined,undefined,true))[0];
 throw rollback;
 });} catch(error){if(error!==rollback)throw error;} report.complete=true;
} finally{
 try{const[remaining]=await sql`select(select count(*)from chinatech_v2.stores where id in(${store},${other}))::integer stores,(select count(*)from auth.users where id=${user})::integer users,(select count(*)from auth.sessions where id=${session})::integer sessions`;assert(Object.values(remaining).every(n=>n===0));report.ownedRemaining=remaining;} finally{await sql.end();writeFileSync(process.env.CT_PERF_CUSTOMER_DEVICE_REPORT??'../proof/customer-device-read-original-seventh.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({complete:report.complete,checks:report.checks.length,ownedRemaining:report.ownedRemaining}));}
}
