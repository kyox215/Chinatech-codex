// A read-only PostgreSQL precision regression. No fixture, DDL or business write.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import postgres from 'postgres';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const require=name=>name==='server-only'?{}:name==='@/lib/backend/database'?{BackendError:class extends Error{}}:name.startsWith('.')?load(resolve(dirname(file),name+'.ts')):native(name);runInContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,createContext({exports,require,process:{env:{STORE_ADMISSION_SIGNING_KEY:'a'.repeat(64)}},Buffer,Date}),{filename:file});return exports;}
const {storePage,decodeStoreCursor}=load('lib/server/store-admission-page.ts');
const config=JSON.parse(readFileSync(process.env.CT_ONBOARDING_CONNECTION_FILE||'.local/backend/connection.private.json','utf8')),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55422');
const sql=postgres(config.DB_URL,{max:1,prepare:false,connect_timeout:5,ssl:false}),scopes=['management-driver-Date','own-projection-JSON'],checks=[];
try{
 await sql.begin('read only',async tx=>{
  for(const scope of scopes){
   const scan=async(before,old=false)=>{
    const out=await tx`with fixtures as (select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid as id,timestamptz '2026-10-17 00:00:00.123000+00'+(n/3)*interval '1 microsecond' as created_at from generate_series(1,77) n), page as (select id,created_at,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_created_at from fixtures where (${before?.createdAt??null}::text::timestamptz is null or (created_at,id)<(${before?.createdAt??null}::text::timestamptz,${before?.id??null}::uuid)) order by created_at desc,id desc limit 26) select id,created_at,cursor_created_at,to_jsonb(page) as json_projection from page`;
    const rows=scope==='own-projection-JSON'?out.map(row=>row.json_projection):out;
    const page=storePage(rows,77,scope);let next=decodeStoreCursor(page.page.nextCursor,scope);
    if(old&&next){const last=page.items.at(-1);next={createdAt:new Date(last.created_at).toISOString(),id:last.id};}
    return {page,next};
   };
   const collect=async old=>{const ids=[];let next;let pages=0;do{const result=await scan(next,old);ids.push(...result.page.items.map(row=>row.id));next=result.next;assert(++pages<8);}while(next);return {ids,pages};};
   const old=await collect(true),fixed=await collect(false);assert(old.ids.length<77,'The historical millisecond cursor must reproduce missing rows');assert.equal(fixed.ids.length,77);assert.equal(new Set(fixed.ids).size,77);assert(fixed.pages>2);checks.push({scope,oldMissingRows:77-old.ids.length,fixedRows:fixed.ids.length,fixedPages:fixed.pages,duplicateRows:fixed.ids.length-new Set(fixed.ids).size});
  }
 });
 const evidence=process.env.CT_ONBOARDING_EVIDENCE_DIR||'.local/multistore-onboarding-evidence';mkdirSync(evidence,{recursive:true});writeFileSync(resolve(evidence,'pagination-precision.json'),JSON.stringify({readOnly:true,checks},null,2));console.log('PASS actual PostgreSQL microsecond and UUID keyset across '+checks.length+' driver/JSON paths');
}finally{await sql.end();}
