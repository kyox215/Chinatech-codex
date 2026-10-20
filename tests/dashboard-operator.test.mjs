import assert from'node:assert/strict';
import test from'node:test';
import{execFileSync}from'node:child_process';
import{expectedDashboardEvent}from'../scripts/lib/dashboard-projection-verifier.mjs';
test('flat dashboard operator keeps four source identities/position/quantity and canonical input untouched',()=>{
 const rows=[{source:'repair',entity_id:'DEMO',position:0,kind:'intake',event:{id:'',time:'DEMO time',type:'intake',label:''}},{source:'repair',entity_id:'DEMO',position:1,kind:'repair',event:{id:'stage',time:'DEMO time',type:'stage',label:'DEMO stage'}},{source:'procurement',entity_id:'DEMO',position:2,kind:'procurement',event:{id:'arrival',time:'DEMO time',type:'arrival',quantity:0}},{source:'retail',entity_id:'DEMO',position:3,kind:'retail',event:{id:'change',time:'DEMO time',title:'DEMO title',detail:'DEMO detail'}}],original=JSON.stringify(rows),actual=rows.map(expectedDashboardEvent);
 assert.equal(new Set(actual.map(v=>v.key)).size,4);assert.deepEqual(actual.map(v=>v.position),[0,1,2,3]);assert.deepEqual(actual.map(v=>v.quantity),[null,null,0,null]);assert.deepEqual(actual.map(v=>v.label),['','DEMO stage','','DEMO title']);assert(actual.every(v=>v.privateLabel===null));assert.equal(JSON.stringify(rows),original);
});
test('flat financial titles are separate by flag or original regex; plain text never becomes private',()=>{
 for(const event of[{title:'DEMO raw title',detail:'DEMO',sensitive:'financial'},{title:'DEMO raw title',detail:'costCents=100'},{title:'成本更正',detail:'DEMO'}]){const row=expectedDashboardEvent({source:'retail',entity_id:'DEMO',kind:'retail',position:1,event:{...event,id:'x',time:'DEMO'}});assert.equal(row.label,'财务资料更正');assert.equal(row.privateLabel,event.title);assert(!('detail'in row));}
 assert.equal(expectedDashboardEvent({source:'retail',entity_id:'DEMO',kind:'retail',position:1,event:{id:'x',time:'DEMO',title:'DEMO',detail:'ordinary'}}).privateLabel,null);
});
test('tuple source keys distinguish ambiguous concatenated legacy ids without affecting original display id',()=>{
 const one=expectedDashboardEvent({source:'retail',entity_id:'DEMO',kind:'retail',position:1,event:{id:'a:b',time:'DEMO',title:'DEMO',detail:''}}),two=expectedDashboardEvent({source:'retail',entity_id:'DEMO:a',kind:'retail',position:1,event:{id:'b',time:'DEMO',title:'DEMO',detail:''}});assert.equal(one.id,two.id);assert.notEqual(one.key,two.key);assert.equal(one.key,'["retail", "DEMO", "a:b"]');
});
test('dashboard operator defaults to a zero-connection plan and rejects unknown options before reading credentials',()=>{
 const value=JSON.parse(execFileSync(process.execPath,['scripts/backfill-dashboard.mjs'],{encoding:'utf8'}));assert(value.planOnly);assert.equal(value.connections,0);assert.equal(value.maximumRows,200);assert.equal(value.maximumBytes,200000);assert.throws(()=>execFileSync(process.execPath,['scripts/backfill-dashboard.mjs','--unknown'],{stdio:'pipe'}));
});
