import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {sourceLoader} from './helpers/typescript-source.mjs';

// An explicit project-only, empty-baseline ICU database. Never accepts the
// production URL or silently reuses the shared local Supabase database.
const configPath=process.env.CT_PERF_DATABASE_CONFIG??'../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json';
const {DB_URL}=JSON.parse(readFileSync(configPath,'utf8')),url=new URL(DB_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(DB_URL,{max:1,prepare:false}),load=sourceLoader();
const {fixtureIntakeReceipt,intakeDirectoryEntry}=load('./lib/repair-intake-record');
const {repairOrders}=load('./lib/repair-fixtures');
const {currentRepairRequirements}=load('./lib/repair-requirements');
const {repairPartsSummary,procurementStatus,arrivedQuantity}=load('./lib/procurement');
const {initialRepairWorkflow,overlayRepair,isRepairHistory,hasCurrentRepairHandover,repairStageStatus,workflowGroup,repairProgress,pickupNotice,arrivalNotice,partsSignature}=load('./lib/repair-workflow');
const {readRepairList,repairReadContext,repairListSql}=load('./lib/backend/repair-list');
const {repairListQuery}=load('./lib/backend/repair-list-contract');
const {defaultStoreSettings}=load('./lib/store-settings');
const {defaultRepairGroups,visibleRepairGroups}=load('./lib/repair-groups');
const migrationPath='supabase/migrations/20261017015301_performance_repair_read_model.sql',migration=readFileSync(migrationPath,'utf8');
const result={condition:'PostgreSQL17.11 ICU en-US independent project database; exact bcbc baseline plus three committed read migrations. Owner-only pure SQL/canonical-trigger oracle in one transaction, rolled back; not live-session RLS, HTTP, production timing or Realtime evidence.',migration:{path:migrationPath,sha256:createHash('sha256').update(migration).digest('hex')},cases:[]};
const rollback=new Error('intentional rollback'),store=randomUUID(),repairId='LOCAL-2026101700000001',time='2026-10-17 12:00:00';
const intake={...fixtureIntakeReceipt(repairOrders[0]),id:repairId,category:'手机',brand:'DEMO \u2028 "brand"',model:'DEMO \\ model ΟΣ İ ß',customerName:'\u00a0DEMO\u00a0',phone:'+390000000111',faults:['屏幕：无显示','电池：续航短','屏幕：重复','尾插'],services:{screen:{quality:'assembled',technology:'oled'},battery:{quality:'original',appleService:'both'},port:{quality:''}},createdAt:time,updatedAt:time,custody:'customer'};
intake.issue=intake.faults.join('、');
const event=(type,quantity=0,label='',at=time)=>({id:randomUUID(),type,quantity,time:at,note:'DEMO oracle',label});
const procurement=(id,extra={})=>({id,repairId,item:'DEMO part',supplier:'DEMO supplier',quantity:2,unitCostCents:90009,expectedAt:'',reference:'PRIVATE reference excluded',events:[],...extra});
function narrow(rows){return rows.map(row=>({id:row.id,item:row.item,supplier:row.supplier,specification:row.specification??null,quantity:row.quantity,arrived:arrivedQuantity(row),status:procurementStatus(row),ledgerRevision:row.events.length,required:row.required??null,requirementId:row.requirementId??null,requirementRevision:row.requirementRevision??null}));}
function oracle(document,wf,rows){const order=overlayRepair(intakeDirectoryEntry(document),wf),current=wf??initialRepairWorkflow(order),parts=repairPartsSummary(rows,order.id,currentRepairRequirements(order,current)),{label,...partsFacts}=parts;void label;return{requirements:currentRepairRequirements(order,current),parts:partsFacts,stage:repairStageStatus(current),history:isRepairHistory(order,current),currentHandover:hasCurrentRepairHandover(current),workflowGroup:workflowGroup(order,rows,current),pickupNotice:pickupNotice(current),arrivalNotice:arrivalNotice(current,rows,order.id,order),partsSignature:partsSignature(rows,order.id,currentRepairRequirements(order,current)),progress:repairProgress(order,rows,current)};}
async function check(tx,name,document,wf,rows=[]){const [{facts}]=await tx`select chinatech_v2_private.repair_list_facts(${tx.json(document)},${wf?tx.json(wf):null},${tx.json(narrow(rows))}) facts`,expected=oracle(document,wf,rows);for(const[key,value]of Object.entries(expected))assert.deepEqual(facts[key],value,`${name}: ${key}`);result.cases.push(name);return facts;}
try{
 const[environment]=await sql`select current_setting('server_version') version,datlocprovider provider,datcollversion collation_version,upper('ß') ss,lower('ΟΣ') greek from pg_database where datname=current_database()`;
 assert.match(environment.version,/^17\.11/);assert.equal(environment.provider,'i');assert.equal(environment.ss,'SS');assert.equal(environment.greek,'ος');result.environment=environment;
 const installed=Boolean((await sql`select to_regclass('chinatech_v2_private.repair_list_sources') name`)[0].name);result.beforeInstalled=installed;
 if(installed){for(const match of migration.matchAll(/create function chinatech_v2_private\.(\w+)\([^]*?as \$\$([^]*?)\$\$/g)){const [row]=await sql`select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='chinatech_v2_private' and proname=${match[1]}`;assert.equal(row?.prosrc,match[2],match[1]+' installed function matches current DDL');}}
 try{await sql.begin(async tx=>{
  if(!installed)await tx.unsafe(migration);
  await check(tx,'default initial workflow, stable intake faults and service fingerprints',intake,null);
  const base=initialRepairWorkflow(intakeDirectoryEntry(intake)),sources=currentRepairRequirements(intakeDirectoryEntry(intake)),confirmed=sources.map(row=>({...row,mode:'parts',confirmed:true}));
  const full=confirmed.map((row,i)=>procurement('DEMO-PART-'+i,{requirementId:row.id,requirementRevision:row.revision,events:[event('ordered'),event('arrival',2)]}));
  const stages=['diagnosis','awaiting_quote','awaiting_parts','repairing','testing','ready','ready_notified','completed','cancelled','awaiting_reply','collected_unpaid','outsourced'];
  for(const status of stages)for(const custody of ['store','customer','unknown'])await check(tx,`${status}/${custody}`,intake,{...base,status,custody,requirements:confirmed},full);
  await check(tx,'legacy ready_notified without explicit notice remains notified',intake,{...base,status:'ready_notified'});
  await check(tx,'legacy awaiting_reply ready cycle and current notice',intake,{...base,status:'awaiting_reply',readyCycle:'new',pickupNotice:{cycle:'new',outcome:'notified'}});
  await check(tx,'mismatched pickup cycle does not count as notified',intake,{...base,status:'ready',readyCycle:'new',pickupNotice:{cycle:'old',outcome:'notified'}});
  const damaged={...base,requirements:confirmed.map((row,i)=>i?row:{...row,sourceFingerprint:'obsolete',revision:9})};
  await check(tx,'changed source increments revision and resets confirmation',intake,damaged,full);
  const custom={id:'project:中文-ß',title:'DEMO custom',request:'DEMO exact original',revision:7,mode:'parts',confirmed:true,deviceFingerprint:JSON.stringify([intake.category,intake.brand,intake.model])};
  await check(tx,'unmatched custom requirement keeps actual fingerprint and revision',intake,{...base,requirements:[...confirmed,custom]},full);
  await check(tx,'custom obsolete source/device resets; custom empty fingerprint is distinct',intake,{...base,requirements:[{...custom,sourceFingerprint:'old'},{...custom,id:'project:2',deviceFingerprint:'old'},{...custom,id:'project:3',sourceFingerprint:''}]},full);
  await check(tx,'optional matching row satisfies existence but required stale link invalidates',intake,{...base,requirements:confirmed},[...full.map(row=>({...row,required:false})),procurement('DEMO-stale',{requirementId:confirmed[0].id,requirementRevision:0,events:[event('ordered')]})]);
  await check(tx,'optional matching rows alone allow requirements with zero required quantity',intake,{...base,requirements:confirmed},full.map(row=>({...row,required:false})));
  await check(tx,'cart/draft, partial and corrected arrival contribute independently',intake,{...base,requirements:confirmed},[...full,procurement('DEMO-cart',{events:[event('cart_added')]}),procurement('DEMO-corrected',{events:[event('ordered'),event('arrival',2),event('correction',-1)]})]);
  const at='2026-10-17 13:00:00',handover=event('followup',0,'欠款已拿走：已记录',at),recover=event('stage',0,'维修阶段：维修中','2026-10-17 11:00:00');
  for(const events of [[recover,handover],[handover,recover]])await check(tx,'handover uses saved array positions over misleading event times '+events[0].type,intake,{...base,handedOver:{time:at,unpaid:true},followUp:{collectedUnpaid:true,awaitingReply:false},events});
  for(const recoveryTime of ['2026-10-17 12:30:00','2026-10-17 13:30:00'])await check(tx,'legacy handover timestamp fallback '+recoveryTime,intake,{...base,handedOver:{time:at,unpaid:false},events:[{...recover,time:recoveryTime}]});
  const signature=partsSignature(full,repairId,confirmed);await check(tx,'current compact signature preserves exact JSON fingerprints',intake,{...base,requirements:confirmed,notice:{signature,outcome:'notified'}},full);
  const noSources={...intake,faults:[],services:{screen:{quality:'',technology:''},battery:{quality:'',appleService:''},port:{quality:''}}},legacyRows=[procurement('DEMO-b',{events:[event('ordered'),event('arrival',2)]}),procurement('DEMO-a',{events:[event('ordered'),event('arrival',2)]})];
  await check(tx,'prior no-requirement notice signature stays valid',noSources,{...base,notice:{signature:legacyRows.map(row=>`${row.id}:${row.quantity}:${row.events.length}`).sort().join('|'),outcome:'notified'}},legacyRows);
  const unicodeIds=['中','Z','a','A','é','e','ß','ss','2','10','_','-'];const unicodeReqs=unicodeIds.map(id=>({...custom,id,mode:'none',confirmed:true})),unicodeRows=unicodeIds.map(id=>procurement(id,{events:[event('ordered'),event('arrival',2)]}));
  await check(tx,'Intl localeCompare signature ordering against database ICU',noSources,{...base,requirements:unicodeReqs},unicodeRows);
  const longFacts=await check(tx,'only three explicit previews, full canonical requests unchanged',noSources,{...base,requirements:Array.from({length:10},(_,i)=>({...custom,id:'project:'+i,request:'DEMO'.repeat(300)}))});assert.equal(longFacts.chips.length,3);assert.equal(longFacts.chipCount,10);assert(longFacts.chips.every(row=>row.preview&&row.request.length===160));
  // The real trigger path is checked after the pure oracle, with all source
  // mutations and the complete DDL still inside this rollback transaction.
  await tx`insert into chinatech_v2.stores(id,name) values(${store},'DEMO repair projection oracle')`;
  const[customer]=await tx`insert into chinatech_v2_private.customers(store_id,normalized_phone,data) values(${store},'+390000000111',${tx.json({phone:'+390000000111',name:'DEMO',email:'',note:'',version:1,updatedAt:time})}) returning id`;
  const[device]=await tx`insert into chinatech_v2_private.customer_devices(store_id,customer_id,data) values(${store},${customer.id},'{}') returning id`;
  await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures,workflow) values(${store},${repairId},${customer.id},${device.id},${tx.json(intake)},'[]',${tx.json({...base,requirements:confirmed})})`;
  for(const row of full)await tx`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data) values(${store},${row.id},${repairId},${tx.json(row)})`;
  async function projected(expectedRows,wf={...base,requirements:confirmed},document=intake){const[{summary,stage,history,parts_group,workflow_group}]=await tx`select summary,stage,history,parts_group,workflow_group from chinatech_v2_private.repair_list_sources where store_id=${store} and id=${repairId}`;const expected=oracle(document,wf,expectedRows);assert.deepEqual({stage,history,parts_group,workflow_group},{stage:expected.stage,history:expected.history,parts_group:expected.parts.group,workflow_group:expected.workflowGroup});assert.deepEqual(summary.progress,expected.progress);assert.equal(summary.contact.arrivalNotice,expected.arrivalNotice);assert(!JSON.stringify(summary).includes('PRIVATE reference')&&!JSON.stringify(summary).includes('90009'));}
  await projected(full);
  const updated={...full[0],events:[event('ordered')]};await tx`update chinatech_v2_private.procurement_records set data=${tx.json(updated)} where store_id=${store} and id=${updated.id}`;await projected([updated,...full.slice(1)]);
  await tx`delete from chinatech_v2_private.procurement_records where store_id=${store} and id=${updated.id}`;await projected(full.slice(1));
  const wf={...base,status:'ready_notified',requirements:confirmed};await tx`update chinatech_v2_private.repair_intakes set workflow=${tx.json(wf)} where store_id=${store} and id=${repairId}`;await projected(full.slice(1),wf);
  assert.equal(Number((await tx`select generation from chinatech_v2_private.repair_list_models where store_id=${store}`)[0].generation),7);
  const groupSettings=defaultRepairGroups();groupSettings.workflow.reverse();groupSettings.parts.reverse();
  await tx`insert into chinatech_v2_private.store_state(store_id,settings) values(${store},${tx.json({...defaultStoreSettings,repairGroups:groupSettings})})`;
  for(let i=0;i<265;i++){
   const next={...noSources,id:'LOCAL-'+(100000+i).toString(16).toUpperCase().padStart(16,'0'),model:i===263?'İ'.repeat(100):'DEMO model '+i,customerName:'DEMO '+i,issue:i===264?'DEMO TAIL ΟΣ İ ß':'DEMO routine',priority:['普通','紧急','优先'][i%3],createdAt:`2026-10-${String(1+i%15).padStart(2,'0')} 12:00:00`,updatedAt:`2026-10-${String(1+(264-i)%15).padStart(2,'0')} 12:00:00`,...(i%11===0?{repairOrigin:{repairId,reason:'DEMO'}}:{})};
   const status=i%17===0?'completed':i%19===0?'cancelled':i%4===0?'ready_notified':i%5===0?'ready':'diagnosis',workflow={...base,status,updatedAt:next.updatedAt};
   await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures,workflow) values(${store},${next.id},${customer.id},${device.id},${tx.json(next)},'[]',${tx.json(workflow)})`;
  }
  const all=(await tx`select data,workflow from chinatech_v2_private.repair_intakes where store_id=${store} order by id`).map(row=>({document:row.data,workflow:row.workflow,order:overlayRepair(intakeDirectoryEntry(row.data),row.workflow)}));
  const allParts=(await tx`select data from chinatech_v2_private.procurement_records where store_id=${store} order by id`).map(row=>row.data),scope={formatVersion:2,accountId:randomUUID(),sessionId:randomUUID(),storeId:store,memberId:randomUUID(),memberRevision:1,permissions:['repairs.view']};
  const stats={all:all.length,active:all.filter(({order,workflow})=>!isRepairHistory(order,workflow)).length,history:all.filter(({order,workflow})=>isRepairHistory(order,workflow)).length};
  const queryCases=[];for(const sort of ['updated','created','priority'])for(const groupBy of ['workflow','parts','none'])for(const view of ['active','history','all'])queryCases.push({sort,groupBy,view});
  queryCases.push({groupBy:'workflow',view:'all',noticeFilter:'notified'},{groupBy:'workflow',view:'all',noticeFilter:'unnotified'},{groupBy:'workflow',status:'ready'},{groupBy:'parts',partsFilter:'draft'},{q:'TAIL ος i̇ ss',view:'all'},{q:'DEMO model 26',view:'all'},{q:'İ'.repeat(100),view:'all'});
  for(const raw of queryCases){
   const query=repairListQuery(raw),filtered=all.filter(({order,workflow})=>(query.view==='all'||isRepairHistory(order,workflow)===(query.view==='history'))&&(query.status==='all'||query.status==='including_cancelled'||(query.status==='handover'?hasCurrentRepairHandover(workflow)&&Boolean(workflow.followUp?.collectedUnpaid):repairStageStatus(workflow)===query.status))&&(query.partsFilter==='all'||repairPartsSummary(allParts,order.id,currentRepairRequirements(order,workflow)).group===query.partsFilter)&&[order.id,order.customer.name,order.customer.phone,order.device.brand,order.device.model,order.device.serial,order.issue].join(' ').toLocaleLowerCase().includes(query.q.toLocaleLowerCase())).sort((a,b)=>{
    const left=a.order,right=b.order;if(query.sort==='created')return left.createdAt.localeCompare(right.createdAt)||left.id.localeCompare(right.id);if(query.sort==='priority'){const scores={紧急:0,优先:1,普通:2},difference=scores[left.priority]-scores[right.priority];if(difference)return difference;}return left.updatedAt.localeCompare(right.updatedAt)||left.createdAt.localeCompare(right.createdAt)||left.id.localeCompare(right.id);
   });
   const groups=query.view==='history'?[{key:'all',label:'历史工单',rows:filtered}]:query.groupBy==='none'?[{key:'all',label:'全部工单',rows:filtered}]:query.groupBy==='parts'?visibleRepairGroups(groupSettings,'parts').map(row=>({...row,rows:filtered.filter(({order,workflow})=>repairPartsSummary(allParts,order.id,currentRepairRequirements(order,workflow)).group===row.key)})):[...visibleRepairGroups(groupSettings,'workflow').map(row=>({...row,rows:filtered.filter(({order,workflow})=>workflowGroup(order,allParts,workflow)===row.key)})),...(query.view==='all'?[{key:'history',label:'历史工单',rows:filtered.filter(({order,workflow})=>isRepairHistory(order,workflow))}]:[])];
   const expectedGroups=groups.filter(group=>query.groupBy==='parts'&&query.view!=='history'||group.rows.length).map(group=>({...group,visible:group.key==='ready'&&query.noticeFilter!=='all'?group.rows.filter(({workflow})=>pickupNotice(workflow).startsWith('已通知')===(query.noticeFilter==='notified')):group.rows}));
   const first=await readRepairList(tx,scope,query);assert.equal(first.total,filtered.length);assert.deepEqual(first.stats,stats);assert.deepEqual(first.groups,expectedGroups.map(group=>({key:group.key,label:group.label,count:group.rows.length,visibleCount:group.visible.length,notified:group.rows.filter(({workflow})=>pickupNotice(workflow).startsWith('已通知')).length})));
   if(query.groupBy==='parts'&&query.view!=='history')assert.equal(first.group,null);
   for(const group of expectedGroups){
    const page=await readRepairList(tx,scope,query,{group:group.key});assert.deepEqual(page.items.map(row=>row.id),group.visible.slice(0,50).map(({order})=>order.id));assert(Buffer.byteLength(JSON.stringify(page))<=100000);
    if(group.visible.length>100){const next=await readRepairList(tx,scope,query,{group:group.key,cursor:page.nextCursor});assert.deepEqual(next.items.map(row=>row.id),group.visible.slice(50,100).map(({order})=>order.id));const back=await readRepairList(tx,scope,query,{group:group.key,cursor:next.previousCursor});assert.deepEqual(back.items,page.items);for(const options of [{seek:97},{anchor:group.visible[97].order.id}]){const sought=await readRepairList(tx,scope,query,{group:group.key,...options});assert.equal(sought.startIndex,97);assert.deepEqual(sought.items.map(row=>row.id),group.visible.slice(97,147).map(({order})=>order.id));}await assert.rejects(readRepairList(tx,scope,{...query,q:'different'},{group:group.key,cursor:page.nextCursor}),error=>error.status===409);}
   }
  }
  result.queryCases=queryCases.length;result.queryOracle='all original group orders/labels/counts, independent global scope counts, ready notification counts before filtering, three ascending sort orders, exact search, 50/next/back/seek/anchor and query-bound cursor';
  const context=await repairReadContext(tx,scope,{groupBy:'none',view:'all'});result.actualQueryPlan=await repairListSql(tx,scope,context,undefined,null,undefined,undefined,true);
  const longRows=[];
  for(let i=0;i<60;i++){
   const document={...noSources,id:'LOCAL-'+(900000+i).toString(16).toUpperCase().padStart(16,'0'),customerName:'客'.repeat(40)+'😀'.repeat(20),model:'DEMO '+('机'.repeat(100))+'😀'.repeat(27),issue:'DEMO-BUDGET '+('故'.repeat(2900)),updatedAt:time};
   const fingerprint=JSON.stringify([document.category,document.brand,document.model]),requirements=Array.from({length:3},(_,n)=>({id:'project:'+n,title:'项'.repeat(70)+'😀'.repeat(15),request:'规'.repeat(1100)+'😀'.repeat(50),revision:1,confirmed:false,mode:'pending',deviceFingerprint:fingerprint}));
   assert(load('./lib/repair-intake-record').validLocalIntake(document));load('./lib/repair-requirements').validateRepairRequirements(requirements);
   await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures,workflow) values(${store},${document.id},${customer.id},${device.id},${tx.json(document)},'[]',${tx.json({...base,updatedAt:time,requirements})})`;
   const row=procurement('DEMO-LONG-'+i,{repairId:document.id,supplier:'供'.repeat(200),specification:'规'.repeat(1200)});await tx`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data) values(${store},${row.id},${document.id},${tx.json(row)})`;longRows.push(document.id);
  }
  let longPage=await readRepairList(tx,scope,{groupBy:'none',view:'all',q:'DEMO-BUDGET'}),longSeen=[],longPages=[];
  for(let i=0;i<10;i++){assert.equal(longPage.total,60);assert(Buffer.byteLength(JSON.stringify(longPage))<=100000);assert(longPage.items.every(row=>row.chips.length===3&&row.chipCount===4&&row.chips.every(chip=>chip.preview)&&row.suppliersPreview));longSeen.push(...longPage.items.map(row=>row.id));longPages.push({rows:longPage.items.length,bytes:Buffer.byteLength(JSON.stringify(longPage)),start:longPage.startIndex});if(!longPage.nextCursor)break;longPage=await readRepairList(tx,scope,{groupBy:'none',view:'all',q:'DEMO-BUDGET'},{group:'all',cursor:longPage.nextCursor});}
  assert.deepEqual(longSeen,longRows);assert.equal(new Set(longSeen).size,60);assert(longPages[0].rows<50);result.longValidMultilingualBudget={canonicalFields:'80 UTF16 name;159 model;3x100 title;3x1200 request;200 supplier;1200 specification;Chinese plus supplementary emoji. Canonical validators passed.',pages:longPages,all60DeliveredExactlyOnce:true};
  // Fixture loading is deliberately excluded from the write measurement: in
  // this private rollback transaction only this NEW repair projection trigger
  // is suspended; canonical/procurement triggers remain active. Restore it and
  // project/verify the complete target before measuring the real 100-row write.
  const skewId='LOCAL-9999999999999999',skew={...noSources,id:skewId,model:'DEMO skew1000'};
  await tx`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures,workflow) values(${store},${skewId},${customer.id},${device.id},${tx.json(skew)},'[]',${tx.json(base)})`;
  await tx.unsafe('alter table chinatech_v2_private.procurement_records disable trigger zz_repair_list_procurement_sync');
  const skewRows=Array.from({length:1000},(_,i)=>procurement('DEMO-SKEW-'+String(i).padStart(4,'0'),{repairId:skewId,specification:'DEMO long specification '.repeat(45),events:[event('ordered')]}));
  for(let offset=0;offset<skewRows.length;offset+=200){const records=skewRows.slice(offset,offset+200).map(row=>({store_id:store,id:row.id,repair_id:skewId,data:row}));await tx`insert into chinatech_v2_private.procurement_records ${tx(records,'store_id','id','repair_id','data')}`;}
  await tx.unsafe('alter table chinatech_v2_private.procurement_records enable trigger zz_repair_list_procurement_sync');
  await tx`select chinatech_v2_private.project_repair_list(${store}::uuid,${skewId})`;
  const beforeGeneration=Number((await tx`select generation from chinatech_v2_private.repair_list_models where store_id=${store}`)[0].generation),writeStarted=performance.now();
  try{await tx.savepoint(async probe=>{
   await probe`select set_config('statement_timeout','30000',true)`;
   await probe`update chinatech_v2_private.procurement_records set data=jsonb_set(data,'{events}',(data->'events')||${probe.json([event('arrival',1)])}::jsonb) where store_id=${store} and id=any(${probe.array(skewRows.slice(0,100).map(row=>row.id),25)})`;
   const afterGeneration=Number((await probe`select generation from chinatech_v2_private.repair_list_models where store_id=${store}`)[0].generation);assert.equal(afterGeneration-beforeGeneration,100);
   result.writeAmplification={condition:'Single owner SQL UPDATE100 actual canonical ledgers in one repair containing1000 real ledgers, after normal triggers restored. One sample, not authenticated API or P95.',rows:100,relatedLedgers:1000,elapsedMs:performance.now()-writeStarted,repairProjectionCalls:afterGeneration-beforeGeneration,budgetPassed:false,note:'Known per-row recomputation; must coalesce the affected repair dependency set in P5 and remeasure.'};
  });}catch(error){result.writeAmplification={condition:'Same bounded100/1000 canonical probe',elapsedMs:performance.now()-writeStarted,errorCode:error.code,budgetPassed:false};if(error.code!=='57014')throw error;}
  await tx`delete from chinatech_v2_private.procurement_records where store_id=${store}`;
  await tx`delete from chinatech_v2_private.repair_intakes where store_id=${store} and id<>${repairId}`;
  await tx`delete from chinatech_v2_private.procurement_records where store_id=${store}`;await tx`delete from chinatech_v2_private.repair_intakes where store_id=${store}`;assert.equal(Number((await tx`select count(*) from chinatech_v2_private.repair_list_sources where store_id=${store}`)[0].count),0);
  result.cases.push('real canonical intake/procurement INSERT/UPDATE/DELETE triggers preserve same-transaction facts and generation; no costs/reference/events in summary');
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 assert.equal(Boolean((await sql`select to_regclass('chinatech_v2_private.repair_list_sources') name`)[0].name),installed);result.rolledBack=true;result.pass=true;
 const output=process.env.CT_PERF_REPAIR_PROOF??'../proof/repair-read-model-oracle.json';writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await sql.end();}
