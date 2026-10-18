// Local-only entry: original target guard remains mandatory.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postgres from 'postgres';
import {runOperator} from './lib/activate-repair-list.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const at=value.indexOf('=');return[value.slice(0,at),value.slice(at+1)];})),storeId=args['--store-id'],file=args['--connection-file'];
assert.match(storeId??'',/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);assert(file,'Explicit project-local owner connection file required');
const config=JSON.parse(readFileSync(file,'utf8')),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert(['55422','55432','55442'].includes(url.port));if(url.port==='55432')assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');if(url.port==='55442')assert.equal(url.pathname,'/ct_perf_http_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false});
try {const result=await runOperator({sql,storeId:storeId});console.log(JSON.stringify(result));} finally {await sql.end();}
