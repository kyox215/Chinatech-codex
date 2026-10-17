import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {customerRecordCanonicalBatch} from '../scripts/lib/customer-record-projection-verifier.mjs';
import {sourceLoader} from './helpers/typescript-source.mjs';
const {buildCustomerDirectory}=sourceLoader()('./lib/customers');
function connection(reply){const calls=[];const tx=(strings,...values)=>{const text=strings.join('?');calls.push({text,values});return reply(text,values,calls);};tx.json=value=>({json:value});return{tx,calls};}
test('empty history advances to repairs; no unrelated sale query',async()=>{
 const fact={kind:'repairs',origin_id:'R',event_order:0};
 const {tx,calls}=connection(text=>text.includes("'history'kind")?[]:[fact]);
 assert.deepEqual(await customerRecordCanonicalBatch(tx,'store'),[fact]);assert.equal(calls.length,2);
 assert(calls.every(c=>c.text.includes('keys as materialized')&&c.text.includes('limit 200')));
});
test('completed repair cursor advances through empty physical units to later sales',async()=>{
 let headCalls=0;const fact={kind:'sales',origin_id:'S201',event_order:1};
 const {tx,calls}=connection(text=>{
  if(text.includes("'repairs'kind"))return[];
  if(text.includes('jsonb_array_length'))return++headCalls===1?Array.from({length:200},(_,i)=>({id:'S'+String(i).padStart(3,'0'),length:0})):[{id:'S201',length:1}];
  return[fact];
 });
 assert.deepEqual(await customerRecordCanonicalBatch(tx,'store',['repairs','R',0]),[fact]);
 assert.equal(headCalls,2);assert.equal(calls.filter(c=>c.text.includes('jsonb_array_length'))[1].values[2],'S199');
 assert.deepEqual(calls.at(-1).values[0].json,[{id:'S201',ordinality:1}]);
});
test('same physical sale resumes exact ordinal and caps keys before document construction',async()=>{
 const {tx,calls}=connection(text=>text.includes('jsonb_array_length')?[{id:'U',length:1000}]:[{kind:'sales',origin_id:'U',event_order:401}]);
 await customerRecordCanonicalBatch(tx,'store',['sales','U',400]);
 const keys=calls.at(-1).values[0].json;assert.equal(keys.length,200);assert.deepEqual(keys[0],{id:'U',ordinality:401});assert.deepEqual(keys.at(-1),{id:'U',ordinality:600});
 const text=calls.at(-1).text;assert(text.includes('jsonb_to_recordset'));assert(!text.includes("jsonb_array_elements(coalesce(u.data->'sales'"));
 assert(text.includes('bytes<=200000 or n=1'));assert(text.includes("'refunds'"));assert(text.includes("'afterSales'"));assert(text.includes("s.value?'product'"));
});
test('completed sale skips its old positions and includes next physical identity',async()=>{
 const {tx,calls}=connection(text=>text.includes('jsonb_array_length')?[{id:'U',length:1},{id:'V',length:2}]:[]);
 assert.deepEqual(await customerRecordCanonicalBatch(tx,'store',['sales','U',1]),[]);
 assert.deepEqual(calls.at(-1).values[0].json,[{id:'V',ordinality:1},{id:'V',ordinality:2}]);
});
test('no heads ends only the final sale stream; unknown cursor is rejected',async()=>{
 const {tx}=connection(()=>[]);assert.deepEqual(await customerRecordCanonicalBatch(tx,'store'),[]);
 await assert.rejects(()=>customerRecordCanonicalBatch(tx,'store',['bad','',0]));
});
test('legacy empty profile is ignored by original directory; explicit full profile stays authoritative',()=>{
 assert.deepEqual(buildCustomerDirectory([],[],[{}]),[]);
 const profile={phone:'+393200001111',name:'DEMO profile',email:'demo@example.invalid',note:'',version:1,updatedAt:'2026-10-17'};
 assert.equal(buildCustomerDirectory([],[],[profile])[0].name,profile.name);
 const source=readFileSync('scripts/lib/customer-directory-canonical.mjs','utf8');
 assert(source.includes("coalesce((select jsonb_object_agg(key,value)"));assert(source.includes("'{}'::jsonb)data"));
});
