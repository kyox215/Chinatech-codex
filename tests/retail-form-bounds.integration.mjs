import assert from'node:assert/strict';
import{readFileSync,writeFileSync}from'node:fs';
import{randomUUID,createHash}from'node:crypto';
import postgres from'postgres';
import{sourceLoader}from'./helpers/typescript-source.mjs';
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json')),url=new URL(config.DB_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),load=sourceLoader(),{emptyRetailUnit,parseStoredRetailUnits}=load('./lib/retail'),{readRetailList}=load('./lib/backend/retail-list-read'),{buildRetailListIndex,queryRetailList}=load('./lib/retail-list-model'),store=randomUUID(),rollback=new Error('rollback maximum original fields'),candidate=process.argv.includes('--candidate'),output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'../proof/retail-form-bounds.json',result={condition:'Dedicated local SQL-only ICU database; actual original stored validator and canonical INSERT triggers in rolled-back transaction. Not Auth/browser/P95.',candidate,checks:[]};
let failure;
try{try{await sql.begin(async tx=>{
 if(candidate)await tx.unsafe(readFileSync('supabase/migrations/20261017063155_performance_unicode17_compatibility.sql','utf8'));
 await tx`insert into chinatech_v2.stores(id,name)values(${store},'DEMO maximum original text')`;
 // Deterministic high entropy valid ASCII avoids TOAST-compression hiding a wide B-tree key.
 let brand='';for(let index=0;brand.length<5000;index++)brand+=createHash('sha256').update('DEMO-BRAND-'+index).digest('base64');brand=brand.slice(0,5000);
 const unit={...emptyRetailUnit(),id:'DEMO-MAXIMUM',code:'DEMO-MAXIMUM',brand,model:'ﷺ'.repeat(5000),cpu:'ﷺ'.repeat(5000),gpu:'ﷺ'.repeat(5000),keyboard:'ﷺ'.repeat(5000),edition:'ﷺ'.repeat(5000),category:'laptop',storeOwned:true};
 assert.equal(parseStoredRetailUnits(JSON.stringify({version:1,units:[unit]}),[]).length,1);result.originalValidatorPassed=true;
 const started=performance.now();await tx`insert into chinatech_v2_private.retail_units(store_id,id,data)values(${store},${unit.id},${tx.json(unit)})`;result.insertSingleMs=performance.now()-started;
 const[projected]=await tx`select count(*)::integer n,max(octet_length(value_key))::integer maximum_normalized_bytes from chinatech_v2_private.retail_form_values where store_id=${store}`;assert.equal(projected.n,6);result.projection=projected;
 const[original]=await tx`select data->>'brand' brand,data->>'model' model from chinatech_v2_private.retail_units where store_id=${store} and id=${unit.id}`;assert.equal(original.brand,brand);assert.equal(original.model,unit.model);result.checks.push('All six longest valid original fields survive actual canonical INSERT and same-transaction projection without truncation or wide-index failure');
 const units=[unit];for(const suffix of['9','10']){const next={...emptyRetailUnit(),id:'DEMO-MAX-'+suffix,code:'DEMO-MAX-'+suffix,brand,model:'DEMO Model '+suffix,storeOwned:true};assert.equal(parseStoredRetailUnits(JSON.stringify({version:1,units:[next]}),[]).length,1);units.push(next);await tx`insert into chinatech_v2_private.retail_units(store_id,id,data)values(${store},${next.id},${tx.json(next)})`;}
 const scope={formatVersion:2,accountId:randomUUID(),sessionId:randomUUID(),storeId:store,memberId:randomUUID(),memberRevision:1,permissions:['retail.view']},actual=await readRetailList(tx,scope,{view:'other',sort:'name-asc'}),expected=queryRetailList(buildRetailListIndex(units,[]),{view:'other',condition:'all',query:'',category:'all',review:false,status:'all',sort:'name-asc',page:1});assert.deepEqual(actual.items.map(row=>row.key),expected.items.map(row=>row.key));assert.equal(actual.total,3);result.checks.push('Replacing the wide name index preserves actual full SQL/Intl.Collator ordering, including two >5000-character shared prefixes with numeric9/10 tails');result.pass=true;throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
}catch(error){failure=error;result.pass=false;result.error={code:error.code??null,message:error.message};}finally{try{const[after]=await sql`select count(*)::integer n from chinatech_v2.stores where id=${store}`;assert.equal(after.n,0);result.ownedStoresAfter=after.n;}finally{await sql.end();writeFileSync(output,JSON.stringify(result,null,2));}}
console.log(JSON.stringify(result));if(failure)throw failure;
