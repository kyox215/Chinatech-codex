import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceLoader} from './helpers/typescript-source.mjs';
const load=sourceLoader(),{customerListQuery}=load('./lib/backend/customer-list-contract'),{procurementListQuery}=load('./lib/backend/procurement-list-contract'),{procurementBatchQuery}=load('./lib/backend/procurement-batch-contract'),{repairListQuery}=load('./lib/backend/repair-list-contract'),{listSearchNeedle}=load('./lib/backend/list-search'),{parsePageReadPlan,pagePlanKey}=load('./lib/backend/read-plan');
const helpers=[value=>customerListQuery(value),value=>procurementListQuery({q:value}),value=>procurementBatchQuery({kind:'repairs',q:value}),value=>repairListQuery({q:value})];
test('bounded raw Unicode search survives repeated SSR/client/API normalization without losing expanded characters',()=>{
 for(const input of ['İ'.repeat(100),'İ'.repeat(160),'ﬃ'.repeat(160),' ΟΣ ß ＡＢＣ ','A'.repeat(160),'\u00a0Query\uFEFF'])for(const helper of helpers){const first=helper(input);assert.equal(first.q,input.trim());assert.deepEqual(helper(first.q),first);assert.deepEqual(helper(helper(first.q).q),first);assert.equal(listSearchNeedle(first.q),input.trim().toLocaleLowerCase());}
 assert.equal(listSearchNeedle(customerListQuery('İ'.repeat(100)).q).length,200);
 const phone=customerListQuery('ﬃ'.repeat(100),'phone');assert.equal(phone.q.length,100);assert.deepEqual(customerListQuery(phone.q,'phone'),phone);assert.equal(listSearchNeedle(phone.q,true).length,300);
});
test('ordinary ASCII and Unicode raw input limits remain 160 UTF16 units; no silent truncation',()=>{
 for(const helper of helpers){assert.throws(()=>helper('A'.repeat(161)),/请求资料无效/);assert.throws(()=>helper('İ'.repeat(161)),/请求资料无效/);assert.equal(helper('😀'.repeat(80)).q,'😀'.repeat(80));assert.throws(()=>helper('😀'.repeat(81)),/请求资料无效/);}
});
test('page-plan round trips preserve the complete legal query and reject overlong raw URLs',()=>{
 for(const kind of ['customers','procurement']){const q='İ'.repeat(100),input=kind==='customers'?{kind,q}:{kind,query:procurementListQuery({q})},first=parsePageReadPlan(input);assert.deepEqual(parsePageReadPlan(first),first);assert.equal(pagePlanKey(parsePageReadPlan(first)),pagePlanKey(first));assert.equal(kind==='customers'?first.q:first.query.q,q);assert.throws(()=>parsePageReadPlan(kind==='customers'?{kind,q:'A'.repeat(161)}:{kind,query:{q:'A'.repeat(161)}}),/请求资料无效/);}
});
