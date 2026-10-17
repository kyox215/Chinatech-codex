import assert from'node:assert/strict';import test from'node:test';
import{readFileSync,statSync}from'node:fs';import{execFileSync}from'node:child_process';
import{sourceLoader}from'./helpers/typescript-source.mjs';
import{dashboardAccess,dashboardIntake,dashboardUnit,dashboardPurchase,dashboardSource}from'./helpers/dashboard-fixture.mjs';
const load=sourceLoader(),{buildDashboardSummary}=load('./lib/dashboard-summary'),{appendProcurementEvent}=load('./lib/procurement'),{workflowGroups}=load('./lib/repair-workflow');

test('dashboard counts all authorized repairs while selecting four most recently overlaid facts',()=>{
 const source=dashboardSource();source.intakes=Array.from({length:61},(_,i)=>dashboardIntake(i));
 const last=source.intakes.at(-1);source.workflows[last.id]={revision:1,status:'diagnosis',custody:'store',notice:null,events:[{id:'late',type:'stage',label:'维修阶段：待检测',note:'PRIVATE-WORKFLOW-NOTE',time:'2026-10-17 12:00:00'}],updatedAt:'2026-10-17 12:00:00'};
 const result=buildDashboardSummary(source,dashboardAccess);assert.equal(result.counts.processing,61);assert.equal(Object.keys(result.counts).length,Object.keys(workflowGroups).length);assert.equal(result.recent.length,4);assert.equal(result.recent[0].id,last.id);assert.deepEqual(result.recent.slice(1).map(row=>row.id),source.intakes.slice(0,3).map(row=>row.id));
 assert(!JSON.stringify(result).includes('PRIVATE-WORKFLOW-NOTE'));
});
test('current handed-over unpaid debt differs from historical handover followed by a new stage',()=>{
 const source=dashboardSource();source.intakes=[dashboardIntake(1),dashboardIntake(2)];
 for(const row of source.intakes)source.workflows[row.id]={revision:1,status:'diagnosis',custody:'customer',notice:null,events:[{id:'handed',type:'followup',label:'欠款已拿走：已记录',note:'',time:'2026-10-17 11:00:00'}],updatedAt:'2026-10-17 11:00:00',handedOver:{time:'2026-10-17 11:00:00',unpaid:true},followUp:{collectedUnpaid:true,awaitingReply:false}};
 const second=source.workflows[source.intakes[1].id];second.events.push({id:'reopened',type:'stage',label:'维修阶段：待检测',note:'',time:'2026-10-17 12:00:00'});second.updatedAt='2026-10-17 12:00:00';second.revision++;
 assert.equal(buildDashboardSummary(source,dashboardAccess).debtCount,1);
});
test('procurement first three follow canonical input order and all-complete differs from no procurement',()=>{
 const source=dashboardSource();source.intakes=[dashboardIntake(1)];source.procurement=Array.from({length:70},(_,i)=>dashboardPurchase('P-'+i,source.intakes[0].id));
 source.procurement[0]=appendProcurementEvent(source.procurement[0],{id:'arrival',type:'arrival',time:'2026-10-17 12:00:00',note:'PRIVATE-ARRIVAL-NOTE',quantity:2});
 const result=buildDashboardSummary(source,dashboardAccess);assert.equal(result.procurement.total,70);assert.deepEqual(result.procurement.pending.map(row=>row.id),['P-1','P-2','P-3']);assert.equal(result.procurement.pending[0].arrived,0);assert(!JSON.stringify(result).includes('PRIVATE-'));
 source.procurement=[source.procurement[0]];assert.deepEqual(buildDashboardSummary(source,dashboardAccess).procurement,{total:1,pending:[]});
 source.procurement=[];assert.deepEqual(buildDashboardSummary(source,dashboardAccess).procurement,{total:0,pending:[]});
});
test('four event sources retain global order and financial title redaction without transferring private detail',()=>{
 const source=dashboardSource(),intake=dashboardIntake(1);source.intakes=[intake];source.workflows[intake.id]={revision:1,status:'diagnosis',custody:'store',notice:null,updatedAt:'2026-10-17 12:00:00',events:[{id:'stage',time:'2026-10-17 12:00:00',type:'stage',label:'维修阶段：待检测',note:'PRIVATE-WORKFLOW'}]};source.procurement=[dashboardPurchase('P',intake.id)];source.retail=[dashboardUnit('UNIT',{events:[{id:'cost',title:'PRIVATE-COST-TITLE',detail:'PRIVATE-DETAIL costCents=12345',time:'2026-10-17 12:00:00'}]})];
 const result=buildDashboardSummary(source,dashboardAccess);assert.equal(result.activity.length,4);assert.deepEqual(new Set(result.activity.map(row=>row.source)),new Set(['intake','repair','procurement','retail']));assert.equal(result.activity.find(row=>row.source==='retail').label,'财务资料更正');assert(!JSON.stringify(result).includes('PRIVATE-'));
 const financial=buildDashboardSummary(source,{...dashboardAccess,financial:true});assert.equal(financial.activity.find(row=>row.source==='retail').label,'PRIVATE-COST-TITLE');assert(!JSON.stringify(financial).includes('PRIVATE-DETAIL'));
 for(const access of[{repairs:true,retail:false,financial:false},{repairs:false,retail:true,financial:false},{repairs:false,retail:false,financial:true}]){
  const value=buildDashboardSummary(source,access);assert.equal(value.groups.length,access.repairs?4:0);assert.equal(value.recent.length,access.repairs?1:0);assert.equal(value.procurement.total,access.repairs?1:0);assert.equal(value.activity.filter(row=>row.source==='retail').length,access.retail?1:0);assert.equal(value.activity.filter(row=>row.source!=='retail').length,access.repairs?3:0);
 }
});
test('source/row/event tuples remain distinct even when legacy concatenated activity IDs collide',()=>{
 const source=dashboardSource();source.retail=[dashboardUnit('DEMO',{events:[{id:'a:b',title:'First',detail:'DEMO',time:'2026-10-17 11:00:00'}]}),dashboardUnit('DEMO:a',{events:[{id:'b',title:'Second',detail:'DEMO',time:'2026-10-17 11:00:00'}]})];
 const result=buildDashboardSummary(source,dashboardAccess);assert.equal(result.activity.length,2);assert.equal(result.activity[0].id,result.activity[1].id);assert.notEqual(result.activity[0].key,result.activity[1].key);assert.deepEqual(result.activity.map(row=>row.label),['First','Second']);
});
test('valid maximum text remains previewed and linked facts fit the dashboard byte budget',()=>{
 const source=dashboardSource(),faults=Array.from({length:60},()=> '故'.repeat(49));source.intakes=Array.from({length:4},(_,i)=>dashboardIntake(i,{brand:'牌'.repeat(100),model:'型'.repeat(160),customerName:'客'.repeat(80),faults,issue:faults.join('、')}));
 source.procurement=Array.from({length:3},(_,i)=>dashboardPurchase('P-'+i,source.intakes[0].id,{item:'件'.repeat(10000),supplier:'商'.repeat(10000),expectedAt:'日'.repeat(10000)}));source.retail=Array.from({length:5},(_,i)=>dashboardUnit('UNIT-'+i,{events:[{id:'event',time:'2026-10-17 12:00:00',title:'事'.repeat(200),detail:'PRIVATE-DETAIL'}]}));
 const original=JSON.stringify(source),result=buildDashboardSummary(source,dashboardAccess);assert(Buffer.byteLength(JSON.stringify(result))<100000);assert.equal(result.recent[0].faults.length,60);assert(result.recent[0].previews.includes('issue'));assert.equal(result.procurement.pending[0].item.length,200);assert.deepEqual(result.procurement.pending[0].previews,['item','supplier','expectedAt']);assert.equal(JSON.stringify(source),original);
});
test('dashboard generator checks are read-only and reject unsupported invocations',()=>{
 const files=['supabase/migrations/20261017154056_performance_dashboard_read_model.sql','supabase/migrations/20261017185847_performance_dashboard_contract_version.sql','lib/backend/dashboard-version.ts'],before=files.map(file=>({bytes:readFileSync(file),time:statSync(file,{bigint:true}).mtimeNs}));
 execFileSync(process.execPath,['scripts/generate-dashboard-read-model.mjs','--check']);assert.throws(()=>execFileSync(process.execPath,['scripts/generate-dashboard-read-model.mjs','--invalid'],{stdio:'pipe'}));
 files.forEach((file,i)=>{assert.deepEqual(readFileSync(file),before[i].bytes);assert.equal(statSync(file,{bigint:true}).mtimeNs,before[i].time);});
});
