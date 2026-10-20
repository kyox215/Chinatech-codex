// Local-only entry: original target guard remains mandatory.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postgres from 'postgres';
import {runOperator} from './lib/activate-customer-devices.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];})),store=args['--store-id'],file=args['--connection-file'];assert.match(store??'',/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);assert(file,'Explicit project-local owner connection required');const config=JSON.parse(readFileSync(file)),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert(['55432','55442'].includes(url.port));assert.equal(url.pathname,url.port==='55432'?'/ct_perf_acceptance_icu_20261017':'/ct_perf_http_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false,connection:{statement_timeout:90000}});
try {const result=await runOperator({sql,storeId:store});console.log(JSON.stringify(result));} finally {await sql.end();}
