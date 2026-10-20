import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import test from 'node:test';
const generator='scripts/generate-unicode-case-execution.mjs',prior='supabase/migrations/20261017063155_performance_unicode17_compatibility.sql',target='supabase/migrations/20261017122335_performance_unicode_case_execution.sql';
function fixture(run){const folder=mkdtempSync(resolve('tests/.tmp-unicode-case-generator-'));try{for(const path of[generator,prior,target]){mkdirSync(dirname(resolve(folder,path)),{recursive:true});copyFileSync(path,resolve(folder,path));}return run(folder,args=>spawnSync(process.execPath,[generator,...args],{cwd:folder,encoding:'utf8'}));}finally{rmSync(folder,{recursive:true,force:true});}}
function output(folder){const path=resolve(folder,target);return{body:readFileSync(path,'utf8'),mtime:statSync(path,{bigint:true}).mtimeNs};}
test('equivalent lowercase generator check is read only',()=>fixture((folder,run)=>{const before=output(folder),result=run(['--check']);assert.equal(result.status,0,result.stderr);assert.deepEqual(output(folder),before);}));
test('equivalent lowercase generator refuses changed original before writing',()=>fixture((folder,run)=>{writeFileSync(resolve(folder,prior),readFileSync(resolve(folder,prior),'utf8')+'\n');const before=output(folder),result=run([]);assert.notEqual(result.status,0);assert.match(result.stderr,/Reviewed migration9/);assert.deepEqual(output(folder),before);}));
test('equivalent lowercase generator refuses missing original before writing',()=>fixture((folder,run)=>{rmSync(resolve(folder,prior));const before=output(folder),result=run([]);assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);assert.deepEqual(output(folder),before);}));
test('equivalent lowercase generator refuses unknown flags before writing',()=>fixture((folder,run)=>{const before=output(folder),result=run(['--unknown']);assert.notEqual(result.status,0);assert.match(result.stderr,/Only the optional --check/);assert.deepEqual(output(folder),before);}));
test('equivalent lowercase rollback retains the exact old function and private ACL',()=>{
 const original=/create function chinatech_v2_private\.unicode17_lower\(value text\)returns text\n[\s\S]*?\n\$\$;/.exec(readFileSync(prior,'utf8'))[0];
 const rollback=readFileSync('scripts/rollback-unicode-case-execution.sql','utf8');assert(rollback.includes(original.replace('create function','create or replace function')));assert(rollback.includes('revoke all on function chinatech_v2_private.unicode17_lower(text)from public,anon,authenticated,chinatech_runtime;'));assert.match(rollback,/BEGIN;[\s\S]*COMMIT;\s*$/);
});
