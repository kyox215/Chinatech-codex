import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import postgres from 'postgres';
import {sourceLoader} from './helpers/typescript-source.mjs';

const load=sourceLoader(process.cwd(),{'./structured.json':JSON.parse(readFileSync('lib/i18n/structured.json'))});
const {fixtureIntakeReceipt,validLocalIntake,intakeDirectoryEntry}=load('./lib/repair-intake-record');
const {repairOrders}=load('./lib/repair-fixtures');
const {intakeDeviceHistory}=load('./lib/repair-intake');
const {emptyRetailUnit,validateRetailUnit,lookupRetailCode}=load('./lib/retail');
const {validateRetailHistoryRecord,projectRetailHistory}=load('./lib/retail-history');
const {normalizeCustomerPhone,updateCustomerProfile,buildCustomerDirectory,customerId}=load('./lib/customers');
const {validateProcurementDraft,appendProcurementEvent,procurementStatus}=load('./lib/procurement');
const {defaultStoreSettings,parseStoreSettings}=load('./lib/store-settings');
const {buildRetailListIndex,queryRetailList}=load('./lib/retail-list-model');
const {retailSearchLabels}=load('./lib/i18n/retail-display');
const {readRetailScan}=load('./lib/backend/retail-scan-read');
const {readRetailList,readRetailFacets}=load('./lib/backend/retail-list-read');
const {readRepairScan}=load('./lib/backend/repair-scan-read');
const {readIntakeHistory}=load('./lib/backend/intake-lookup-read');
const {readCustomerDetail}=load('./lib/backend/customer-detail-read');
const {readCustomerList}=load('./lib/backend/customer-list');
const {readProcurementBatch}=load('./lib/backend/procurement-batch-read');
const {projectionQueryRulesHash}=load('./lib/backend/query-rules-version');
const migration='supabase/migrations/20261017142651_performance_unicode_query_contract.sql';
const sha=value=>createHash('sha256').update(value).digest('hex');
const inputs=[migration,'tests/unicode-query-paths.integration.mjs','tests/helpers/typescript-source.mjs',
 'lib/backend/query-rules-version.ts','lib/backend/retail-vocabulary-version.ts',
 'lib/backend/retail-scan-read.ts','lib/backend/retail-list-read.ts','lib/backend/repair-scan-read.ts',
 'lib/backend/intake-lookup-read.ts','lib/backend/customer-detail-read.ts','lib/backend/customer-list.ts',
 'lib/backend/procurement-batch-read.ts','lib/repair-intake-record.ts','lib/repair-intake.ts',
 'lib/retail.ts','lib/retail-history.ts','lib/retail-list-model.ts','lib/customers.ts','lib/procurement.ts','lib/store-settings.ts'];
