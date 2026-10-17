import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import test from 'node:test';
import {sourceLoader} from './helpers/typescript-source.mjs';
import {requireProjectionQueryContract,projectionQueryModels} from '../scripts/lib/query-contract-verifier.mjs';

const load=sourceLoader(),{projectionQueryRulesHash}=load('./lib/backend/query-rules-version');
const generationReaders=[['customer-list','customerModelGeneration'],['procurement-list','procurementModelGeneration'],['retail-list-read','retailModelGeneration'],['retail-form-read','retailFormGeneration'],['customer-detail-read','customerRecordGeneration'],['customer-device-read','customerDeviceGeneration']];
const {nativeSortRulesHash}=load('./lib/server/intl-sort-contract');
const {retailVocabularyHash}=load('./lib/backend/retail-vocabulary-version'),{retailFormProjectionHash}=load('./lib/backend/unicode17-version'),{customerRecordRulesHash}=load('./lib/backend/customer-detail-version'),{customerDeviceRulesHash}=load('./lib/backend/customer-device-version');
test('all model readers bind current query semantics before trusting readiness',async()=>{
 for(const[module,name]of generationReaders){
  const read=load('./lib/backend/'+module)[name];let calls=0;
  const tx=async(strings,...values)=>{calls++;assert.match(strings.join('?'),/query_rules_hash=/);assert(values.includes(projectionQueryRulesHash));return[{ready:true,generation:'9007199254740999',vocabulary_hash:retailVocabularyHash,sort_rules_hash:nativeSortRulesHash,rules_hash:module==='retail-form-read'?retailFormProjectionHash:module==='customer-detail-read'?customerRecordRulesHash:customerDeviceRulesHash}];};
  assert.equal(await read(tx,'DEMO-store'),'9007199254740999');assert.equal(calls,1);
  await assert.rejects(read(async()=>[],'DEMO-store'),error=>error.status===503||error.statusCode===503);
 }
 const{repairReadContext}=load('./lib/backend/repair-list');let calls=0;
 await assert.rejects(repairReadContext(async(strings,...values)=>{calls++;assert.match(strings.join('?'),/query_rules_hash=/);assert(values.includes(projectionQueryRulesHash));return[];},{permissions:['repairs.view'],storeId:'DEMO-store'}),error=>error.status===503||error.statusCode===503);assert.equal(calls,1);
});
test('operators reject missing/old hash and unknown family; never repair metadata',async()=>{
 for(const model of projectionQueryModels){
  const tx=async(strings,...values)=>{assert.match(strings.join('?'),/select query_rules_hash from/);assert(!/update|insert|delete/i.test(strings.join('')));assert(values.includes('DEMO-store'));return[{query_rules_hash:projectionQueryRulesHash}];};
  // postgres identifiers are separate tagged-template values.
  const tagged=(first,...values)=>Array.isArray(first)&&'raw'in first?tx(first,...values):first;
  assert.equal(await requireProjectionQueryContract(tagged,'DEMO-store',model),projectionQueryRulesHash);
  for(const row of[[],[{query_rules_hash:'0'.repeat(64)}],[{}]])await assert.rejects(requireProjectionQueryContract(first=>Array.isArray(first)&&'raw'in first?Promise.resolve(row):first,'DEMO-store',model),/Exact reviewed Unicode/);
 }
 await assert.rejects(requireProjectionQueryContract(()=>{throw new Error('Must not reach SQL');},'DEMO-store','customer_directory;drop schema public'),/Known projection/);
});
test('state tokens change when only query rules change, including unchanged reads',()=>{
 const scope={formatVersion:2,accountId:'DEMO-a',sessionId:'DEMO-s',storeId:'DEMO-store',memberId:'DEMO-m',memberRevision:1,permissions:['repairs.view','retail.view','customers.view']};
 const oldLoad=sourceLoader(process.cwd(),{'./query-rules-version':{projectionQueryRulesHash:'0'.repeat(64)}});
 for(const[module,name,query]of[['customer-list','customerListToken',{q:'',mode:'directory'}],['procurement-list','procurementListToken',{}],['retail-list-read','retailReadToken',{}]])assert.notEqual(load('./lib/backend/'+module)[name](scope,'7',query),oldLoad('./lib/backend/'+module)[name](scope,'7',query));
});

const generator='scripts/generate-unicode-query-contract.mjs',migration='supabase/migrations/20261017142651_performance_unicode_query_contract.sql',version='lib/backend/query-rules-version.ts';
const originalFiles=['20261017000734_performance_customer_read_model.sql','20261017010109_performance_procurement_read_model.sql','20261017015301_performance_repair_read_model.sql','20261017050521_performance_retail_read_model.sql','20261017133040_performance_customer_record_execution.sql'].map(name=>'supabase/migrations/'+name);
function fixture(run){const folder=mkdtempSync(resolve('tests/.tmp-unicode-query-'));try{for(const name of[generator,migration,'scripts/rollback-unicode-query-contract.sql','scripts/enable-unicode-query-contract.sql','package.json','tests/helpers/typescript-source.mjs',...originalFiles]){const target=resolve(folder,name);mkdirSync(dirname(target),{recursive:true});cpSync(name,target);}cpSync('lib',resolve(folder,'lib'),{recursive:true});return run(folder,args=>spawnSync(process.execPath,[generator,...args],{cwd:folder,encoding:'utf8'}));}finally{rmSync(folder,{recursive:true,force:true});}}
const outputs=folder=>[migration,version,'lib/backend/retail-vocabulary-version.ts','scripts/rollback-unicode-query-contract.sql','scripts/enable-unicode-query-contract.sql'].map(name=>({body:readFileSync(resolve(folder,name),'utf8'),mtime:statSync(resolve(folder,name),{bigint:true}).mtimeNs}));
test('query generator --check validates exact outputs without writes',()=>fixture((folder,run)=>{const before=outputs(folder),result=run(['--check']);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).checkOnly,true);assert.deepEqual(outputs(folder),before);}));
test('query generator rejects changed immutable input before writes',()=>fixture((folder,run)=>{const path=resolve(folder,originalFiles[0]);writeFileSync(path,readFileSync(path,'utf8')+'\n');const before=outputs(folder),result=run([]);assert.notEqual(result.status,0);assert.match(result.stderr,/Immutable producer/);assert.deepEqual(outputs(folder),before);}));
test('query generator rejects unsupported options before writes',()=>fixture((folder,run)=>{const before=outputs(folder),result=run(['--write']);assert.notEqual(result.status,0);assert.match(result.stderr,/Only --check/);assert.deepEqual(outputs(folder),before);}));
test('re-enable keeps both PL/pgSQL dollar delimiters in generated role preflight',()=>fixture((folder,run)=>{const result=run([]);assert.equal(result.status,0,result.stderr);const sql=readFileSync(resolve(folder,'scripts/enable-unicode-query-contract.sql'),'utf8');assert.match(sql,/^do \$\$begin$/m);assert.match(sql,/^end \$\$;$/m);assert(!/^do \$begin$|^end \$;$/m.test(sql));const before=outputs(folder),checked=run(['--check']);assert.equal(checked.status,0,checked.stderr);assert.deepEqual(outputs(folder),before);}));
