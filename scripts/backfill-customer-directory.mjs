// Local-only entry: original target guard remains mandatory.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postgres from 'postgres';
import {runOperator} from './lib/activate-customer-directory.mjs';
const options=Object.fromEntries(process.argv.slice(2).map(value=>{const i=value.indexOf('=');return [value.slice(0,i),value.slice(i+1)];}));
const storeId=options['--store-id'], file=options['--connection-file'];
assert.match(storeId??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert(file,'Explicit project-local connection file required');
const config=JSON.parse(readFileSync(file)), endpoint=new URL(config.DB_URL);
assert.equal(endpoint.hostname,'127.0.0.1');assert(['55432','55442'].includes(endpoint.port));assert.equal(endpoint.pathname,endpoint.port==='55432'?'/ct_perf_acceptance_icu_20261017':'/ct_perf_http_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false,connection:{statement_timeout:30000,lock_timeout:5000}});
try {const result=await runOperator({sql,storeId:storeId});console.log(JSON.stringify(result));} finally {await sql.end();}