const sourceSha256=()=>Object.fromEntries(inputs.map(path=>[path,sha(readFileSync(path))]));
const sources=sourceSha256(),time='2026-10-17 12:00:00',snapshot='c'.repeat(64);
const phones=['+390009920022','+3900099\u{1CCF1}0022'];
const profiles=phones.map((raw,index)=>updateCustomerProfile([],{phone:normalizeCustomerPhone(raw),name:'DEMO Unicode customer '+index,email:'',note:'',updatedAt:time},0)[0]);
const repairs=Array.from({length:15},(_,index)=>({...fixtureIntakeReceipt(repairOrders[0]),id:'LOCAL-'+index.toString(16).toUpperCase().padStart(16,'0'),revision:1,phone:phones[index===1?1:0],customerName:'DEMO',brand:index===1?'DEMO ꟎':'DEMO',model:index===0?'DEMO ASCII control':index===2?'DEMO ꟎ model':'DEMO ꟎ common '+index,serial:index===1?'DEMO-꟏-1':'DEMO-SN-'+index,createdAt:time,updatedAt:time}));
repairs.forEach(row=>assert(validLocalIntake(row),'Real intake validator'));
const history=phones.map((phone,index)=>({id:randomUUID(),source:'seatable',sourceSnapshot:snapshot,sourceRow:index+2,sourceStatus:'以售',condition:'翻新机',customerName:'DEMO Unicode customer '+index,customerPhone:phone,category:'手机',brand:'DEMO',model:'DEMO ꟎ history '+index,color:null,memory:null,paymentMethod:null,askingPriceCents:null,salePriceCents:10000,depositCents:null,costCents:200,notes:'PRIVATE-꟎-NOTE',batteryPercent:null,identifier:'DEMO-HISTORY-꟏-'+index,intakeAt:'2026-10-17T12:00:00Z',pickupDate:null,sourceUpdatedAt:'2026-10-17T12:00:00Z',importedAt:'2026-10-17T12:00:00Z',reviewReasons:[]}));
history.forEach(row=>validateRetailHistoryRecord(row));
const names=['꟎ 2','꟏ 2','꟎ 10','꟏ 09','A 2','a 02','café 2','CAFE 2','Σ 2','σ 2','中 2','中 10','\u{16EA0} 2','\u{16EBB} 2'];
const units=Array.from({length:66},(_,index)=>({...emptyRetailUnit(),id:'DEMO-UNICODE-UNIT-'+String(index).padStart(3,'0'),code:index?'DEMO-UNICODE-꟏-CODE-'+index:'DEMO-ASCII-CODE-0',serial:index?'DEMO-UNICODE-꟏-SN-'+index:'DEMO-ASCII-SN-0',productCode:index?'DEMO-UNICODE-꟏-PRODUCT-'+index:'DEMO-ASCII-PRODUCT-0',brand:'DEMO',model:names[index%names.length],category:'phone',storeOwned:true,intakeDate:'2026-10-17',status:index<2?'sold':index%3===0?'hold':'available',sales:index<2?[{id:'DEMO-UNICODE-SALE-'+index,time,priceCents:10000,paidCents:null,delivered:false,note:'PRIVATE SALE',customerPhone:phones[index],customerName:'DEMO Unicode customer '+index}]:[]}));
units.forEach(row=>validateRetailUnit(row,units.filter(other=>other!==row)));
const suppliers=[{id:'DEMO-SUPPLIER-UNICODE',name:'DEMO ꟎ Supplier',phone:'',website:'',active:true},{id:'DEMO-AMBIGUOUS-A',name:'DEMO duplicate',phone:'',website:'',active:true},{id:'DEMO-AMBIGUOUS-B',name:'DEMO other',phone:'',website:'',active:true}];
const settings={...defaultStoreSettings,suppliers},legacyDuplicateSettings={...settings,suppliers:suppliers.map((row,index)=>index===2?{...row,name:suppliers[1].name}:row)};parseStoreSettings(JSON.stringify({version:1,settings}));assert.throws(()=>parseStoreSettings(JSON.stringify({version:1,settings:legacyDuplicateSettings})),/供应商/);
const procurement=Array.from({length:62},(_,index)=>{
 const draft={id:'DEMO-UNICODE-PROC-'+String(index).padStart(3,'0'),repairId:repairs[0].id,item:'DEMO item '+index,supplier:index===61?'DEMO duplicate':suppliers[0].name,...(index===61?{}:{supplierId:suppliers[0].id}),quantity:1,unitCostCents:null,expectedAt:'',reference:'',events:[],specification:'DEMO ꟎ SPEC '+index};
 validateProcurementDraft(draft);return appendProcurementEvent(draft,{id:'DEMO-ORDER-'+index,type:'ordered',time,note:'',quantity:0},0);
});
const member={id:'DEMO',role:'viewer',accountStatus:'active',membershipStatus:'active',permissions:['customers.view','repairs.view','repairs.edit','retail.view','financial.read']};
const canonicalCustomers=buildCustomerDirectory(repairs.map(intakeDirectoryEntry),units,profiles,[],projectRetailHistory(history,member));
assert.equal(canonicalCustomers.length,2);assert.equal(canonicalCustomers.find(row=>row.phone===profiles[1].phone).history.length,1);
const index=buildRetailListIndex(units,projectRetailHistory(history,member)).map(item=>({...item,search:`${item.search} ${retailSearchLabels(item)}`.normalize('NFKC').toLowerCase()}));
const plan={target:'Only owned SQL-only55432/ct_perf_acceptance_icu_20261017',sourceSha256:sources,queryRulesHash:projectionQueryRulesHash,nodeVersion:process.version,nodeIcu:process.versions.icu,nodeUnicode:process.versions.unicode,legacySupplierCase:'Explicit historical duplicate-name settings rejected by current validator; isolated from validated initial/current settings and restored before subsequent checks',counts:{repairs:repairs.length,units:units.length,history:history.length,procurement:procurement.length},checks:'Actual canonical validators/triggers and real read helpers vs unchanged JS: Unicode scanner/intake/phone association, all three procurement batch searches/ambiguity/deep IDs/cursor, whole-view sort/search/facets and restricted synthetic-session RLS. Always rollback candidate DDL/role/all owned rows. Physical runtime login, flag0 targeted page and HTTP are later checks.',limits:{statementTimeoutMs:8000,lockTimeoutMs:1000,cgroupMaximumFraction:.85,vmMinimumBytes:134217728,all3OomZero:true}};
if(!process.argv.includes('--run')){console.log(JSON.stringify({planOnly:true,canonicalValidatorsAccepted:true,connections:0,...plan}));process.exit(0);}
const output=process.argv.find(value=>value.startsWith('--out='))?.slice(6);assert(output&&/^\.\.\/proof\/[a-z0-9-]+\.json$/.test(output)&&!existsSync(output));
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json')),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),store=randomUUID(),peer=randomUUID(),user=randomUUID(),session=randomUUID(),stop=new Error('Rollback Unicode query paths');
const scope={formatVersion:2,accountId:user,sessionId:session,storeId:store,memberId:'',memberRevision:1,permissions:member.permissions};
writeFileSync(output+'.owned.private.json',JSON.stringify({store,peer,user,session})+'\n',{flag:'wx',mode:0o600});
const report={...plan,condition:'Real first-party SQL helpers with owner or SET LOCAL ROLE + synthetic live session/RLS. No real Auth/HTTP/browser/P95. No permanent DDL or canonical changes. Storage held.',complete:false,checks:[],resources:[]};
function guard(label){const raw=execFileSync('docker',['exec','ct-performance-isolated-20261017','cat','/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory.events','/proc/meminfo'],{encoding:'utf8',timeout:5000}),lines=raw.split('\n'),events=Object.fromEntries(['oom','oom_kill','oom_group_kill'].map(key=>{const m=new RegExp('^'+key+' (\\d+)$','m').exec(raw);assert(m);assert.equal(+m[1],0);return[key,+m[1]];})),sample={label,current:+lines[0],limit:+lines[1],available:+/^MemAvailable:\s+(\d+) kB$/m.exec(raw)[1]*1024,events};report.resources.push(sample);assert.equal(sample.limit,384*1024*1024);assert(sample.current<sample.limit*.85&&sample.available>=134217728);}
async function metadata(){const rows=await sql`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid)definition,p.proowner::text,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='chinatech_v2_private'order by p.oid`;return sha(JSON.stringify(rows));}
let original;
try{
 guard('before');original=await metadata();
 try{await sql.begin(async tx=>{
  await tx`set local statement_timeout='8s'`;await tx`set local lock_timeout='1s'`;
  await tx.unsafe(readFileSync(migration,'utf8'));guard('after temporary candidate');
  await tx`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values(${user},'DEMO-unicode-paths@example.test',now(),'{}')`;
  await tx`insert into chinatech_v2.accounts(id,email,display_name,account_status)values(${user},'DEMO-unicode-paths@example.test','DEMO','active')on conflict(id)do update set account_status='active'`;
  await tx`insert into auth.sessions(id,user_id,created_at,updated_at,not_after)values(${session},${user},now(),now(),now()+interval'1 hour')`;
  await tx`insert into chinatech_v2.stores(id,name)values(${store},'DEMO Unicode query paths'),(${peer},'DEMO foreign Unicode query')`;
  const[createdMember]=await tx`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions)values(${store},${user},'viewer','active',${scope.permissions})returning id`;scope.memberId=createdMember.id;
  await tx`insert into chinatech_v2_private.login_sessions(session_id,user_id)values(${session},${user})`;await tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id)values(${store},${session},${user})`;
  await tx`insert into chinatech_v2_private.store_state(store_id,settings)values(${store},${tx.json(settings)})`;
  const references=[];for(const profile of profiles){const[c]=await tx`insert into chinatech_v2_private.customers(store_id,normalized_phone,data)values(${store},${profile.phone},${tx.json(profile)})returning id`,[d]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data)values(${store},${c.id},'{}')returning id`;references.push({customer:c.id,device:d.id});}
  for(const row of repairs){const ref=references[row===repairs[1]?1:0];await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data)values(${store},${row.id},${ref.customer},${ref.device},${tx.json(row)})`;}
  for(const row of history)await tx`insert into chinatech_v2_private.retail_history_records(store_id,id,source_snapshot,source_row,source_hash,data,raw_data,published)values(${store},${row.id},${row.sourceSnapshot},${row.sourceRow},${sha(JSON.stringify(row))},${tx.json(row)},'{}',true)`;
  for(const row of units)await tx`insert into chinatech_v2_private.retail_units(store_id,id,data)values(${store},${row.id},${tx.json(row)})`;
  for(const row of procurement)await tx`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data)values(${store},${row.id},${row.repairId},${tx.json(row)})`;
  guard('after canonical fixtures');
  async function runtime(run,storeId=store){return tx.savepoint(async r=>{await r`set local role chinatech_runtime`;await r`select set_config('request.jwt.claims',${JSON.stringify({sub:user,session_id:session,role:'authenticated'})},true),set_config('app.store_id',${storeId},true)`;const value=await run(r);await r`set local role none`;return value;});}
  for(const unit of units.slice(0,2))for(const kind of['internal','serial','product']){const raw=kind==='internal'?unit.code:kind==='serial'?unit.serial:unit.productCode,expected=lookupRetailCode(units,raw,kind),actual=await runtime(r=>readRetailScan(r,scope,{kind,raw}));assert.equal(expected.length,1);assert.equal(actual.total,1);assert.equal(actual.items[0].id,expected[0].id);}
  report.checks.push('Six real restricted retail scanner queries resolve Unicode17 identifiers exactly as original lookupRetailCode');
  const canonicalRepairs=repairs.toSorted((a,b)=>a.id.localeCompare(b.id)).map(intakeDirectoryEntry);
  for(const row of repairs.slice(0,3))for(const kind of['exact','related']){const serial=kind==='exact'?row.serial:'DEMO-NO-MATCH',expected=intakeDeviceHistory(serial,row.brand,row.model,canonicalRepairs)[kind],actual=await runtime(r=>readIntakeHistory(r,scope,JSON.stringify({kind,serial,brand:row.brand,model:row.model})));assert.equal(actual.total,expected.length);assert.deepEqual(actual.items.map(row=>row.id),expected.map(row=>row.id));}
  for(const row of repairs.slice(0,2)){const actual=await runtime(r=>readRepairScan(r,scope,row.serial,'http://127.0.0.1:3187'));assert.equal(actual.total,1);assert.equal(actual.items[0].id,row.id);}
  report.checks.push('Intake exact/related Unicode serial/brand/model and repair scanner preserve original no-NFKC and full normalized equality');
  for(const expected of canonicalCustomers)for(const kind of['repairs','sales','history']){const actual=await runtime(r=>readCustomerDetail(r,scope,{id:customerId(expected.phone),kind,q:''}));assert.equal(actual.total,expected[kind].length);assert.deepEqual(actual.items.map(r=>r.id).sort(),expected[kind].map(r=>r.id).sort());assert.deepEqual(actual.counts,{repairs:expected.repairs.length,sales:expected.sales.length,history:expected.history.length});}
  const directory=await runtime(r=>readCustomerList(r,scope,''));assert.equal(directory.total,2);
  report.checks.push('Outlined-digit phones preserve all repair/sale/history associations and exact full counts under actual restricted customer/detail reads');
  guard('before procurement batch paths');const candidate=await runtime(r=>readProcurementBatch(r,scope,{kind:'repairs',q:'꟏'}));assert.equal(candidate.items.length,12);assert.deepEqual(candidate.items.map(r=>r.id),repairs.filter(r=>(r.id+' '+r.model).toLowerCase().includes('꟏')).toSorted((a,b)=>a.id.localeCompare(b.id)).slice(0,12).map(r=>r.id));
  const tailCandidate=await runtime(r=>readProcurementBatch(r,scope,{kind:'repairs',repairId:repairs.at(-1).id,q:'꟏'}));assert.equal(tailCandidate.items[0].id,repairs.at(-1).id);
  const supplier=await runtime(r=>readProcurementBatch(r,scope,{kind:'suppliers',q:'꟏'}));assert.equal(supplier.suppliers.length,1);assert.equal(supplier.suppliers[0].id,suppliers[0].id);assert.equal(supplier.suppliers[0].count,61);assert.equal(supplier.eligible,62);assert.equal(supplier.unresolved,0);
  const resolvedLegacy=await runtime(r=>readProcurementBatch(r,scope,{kind:'rows',supplierId:suppliers[1].id}));assert.equal(resolvedLegacy.total,1);await tx`update chinatech_v2_private.store_state set settings=${tx.json(legacyDuplicateSettings)},revision=revision+1 where store_id=${store}`;const ambiguous=await runtime(r=>readProcurementBatch(r,scope,{kind:'rows',supplierId:suppliers[1].id}));assert.equal(ambiguous.total,0);assert.equal(ambiguous.unresolved,1);await tx`update chinatech_v2_private.store_state set settings=${tx.json(settings)},revision=revision+1 where store_id=${store}`;assert.equal((await runtime(r=>readProcurementBatch(r,scope,{kind:'rows',supplierId:suppliers[1].id}))).total,1);
  const first=await runtime(r=>readProcurementBatch(r,scope,{kind:'rows',supplierId:suppliers[0].id,q:'꟏ spec'}));assert.equal(first.total,61);assert.equal(first.items.length,50);assert(first.nextCursor);const next=await runtime(r=>readProcurementBatch(r,scope,{kind:'rows',supplierId:suppliers[0].id,q:'꟏ spec'},{cursor:first.nextCursor}));assert.equal(next.items.length,11);
  const ids=procurement.filter(row=>procurementStatus(row)==='ordered'&&row.supplierId===suppliers[0].id).map(row=>row.id);assert.deepEqual([...first.items,...next.items].map(row=>row.id),ids);
  const selected=await runtime(r=>readProcurementBatch(r,scope,{kind:'rows',supplierId:suppliers[0].id,q:''},{ids:[ids.at(-1)]}));assert.equal(selected.items[0].id,ids.at(-1));
  const [currentModel]=await tx`select generation::text from chinatech_v2_private.procurement_list_models where store_id=${store}`,[currentState]=await tx`select revision from chinatech_v2_private.store_state where store_id=${store}`;
  const {backendScopeKey}=load('./lib/backend/read-plan'),{procurementBatchQuery}=load('./lib/backend/procurement-batch-contract'),batchQuery=procurementBatchQuery({kind:'rows',supplierId:suppliers[0].id,q:'꟏ spec'});
  const tokenFor=rules=>sha(JSON.stringify([1,backendScopeKey(scope),rules,currentModel.generation,currentState.revision,batchQuery]));assert.equal(tokenFor(projectionQueryRulesHash),first.stateToken);const legacyCursor=JSON.parse(Buffer.from(first.nextCursor,'base64url').toString('utf8'));legacyCursor[0]=tokenFor('0'.repeat(64));
  await assert.rejects(runtime(r=>readProcurementBatch(r,scope,batchQuery,{cursor:Buffer.from(JSON.stringify(legacyCursor)).toString('base64url')})),error=>error.status===409&&error.code==='READ_VERSION_CHANGED');
  report.checks.push('All three procurement batch Unicode paths: 12 repair candidates plus unloaded exact ID, supplier full eligibility/ambiguity, specification61 paged50+11 and unloaded selection; old rules cursor rejected');
  guard('after procurement batch paths');report.collations=await tx`select collname,collversion,pg_collation_actual_version(oid)actual from pg_collation where collnamespace='chinatech_v2_private'::regnamespace and collname in('retail_list_names','retail_list_ties')`;
  for(const view of['available','sold','other'])for(const sort of['name-asc','newest','oldest','price-asc','price-desc',...(view==='sold'?['sold-newest']:[])])for(const q of['','꟏']){const expected=queryRetailList(index,{view,sort,query:q,condition:'all',category:'all',status:'all',review:false,page:10000}),actual=await runtime(r=>readRetailList(r,scope,{view,sort,q}));let page=actual,items=[];for(;;){assert(Buffer.byteLength(JSON.stringify(page))<=100000);items.push(...page.items);if(!page.nextCursor)break;page=await runtime(r=>readRetailList(r,scope,{view,sort,q},{cursor:page.nextCursor}));}assert.equal(actual.total,expected.total);assert.deepEqual(items.map(row=>row.key),expected.items.map(row=>row.key),JSON.stringify({view,sort,q}));guard('after retail '+view+'/'+sort+'/'+q);}
  const financialNotes=await runtime(r=>readRetailList(r,scope,{view:'sold',q:'private-꟏-note'}));assert.equal(financialNotes.total,2);assert(financialNotes.items.every(item=>!('notes'in item)&&!('costCents'in item)));
  const nonFinancialPermissions=scope.permissions.filter(permission=>permission!=='financial.read');await tx`update chinatech_v2.store_memberships set permissions=${nonFinancialPermissions}where id=${scope.memberId}`;const nonFinancial=await runtime(r=>readRetailList(r,{...scope,permissions:nonFinancialPermissions},{view:'sold',q:'private-꟏-note'}));assert.equal(nonFinancial.total,0);await tx`update chinatech_v2.store_memberships set permissions=${scope.permissions}where id=${scope.memberId}`;
  for(const q of['Phone','Telefono']){const facet=await runtime(r=>readRetailFacets(r,scope,{view:'available',kind:'category',q}));assert.equal(facet.total,1);}
  report.checks.push('Actual full-view SQL order/search match unchanged Node numeric/base Collator and stable ties, including Unicode17 new letters, accents/Greek/CJK/numeric models and all six applicable sorts; visible translated facets remain searchable');
  for(const permissions of[['repairs.view','repairs.edit'],['retail.view'],[]]){await tx`update chinatech_v2.store_memberships set permissions=${permissions}where id=${scope.memberId}`;const[counts]=await runtime(r=>r`select(select count(*)from chinatech_v2_private.repair_intakes)::integer repairs,(select count(*)from chinatech_v2_private.retail_units)::integer units,(select count(*)from chinatech_v2_private.customer_record_sources)::integer customer_records`);assert.equal(counts.repairs,permissions.includes('repairs.view')?repairs.length:0);assert.equal(counts.units,permissions.includes('retail.view')?units.length:0);assert.equal(counts.customer_records,0);}
  await tx`update chinatech_v2.store_memberships set permissions=${scope.permissions}where id=${scope.memberId}`;
  const[foreign]=await runtime(r=>r`select(select count(*)from chinatech_v2_private.repair_intakes)::integer repairs,(select count(*)from chinatech_v2_private.retail_units)::integer units`,peer);assert.deepEqual({...foreign},{repairs:0,units:0});
  await tx`update chinatech_v2.store_memberships set membership_status='disabled'where id=${scope.memberId}`;const[revoked]=await runtime(r=>r`select count(*)::integer n from chinatech_v2_private.retail_list_sources`);assert.equal(revoked.n,0);
  report.checks.push('Per-source domain/customer permissions, foreign store and revoked membership still deny data after normalization changes');
  assert.deepEqual(sourceSha256(),sources);throw stop;
 });}catch(error){if(error!==stop)throw error;}
 report.complete=true;
}catch(error){report.error={name:error.name,code:error.code,message:error.message};}
finally{
 try{if(original)assert.equal(await metadata(),original);const[count]=await sql`select(select count(*)from chinatech_v2.stores where id in(${store},${peer}))::integer stores,(select count(*)from auth.users where id=${user})::integer users,(select count(*)from auth.sessions where id=${session})::integer sessions,(select count(*)from pg_roles where rolname='chinatech_unicode_reader')::integer roles,(select count(*)from information_schema.columns where table_schema='chinatech_v2_private'and column_name='query_rules_hash')::integer columns`;assert(Object.values(count).every(v=>v===0));report.cleanup=count;report.originalFunctionDefinitionsAndAclRestored=true;guard('after whole rollback');}catch(error){report.cleanupError={code:error.code,message:error.message};report.complete=false;}
 await sql.end();writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({complete:report.complete,checks:report.checks.length,cleanup:report.cleanup,error:report.error,cleanupError:report.cleanupError}));if(!report.complete)process.exitCode=1;
}
