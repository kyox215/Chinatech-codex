import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import test from 'node:test';

const generator='scripts/generate-customer-record-execution.mjs';
const prior='supabase/migrations/20261017083601_performance_customer_record_reads.sql';
const target='supabase/migrations/20261017133040_performance_customer_record_execution.sql';
const rollback='scripts/rollback-customer-record-execution.sql';
function fixture(run){
 const folder=mkdtempSync(resolve('tests/.tmp-customer-record-generator-'));
 try{
  for(const path of[generator,prior,target,rollback]){mkdirSync(dirname(resolve(folder,path)),{recursive:true});copyFileSync(path,resolve(folder,path));}
  return run(folder,args=>spawnSync(process.execPath,[generator,...args],{cwd:folder,encoding:'utf8'}));
 }finally{rmSync(folder,{recursive:true,force:true});}
}
function outputs(folder){return[target,rollback].map(path=>{const absolute=resolve(folder,path);return existsSync(absolute)?{body:readFileSync(absolute,'utf8'),mtime:statSync(absolute,{bigint:true}).mtimeNs}:null;});}

test('customer record generator --check reads exact outputs without writing',()=>fixture((folder,run)=>{
 const before=outputs(folder),result=run(['--check']);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).checkOnly,true);assert.deepEqual(outputs(folder),before);
}));
test('customer record generator rejects changed prior before any output write',()=>fixture((folder,run)=>{
 writeFileSync(resolve(folder,prior),readFileSync(resolve(folder,prior),'utf8')+'\n');const before=outputs(folder),result=run([]);assert.notEqual(result.status,0);assert.match(result.stderr,/Reviewed migration10/);assert.deepEqual(outputs(folder),before);
}));
test('customer record generator rejects missing prior without writing',()=>fixture((folder,run)=>{
 rmSync(resolve(folder,prior));const before=outputs(folder),result=run([]);assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);assert.deepEqual(outputs(folder),before);
}));
test('customer record generator --check refuses altered migration without repair',()=>fixture((folder,run)=>{
 writeFileSync(resolve(folder,target),'unexpected output\n');const before=outputs(folder),result=run(['--check']);assert.notEqual(result.status,0);assert.match(result.stderr,/Generated migration bytes/);assert.deepEqual(outputs(folder),before);
}));
test('customer record generator --check refuses altered rollback without repair',()=>fixture((folder,run)=>{
 writeFileSync(resolve(folder,rollback),'unexpected rollback\n');const before=outputs(folder),result=run(['--check']);assert.notEqual(result.status,0);assert.match(result.stderr,/Generated rollback bytes/);assert.deepEqual(outputs(folder),before);
}));
test('customer record generator --check refuses missing output without creating it',()=>fixture((folder,run)=>{
 rmSync(resolve(folder,target));const before=outputs(folder),result=run(['--check']);assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);assert.deepEqual(outputs(folder),before);
}));
test('customer record generator rejects unsupported options without writing',()=>fixture((folder,run)=>{
 const before=outputs(folder),result=run(['--unknown']);assert.notEqual(result.status,0);assert.match(result.stderr,/Only the optional --check/);assert.deepEqual(outputs(folder),before);
}));
