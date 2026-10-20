import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import postgres from'postgres';import{sourceLoader}from'./helpers/typescript-source.mjs';
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json')),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),{withObservation,observedTransaction}=sourceLoader()('./lib/backend/request-observation'),rollback=Error('owned rollback');
try{const result=await withObservation(async()=>{try{await sql.begin(async raw=>{const tx=observedTransaction(raw),fragment=tx`42::integer`;
 const lazy=tx`select 'not executed' as value`;assert(lazy); // Constructed only; excluded from count.
 const one=tx`select ${fragment} value`;assert.equal((await one)[0].value,42);assert.equal((await one)[0].value,42); // Same query promise, one wire execution.
 assert.deepEqual(Array.from(await tx`select ${tx.array([1,2,3],23)} values`.values()),[[[1,2,3]]]);
 assert.equal((await tx.unsafe('select 8 as value').execute())[0].value,8);
 await tx`create temporary table observed_owned(value integer) on commit drop`;
 await tx`insert into observed_owned(value) values(4)`;
 assert.equal((await tx`select value from observed_owned`.finally(()=>{}))[0].value,4);
 await assert.rejects(tx`select 1/0`.catch(error=>{throw error;}));throw rollback;
 });}catch(error){if(error!==rollback)throw error;}});
 assert.match(result.timing,/db_query;dur=[\d.]+;desc="7 calls"/);assert(!result.timing.includes('observed_owned'));writeFileSync('../proof/request-observation-sql.json',JSON.stringify({pass:true,condition:'Independent PG17.11 ICU; actual postgres driver lazy fragments, arrays, fluent values/execute/finally, repeated await and failure in rolled-back transaction. Seven actual SQL statements; BEGIN/ROLLBACK excluded.',timing:result.timing},null,2));console.log(JSON.stringify({pass:true,timing:result.timing}));
}finally{await sql.end();}
