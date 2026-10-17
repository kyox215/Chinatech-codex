import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const native = createRequire(import.meta.url), root = process.cwd();

function harness() {
  class BackendError extends Error { constructor(message, status=400, code) { super(message); this.status=status; this.code=code; } }
  const member = { id:'synthetic-member', name:'DEMO', email:'demo@example.invalid', role:'technician', revision:1, accountStatus:'active', membershipStatus:'active', permissions:['repairs.view','retail.view','customers.view'] };
  const access = { identity:{userId:'synthetic-account',sessionId:'synthetic-session'}, storeId:'synthetic-store', member };
  const state = { env:{BACKEND_CUSTOMER_LIST_READS:"1"}, access, member, revision:1, live:true, queries:[], transactions:0, rosterSize:1,dashboardContexts:0,dashboardReads:0,dashboardReady:true,dashboardGeneration:'5',modelGeneration:'3',
    intake:{id:'LOCAL-0000000000000001',phone:'+390000000001'},
    settings:{revision:1,shopName:'DEMO',address:'',phone:'',paper:'a4',repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers:[],finance:[]} };
  const tx = (parts,...values) => {
    const sql = parts.reduce((text,part,i)=>text+part+(i<values.length?values[i]?.sql??'?':''),'');
    return { sql, values, then:(resolve,reject)=>Promise.resolve().then(()=>{
      state.queries.push({sql,values});
      if(sql.includes('retail_list_sources')&&sql.trimStart().startsWith('with model'))return[{model_available:true,model_generation:'3',total:1,point_found:false,point_rank:0,view_counts:{available:1,sold:0,other:0},condition_counts:{all:1,新机:0,翻新机:1},items:[{key:'unit:DEMO-RETAIL',id:'DEMO-RETAIL',source:'unit',title:'DEMO',view:'available'}]}];
      if(sql.includes('retail_list_models'))return[{ready:true,generation:'3',vocabulary_hash:JSON.parse(readFileSync('lib/backend/retail-vocabulary-version.ts','utf8').match(/retailVocabularyHash=("[^"]+")/)[1]),sort_rules_hash:readFileSync('lib/server/intl-sort-contract.ts','utf8').match(/nativeSortRulesHash='([^']+)'/)[1]}];
      if(sql.startsWith('select id,code from chinatech_v2_private.retail_list_sources'))return state.identityConflict?[state.identityConflict]:[];
      if(sql.includes('select ready,generation::text')) return [{ready:true,generation:state.modelGeneration}];
      if(sql.trimStart().startsWith('with grouped as')) return [{total:1,items:[{phone:'+390000000001',name:'DEMO',email:'',repairs:1,sales:0,history:0,activity:'2026-10-10 00:00:00'}]}];
      if(sql.trimStart().startsWith('with scoped as'))return[{total:1,group_total:1,stats:{all:1,draft:1,open:0,complete:0},point_found:false,point_rank:0,items:[{id:'DEMO-PROC-1',repairId:state.intake.id,repairModel:'DEMO',item:'DEMO part',supplier:'DEMO supplier',quantity:1,arrived:0,status:'draft',expectedAt:'',ledgerRevision:0,groupKey:'DEMO supplier',groupFirst:'DEMO-PROC-1',groupCount:1}]}];
      if(sql.includes('select st.revision,s.name')) return [{revision:state.revision,name:'DEMO'}];
      if(sql.includes("settings->>'retailWarrantyMonths'"))return[{revision:state.settings.revision,warranty_months:state.settings.retailWarrantyMonths}];
      if(sql.startsWith("select jsonb_build_object('id',id,'code'"))return[{facts:{id:'DEMO-COPY',code:'DEMO-CODE',model:'DEMO copy original'}}];
      if(sql.includes("settings->>'paper'"))return[{revision:state.revision,paper:state.settings.paper,policy:{months:state.settings.repairWarrantyMonths,shopName:state.settings.shopName,address:state.settings.address,phone:state.settings.phone}}];
      if(sql.startsWith("select id,data->>'model'"))return[{id:state.intake.id,model:'DEMO selected model'}];
      if(sql.includes('select settings')||sql.includes('select (settings')) return [{settings:state.settings}];
      if(sql.includes('select staff_audit')) return [{staff_audit:[]}];
      if(sql.includes('select m.id,m.role')) return Array.from({length:state.rosterSize},(_,i)=>({id:i?'other-'+i:member.id,role:member.role,permissions:member.permissions,revision:member.revision,membership_status:'active',account_status:'active',display_name:'DEMO',email:'demo@example.invalid'}));
      if(sql.startsWith('select id from chinatech_v2_private.repair_intakes')||sql.startsWith('select repair_id from')) return [{id:state.intake.id,repair_id:state.intake.id}];
      if(sql.includes('from chinatech_v2_private.repair_intakes')) return [{data:state.intake,workflow:null,signatures:[]}];
      if(sql.includes('from chinatech_v2_private.procurement_records')||sql.includes('from chinatech_v2_private.retail_units')||sql.includes('from chinatech_v2_private.retail_history_records')||sql.includes('from chinatech_v2_private.customers')) return [];
      throw new Error('Unexpected synthetic SQL: '+sql);
    }).then(resolve,reject) };
  };
  tx.array = values => ({sql:'ARRAY',values});
  const modules = new Map();
  function load(request, from=root) {
    if(request==='server-only')return {};
    if(request==='react')return {cache:fn=>fn};
    if(!request.startsWith('.')&&!request.startsWith('@/'))return native(request);
    const file=resolve(request.startsWith('@/')?root:from,request.startsWith('@/')?request.slice(2):request).replace(/\.ts$/,'')+'.ts';
    if(file.endsWith('/backend/database.ts'))return {BackendError,withReadDatabase:async(identity,store,run)=>{state.transactions++;assert.equal(identity.sessionId,access.identity.sessionId);assert.equal(store,access.storeId);if(!state.live)throw new BackendError('revoked',401);return run(tx);}};
    if(file.endsWith('/server/intl-sort-keys.ts'))return {requireNativeSortRuntime(){}};
    if(file.endsWith('/backend/context.ts'))return {getServerAccess:async()=>access,getAuthIdentity:async()=>access.identity,memberForRead:async()=>state.member};
    // This seam isolates page ownership/transport; the actual dashboard SQL and
    // canonical oracle are exercised by dashboard-read.integration.mjs.
    if(file.endsWith('/backend/dashboard-read.ts'))return{dashboardReadContext:async()=>{state.dashboardContexts++;if(!state.dashboardReady)throw new BackendError('unready',503);return{generation:state.dashboardGeneration,stateToken:'dashboard-'+state.dashboardGeneration,groups:[]};},readDashboard:async(_tx,scope,{context})=>{state.dashboardReads++;return{formatVersion:1,scope,generation:context.generation,stateToken:context.stateToken,data:{counts:{},debtCount:0,groups:[],recent:[],procurement:{total:0,pending:[]},retail:{available:0,sold:0,other:0},activity:[]}};}};
    if(modules.has(file))return modules.get(file).exports;
    const loaded={exports:{}};modules.set(file,loaded);
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function('require','module','exports','process',code)(name=>load(name,dirname(file)),loaded,loaded.exports,{env:state.env});
    return loaded.exports;
  }
  return {...state,state,api:load('./lib/backend/page-state'),plans:load('./lib/backend/read-plan')};
}

test('session bootstrap and catalog serialize only current identity; no settings, roster audit or business reads',async()=>{
  const h=harness();h.state.rosterSize=150;
  const bootstrap=await h.api.loadSessionBootstrap(h.access), session=h.api.sessionSnapshot(bootstrap);
  assert.equal(session.settings,null);assert.equal(session.storeName,"DEMO");assert.equal(session.staff.members.length,1);assert.deepEqual(session.staff.audit,[]);
  assert.ok(Buffer.byteLength(JSON.stringify(session))<20*1024);
  h.state.queries.length=0;const catalog=await h.api.loadPageState(h.access,{kind:'catalog'});
  assert.equal(catalog.settings,null);assert.equal(catalog.staff.members.length,1);
  assert.equal(h.state.queries.length,1);assert.match(h.state.queries[0].sql,/select st.revision,s.name/);
  for(const domain of ['settings','intakes','signatures','procurement','retail','retailHistory','customers'])assert.equal(h.plans.backendDomainReady(catalog,domain),false);
});
test('bounded dashboard is opt-in, carries only its current scoped summary and revalidates known/model/session before transfer',async()=>{
 const h=harness();h.state.env.BACKEND_DASHBOARD_READS='1';const initial=await h.api.loadPageState(h.access,{kind:'dashboard'});assert.equal(initial.dashboardEnabled,true);assert.deepEqual(initial.read.ready,['staff']);assert.equal(initial.settings,null);assert.equal(initial.dashboard.scope.sessionId,h.access.identity.sessionId);assert.equal(h.state.dashboardReads,1);assert.equal(h.state.transactions,1);assert.equal(h.state.queries.length,1);
 for(const key of['intakes','procurement','retail','retailHistory','customers','signatures'])assert.deepEqual(initial[key],[]);
 const known=await h.api.loadPageState(h.access,{kind:'dashboard'},initial.stateToken,h.plans.backendScopeKey(initial.read.scope));assert(known.unchanged);assert.equal(h.state.dashboardReads,1);assert.equal(h.state.dashboardContexts,2);h.state.dashboardGeneration='6';const changed=await h.api.loadPageState(h.access,{kind:'dashboard'},initial.stateToken);assert.notEqual(changed.stateToken,initial.stateToken);assert.equal(changed.dashboard.generation,'6');assert.equal(h.state.dashboardReads,2);
 h.state.dashboardReady=false;await assert.rejects(h.api.loadPageState(h.access,{kind:'dashboard'},changed.stateToken),error=>error.status===503);assert.equal(h.state.dashboardReads,2);h.state.dashboardReady=true;h.state.live=false;const contexts=h.state.dashboardContexts;await assert.rejects(h.api.loadPageState(h.access,{kind:'dashboard'}),error=>error.status===401);assert.equal(h.state.dashboardContexts,contexts);
 assert.deepEqual(h.plans.pageDomains({kind:'dashboard'},{dashboard:true}),['staff']);assert(h.plans.pageDomains({kind:'dashboard'},{dashboard:false}).includes('intakes'));assert(h.plans.pageDomains({kind:'dashboard'},{dashboard:false}).includes('retail'));
});
test('retail new read flag uses explicit current defaults and one copy target, never full settings/canonical arrays; no edit does not invent ready metadata',async()=>{
 const h=harness();h.state.env.BACKEND_RETAIL_FORM_READS='1';h.state.member.permissions.push('retail.edit');h.state.revision=99;h.state.settings.revision=7;
 const state=await h.api.loadPageState(h.access,{kind:'retail-new',id:'DEMO-COPY'});
 assert.deepEqual(state.read.ready,['staff']);assert.equal(state.retailCreationDefaults.warrantyMonths,12);assert.equal(state.retailCreationDefaults.revision,7);assert.equal(state.retailCreationDefaults.copy.model,'DEMO copy original');assert.equal(state.settings,null);assert.deepEqual(state.retail,[]);assert.deepEqual(state.retailHistory,[]);
 assert.equal(h.state.queries.length,3);assert.equal(h.state.queries.filter(query=>query.sql.includes('from chinatech_v2_private.retail_units')).length,1);assert.match(h.state.queries.at(-1).sql,/where store_id=\? and id=\?/);
 h.state.member.permissions=h.state.member.permissions.filter(permission=>permission!=='retail.edit');h.state.queries.length=0;const denied=await h.api.loadPageState(h.access,{kind:'retail-new',id:'DEMO-COPY'});assert.equal(denied.retailCreationDefaults,undefined);assert.equal(h.state.queries.length,1);
 assert.deepEqual(h.plans.parsePageReadPlan({kind:'retail-new',id:'DEMO-COPY'}),{kind:'retail-new',id:'DEMO-COPY'});assert.throws(()=>h.plans.parsePageReadPlan({kind:'retail-new',id:'x'.repeat(101)}));
});
test('retail identity endpoint returns zero or one real item; absence is never a null list row',async()=>{const h=harness();h.state.member.permissions.push('retail.edit');const raw={id:'DEMO-new',code:'',brand:'DEMO',serial:'DEMO-SN',imei1:'',imei2:''};const empty=await h.api.loadRetailIdentityCheck(h.access,raw);assert.deepEqual(empty.items,[]);h.state.identityConflict={id:'DEMO-original',code:'DEMO-TAIL'};const found=await h.api.loadRetailIdentityCheck(h.access,raw);assert.deepEqual(found.items,[h.state.identityConflict]);});
test('repair detail reads only target/related IDs, exact signature and procurement scope; never unrelated domains',async()=>{
  const h=harness(), result=await h.api.loadPageState(h.access,{kind:'repair',id:h.state.intake.id});
  assert.equal(result.intakes[0].id,h.state.intake.id);assert.equal(result.settings.repairWarrantyMonths,6);
  const read=h.state.queries.find(q=>q.sql.startsWith('select data,workflow,signatures'));
  assert.match(read.sql,/store_id=\?.*and id=any\(ARRAY\)/);
  assert.match(h.state.queries.find(q=>q.sql.includes('select data from chinatech_v2_private.procurement_records')).sql,/repair_id=any/);
  assert.ok(h.state.queries.every(q=>!q.sql.includes('from chinatech_v2_private.customers')&&!q.sql.includes('from chinatech_v2_private.retail_units')&&!q.sql.includes('staff_audit')));
});
test('unchanged page revalidates scope but does not transfer/read business data or the finance ledger',async()=>{
  const h=harness(), first=await h.api.loadPageState(h.access,{kind:'repair',id:h.state.intake.id});
  h.state.queries.length=0;
  const unchanged=await h.api.loadPageState(h.access,{kind:'repair',id:h.state.intake.id},first.stateToken,h.plans.backendScopeKey(first.read.scope));
  assert.equal(unchanged.unchanged,true);assert.equal(h.state.queries.length,1);assert.ok(Buffer.byteLength(JSON.stringify(unchanged))<1024);
  h.state.member={...h.member,revision:2,permissions:[]};
  await assert.rejects(h.api.loadPageState(h.access,{kind:'repair',id:h.state.intake.id},first.stateToken,h.plans.backendScopeKey(first.read.scope)),error=>error.status===409&&error.code==='IDENTITY_CHANGED');
});
test('revoked session and unsupported plan fail before private data; missing permissions never query its domain',async()=>{
  const h=harness();h.state.live=false;
  await assert.rejects(h.api.loadPageState(h.access,{kind:'dashboard'}),error=>error.status===401);assert.equal(h.state.queries.length,0);
  h.state.live=true;h.state.member={...h.member,permissions:[]};const result=await h.api.loadPageState(h.access,{kind:'repairs'});
  assert.deepEqual(result.intakes,[]);assert.deepEqual(result.procurement,[]);
  assert.ok(h.state.queries.every(q=>!q.sql.includes('from chinatech_v2_private.repair_intakes')&&!q.sql.includes('from chinatech_v2_private.procurement_records')));
  for(const plan of [{kind:'invented'},{kind:'repair'},{kind:'catalog',id:'unexpected'},{kind:'repair',id:'x'.repeat(101)},{kind:'session',admin:true}])assert.throws(()=>h.plans.parsePageReadPlan(plan));
});

test('customer list initial is a bounded summary, with full count and no canonical module arrays, policy or audit',async()=>{
 const h=harness(),result=await h.api.loadPageState(h.access,{kind:'customers'});
 assert.equal(result.customerList.total,1);assert.equal(result.customerList.items.length,1);assert.equal(result.settings,null);
 for(const key of ['intakes','procurement','retail','retailHistory','customers','signatures'])assert.deepEqual(result[key],[]);
 assert.ok(h.state.queries.every(q=>!q.sql.includes('select data')&&!q.sql.includes('select settings')&&!q.sql.includes('staff_audit')));
 h.state.queries.length=0;const unchanged=await h.api.loadPageState(h.access,{kind:'customers'},result.stateToken,h.plans.backendScopeKey(result.read.scope));
 assert.equal(unchanged.unchanged,true);assert.ok(h.state.queries.every(q=>!q.sql.trimStart().startsWith('with grouped')));
});

test('customer read-model is opt-in; disabled module uses explicit complete compatibility domain reads',async()=>{
 const h=harness();h.state.env.BACKEND_CUSTOMER_LIST_READS="0";
 const result=await h.api.loadPageState(h.access,{kind:'customers'});
 assert.equal(result.customerListEnabled,false);assert.equal(result.customerList,undefined);
 assert.ok(h.state.queries.some(q=>q.sql.includes('from chinatech_v2_private.customers')));
 assert.ok(h.state.queries.every(q=>!q.sql.includes('customer_directory_models')&&!q.sql.trimStart().startsWith('with grouped')));
});

test('V2 selector adds no authorization transaction; actual read still rejects a revoked session before queries',async()=>{
 const h=harness();h.access.storeId='b7b79f4b-3862-468e-9adc-7a354d88eb6e';h.state.live=false;
 const selected=await h.api.getV2Access(new Request('http://localhost/api/backend/v2/page',{headers:{'x-ct-store-id':h.access.storeId}}));
 assert.deepEqual(selected,{identity:h.access.identity,storeId:h.access.storeId});assert.equal(h.state.transactions,0);
 await assert.rejects(h.api.loadPageState(selected,{kind:'catalog'}),error=>error.status===401);assert.equal(h.state.transactions,1);assert.equal(h.state.queries.length,0);
 await assert.rejects(h.api.getV2Access(new Request('http://localhost/api/backend/v2/page')),error=>error.status===400);assert.equal(h.state.transactions,1);
});

test('procurement opt-in SSR reads only narrow summaries; its known token and no-access path avoid business queries',async()=>{
 const h=harness();h.state.env.BACKEND_PROCUREMENT_LIST_READS='1';
 const initial=await h.api.loadPageState(h.access,{kind:'procurement'});
 assert.equal(initial.procurementListEnabled,true);assert.equal(initial.procurementList.total,1);assert.equal(initial.procurementList.query.groupBy,'supplier');assert.equal(initial.settings,null);
 for(const key of ['intakes','procurement','retail','retailHistory','customers','signatures'])assert.deepEqual(initial[key],[]);
 assert.ok(h.state.queries.every(row=>!row.sql.includes('select data')&&!row.sql.includes('select settings')));
 h.state.queries.length=0;const unchanged=await h.api.loadPageState(h.access,{kind:'procurement'},initial.stateToken);
 assert.equal(unchanged.unchanged,true);assert.ok(h.state.queries.every(row=>!row.sql.trimStart().startsWith('with scoped')));
 h.state.queries.length=0;h.state.member={...h.member,permissions:[]};await h.api.loadPageState(h.access,{kind:'procurement'});
 assert.ok(h.state.queries.every(row=>!row.sql.includes('procurement_list_')));
});

 test('bounded new forms read explicit defaults or exact preselection without marking other settings or business arrays ready',async()=>{
  const h=harness();h.state.env.BACKEND_REPAIR_LIST_READS='1';h.state.env.BACKEND_PROCUREMENT_LIST_READS='1';
  const intake=await h.api.loadPageState(h.access,{kind:'repair-new'});
  assert.deepEqual(intake.read.ready,['staff']);assert.equal(intake.settings,null);assert.equal(intake.intakeDefaults.policy.months,6);assert.equal(intake.intakeDefaults.paper,'a4');assert.equal(intake.intakeDefaults.policy.shopName,'DEMO');
  assert.equal(h.state.queries.length,2);assert(h.state.queries.every(row=>!row.sql.includes('from chinatech_v2_private.repair_intakes')&&!row.sql.includes('select settings')&&!row.sql.includes('suppliers')));
  h.state.queries.length=0;const plan=h.plans.parsePageReadPlan({kind:'procurement-new',id:h.state.intake.id}),procurement=await h.api.loadPageState(h.access,plan);
  assert.deepEqual(procurement.read.ready,['staff']);assert.equal(procurement.settings,null);assert.deepEqual(procurement.procurementRepairCandidate,{id:h.state.intake.id,model:'DEMO selected model'});assert.equal(h.state.queries.length,2);
  const selection=h.state.queries[1];assert.match(selection.sql,/or id=\?/);assert(selection.values.includes(h.state.intake.id));assert.match(selection.sql,/limit 12/);
  for(const snapshot of[intake,procurement])for(const field of['intakes','signatures','procurement','retail','retailHistory','customers'])assert.deepEqual(snapshot[field],[]);
  h.state.env.BACKEND_CUSTOMER_LIST_READS='0';assert(h.plans.pageDomains({kind:'repair-new'},{repairLists:true,customerLists:false}).includes('intakes'));
  assert.throws(()=>h.plans.parsePageReadPlan({kind:'procurement-new',id:'x'.repeat(101)}));
 });

test('retail opt-in SSR carries real bounded list facts and explicit ready; rollback/no-access never pretend empty canonical arrays are loaded',async()=>{
 const h=harness();h.state.env.BACKEND_RETAIL_LIST_READS='1';const plan=h.plans.parsePageReadPlan({kind:'retail',retailQuery:{q:'İ'.repeat(100)}}),initial=await h.api.loadPageState(h.access,plan);
 assert.equal(initial.retailListEnabled,true);assert.equal(initial.retailList.total,1);assert.deepEqual(initial.read.ready,['staff']);assert.equal(initial.settings,null);assert.equal(initial.retailList.query.q,'İ'.repeat(100));
 for(const field of['intakes','signatures','procurement','retail','retailHistory','customers'])assert.deepEqual(initial[field],[]);
 assert(h.state.queries.every(row=>!row.sql.includes('select data')&&!row.sql.includes('select settings')&&!row.sql.includes('staff_audit')));
 h.state.queries.length=0;const unchanged=await h.api.loadPageState(h.access,plan,initial.stateToken);assert(unchanged.unchanged);assert(h.state.queries.every(row=>!row.sql.includes('retail_list_sources')));
 h.state.queries.length=0;const apiUnchanged=await h.api.loadRetailListPage(h.access,initial.retailList.query,{known:initial.retailList.stateToken,anchor:'unit:DEMO-RETAIL'});assert(apiUnchanged.unchanged);assert(Buffer.byteLength(JSON.stringify(apiUnchanged))<=1024);assert(h.state.queries.every(row=>!row.sql.includes('retail_list_sources')));
 h.state.queries.length=0;h.state.member={...h.member,permissions:[]};const denied=await h.api.loadPageState(h.access,plan);assert.equal(denied.retailList,undefined);assert(h.state.queries.every(row=>!row.sql.includes('retail_list_')));assert.deepEqual(denied.read.ready,['staff']);
 h.state.member=h.member;h.state.env.BACKEND_RETAIL_LIST_READS='0';const legacy=await h.api.loadPageState(h.access,{kind:'retail'});assert.equal(legacy.retailListEnabled,false);assert(legacy.read.ready.includes('retail'));assert(legacy.read.ready.includes('retailHistory'));assert(h.state.queries.some(row=>row.sql.includes('from chinatech_v2_private.retail_units')));
});


test('retail source is part of the read owner and limits unit/original selection; legacy URLs keep no-unit fallback',async()=>{
 const arrays=values=>values.flatMap(value=>value?.sql==='ARRAY'?[value.values]:value?.values?arrays(value.values):[]);
 const h=harness(),unit={kind:'retail-unit',id:'11111111-1111-4111-8111-111111111111',retailSource:'unit'},history={...unit,retailSource:'history'};
 assert.notEqual(h.plans.pagePlanKey(unit),h.plans.pagePlanKey(history));assert.deepEqual(h.plans.parsePageReadPlan(history),history);assert.throws(()=>h.plans.parsePageReadPlan({...unit,retailSource:'arbitrary'}));assert.throws(()=>h.plans.parsePageReadPlan({kind:'retail',retailSource:'history'}));
 await h.api.loadPageState(h.access,history);const historyUnit=h.state.queries.find(row=>row.sql.startsWith('select data from chinatech_v2_private.retail_units'));assert.match(historyUnit.sql,/and data->'historyOrigin'->>'recordId'=\?/);assert.doesNotMatch(historyUnit.sql,/or id=|and id=\?/);const original=h.state.queries.find(row=>row.sql.startsWith('select data from chinatech_v2_private.retail_history_records'));assert.match(original.sql,/and id=any\(ARRAY\)/);assert.deepEqual(arrays(original.values)[0],[unit.id]);
 h.state.queries.length=0;await h.api.loadPageState(h.access,unit);const unitQuery=h.state.queries.find(row=>row.sql.startsWith('select data from chinatech_v2_private.retail_units'));assert.match(unitQuery.sql,/and id=\?/);assert.doesNotMatch(unitQuery.sql,/or data/);const linked=h.state.queries.find(row=>row.sql.startsWith('select data from chinatech_v2_private.retail_history_records'));assert.match(linked.sql,/id=any\(ARRAY\)/);assert.deepEqual(arrays(linked.values)[0],[]);
 h.state.queries.length=0;await h.api.loadPageState(h.access,{kind:'retail-unit',id:unit.id});assert.deepEqual(arrays(h.state.queries.find(row=>row.sql.startsWith('select data from chinatech_v2_private.retail_history_records')).values)[0],[unit.id]);
});


test('explicit v2 refresh separates unchanged business facts from the current store write watermark and keeps old requests compatible',async()=>{const h=harness(),plan={kind:'customers'},initial=await h.api.loadPageState(h.access,plan,undefined,undefined,2);assert.equal(initial.read.refreshVersion,2);h.state.revision=9;h.state.queries.length=0;const unchanged=await h.api.loadPageState(h.access,plan,initial.stateToken,h.plans.backendScopeKey(initial.read.scope),2);assert.equal(unchanged.unchanged,true);assert.equal(unchanged.refreshVersion,2);assert.equal(unchanged.revision,9);assert(!h.state.queries.some(row=>row.sql.includes('with grouped')));h.state.modelGeneration='4';const changed=await h.api.loadPageState(h.access,plan,initial.stateToken,undefined,2);assert.notEqual(changed.stateToken,initial.stateToken);assert(changed.customerList);const legacy=await h.api.loadPageState(h.access,plan);assert.equal(legacy.read.refreshVersion,undefined);h.state.revision=10;const legacyChanged=await h.api.loadPageState(h.access,plan,legacy.stateToken);assert.notEqual(legacyChanged.stateToken,legacy.stateToken);assert.equal(legacyChanged.unchanged,undefined);});
test('compatibility detail and new-form tokens retain their necessary global watermark dependency even when refresh v2 is requested',async()=>{for(const plan of[{kind:'repair',id:'LOCAL-0000000000000001'},{kind:'retail-new'},{kind:'repair-new'},{kind:'procurement-new'}]){const h=harness();h.state.env.BACKEND_RETAIL_FORM_READS='1';h.state.env.BACKEND_REPAIR_LIST_READS='1';h.state.env.BACKEND_PROCUREMENT_LIST_READS='1';const initial=await h.api.loadPageState(h.access,plan,undefined,undefined,2);assert.equal(initial.read.refreshVersion,undefined);h.state.revision=2;const changed=await h.api.loadPageState(h.access,plan,initial.stateToken,undefined,2);assert.notEqual(changed.stateToken,initial.stateToken);assert.equal(changed.unchanged,undefined);}});
