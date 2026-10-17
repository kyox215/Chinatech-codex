import assert from'node:assert/strict';
import{readFileSync,writeFileSync}from'node:fs';
import{randomUUID,createHash}from'node:crypto';
import postgres from'postgres';
import{sourceLoader}from'./helpers/typescript-source.mjs';
import{reviewedRetailFormMigrations}from'./helpers/retail-form-migration.mjs';
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json')),url=new URL(config.DB_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),load=sourceLoader(),{catalogNormalize,canonicalCatalogBrand,catalogSearchTerms,catalogBrandAliases}=load('./lib/device-catalog'),{retailCatalogOptions}=load('./lib/retail-catalog'),{emptyRetailUnit,validateRetailUnit,identityConflict}=load('./lib/retail'),{readRetailFormCandidates,readRetailCreationDefaults,readRetailIdentityConflict}=load('./lib/backend/retail-form-read'),{defaultStoreSettings}=load('./lib/store-settings');
const migration='supabase/migrations/20261017060716_performance_retail_form_reads.sql',store=randomUUID(),scope={formatVersion:2,accountId:randomUUID(),sessionId:randomUUID(),storeId:store,memberId:randomUUID(),memberRevision:1,permissions:['retail.view','retail.edit']},units=[],rollback=new Error('rollback retail form oracle'),result={condition:'Dedicated PostgreSQL17.11 ICU owner SQL rollback; actual canonical trigger/read helpers and original JS oracle. Not HTTP/RLS/browser/production performance.',nodeIcu:process.versions.icu,migrationSha256:createHash('sha256').update(readFileSync(migration)).digest('hex'),checks:[]};
try{try{await sql.begin(async tx=>{
 result.ddl=await reviewedRetailFormMigrations(tx);
 await tx`insert into chinatech_v2.stores(id,name)values(${store},'DEMO retail form SQL oracle')`;await tx`insert into chinatech_v2_private.store_state(store_id,settings)values(${store},${tx.json(defaultStoreSettings)})`;
 const literals=['A-p.p l e','三星','\ufeffMI\u00a0','Unknown-Brand','Unknown Brand','İ','ΟΣ','ß','𐐨','Ⅻ','①','²','四','𠀀','a+b','a\u0301','\u0345','\u200c','☀','ＥＤＩＴＩＯＮ','\ufeffA\u00a0B\ufeff','a\n b','\u{16EA0}Σ','AΣ\u{1E6E3}A','q\u0315\u0897','\u{A7F1}'];
 for(const value of literals){const[row]=await tx`select chinatech_v2_private.retail_form_catalog_key(${value}) key,chinatech_v2_private.retail_form_brand(${value}) brand,chinatech_v2_private.retail_form_value_key(${value}) option`;assert.equal(row.key,catalogNormalize(value),'catalog key '+value);assert.equal(row.brand,canonicalCatalogBrand(value),'canonical brand '+value);assert.equal(row.option,value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US'));}
 result.checks.push('Exact JS Letter/Number ranges, NFKC/plus/locale case, aliases, ECMAScript whitespace and stable option keys match actual ICU SQL');
 for(let index=0;index<75;index++){
  const unit={...emptyRetailUnit(),id:'DEMO-FORM-'+String(index).padStart(3,'0'),code:'DEMO-CODE-'+index,category:index%3?'laptop':'phone',brand:['Apple','苹果','A-p.p l e','DEMO'][index%4],model:index===70?'型'.repeat(4990)+'TAIL-MODEL':index%3?'DEMO Model '+index:'iPhone '+index,cpu:index%3===1?' Intel Core i5-8250U ':index%3===2?'ＣＰＵ　Value':'DEMO CPU '+index,gpu:'DEMO GPU '+index,keyboard:index%2?'IT':'DEMO Keyboard '+index,edition:index%2?'欧版':'DEMO Edition '+index,serial:'DEMO-SN-'+index,storeOwned:true};
  if(index===10)unit.imei2='490154203237518';if(index===60)unit.code='SN-ß';
  if(index===71){unit.brand='\u{16EA0}Σ';unit.cpu='\u{A7CE}-CPU';unit.gpu='AΣ\u{1E6E3}A';}
  validateRetailUnit(unit);units.push(unit);await tx`insert into chinatech_v2_private.retail_units(store_id,id,data)values(${store},${unit.id},${tx.json(unit)})`;
 }
 await tx`update chinatech_v2_private.retail_list_models set ready=true where store_id=${store}`;
 for(const field of['cpu','gpu','keyboard','edition'])for(const category of['phone','laptop','desktop'])for(const q of['','DEMO','intel','value','\u{A7CF}','aσ']){
  const options=retailCatalogOptions(field,category,'',units),expected=options.filter(row=>[row.value,row.label,row.detail??''].join(' ').toLowerCase().includes(q.trim().toLowerCase())),actual=await readRetailFormCandidates(tx,scope,{field,category,q});
  assert.equal(actual.total,expected.length,field+'/'+category+'/'+q);assert.equal(actual.items.length,Math.min(12,expected.length));
  for(let index=0;index<actual.items.length;index++){assert.equal(actual.items[index].label,[...expected[index].value].slice(0,160).join(''));const exact=await readRetailFormCandidates(tx,scope,{field,category,key:actual.items[index].key});assert.equal(exact.value,expected[index].value);}
 }
 result.checks.push('Four specification fields × three category applicability cases × six whole-store searches, including new Unicode17 raw search, match original preset priority, normalized deduplication, total count, first12 and exact full raw selection');
 for(const category of['phone','laptop'])for(const brand of['','Apple','苹果','A-p.p l e','DEMO'])for(const q of['','DEMO','TAIL-MODEL','İ'.repeat(100)]){
  const seen=new Set(),expected=units.filter(row=>row.category===category&&(!brand||canonicalCatalogBrand(row.brand)===canonicalCatalogBrand(brand))).map(row=>row.model).filter(value=>value&&!seen.has(value)&&seen.add(value)).filter(value=>catalogSearchTerms(q).every(term=>catalogNormalize(value).includes(term))),actual=await readRetailFormCandidates(tx,scope,{field:'model',category,brand,q});
  assert.equal(actual.total,expected.length);for(let index=0;index<actual.items.length;index++){assert.equal(actual.items[index].label,[...expected[index]].slice(0,160).join(''));const exact=await readRetailFormCandidates(tx,scope,{field:'model',category,brand,key:actual.items[index].key});assert.equal(exact.value,expected[index]);}
 }
 for(const q of['苹果','三星','a-p','DEMO','\u{16EBB}ς']){const expected=units.filter(row=>row.category==='laptop').map(row=>row.brand).filter((value,index,all)=>all.findIndex(previous=>catalogNormalize(previous)===catalogNormalize(value))===index).filter(value=>catalogSearchTerms(q).every(term=>catalogBrandAliases(value).some(alias=>catalogNormalize(alias).includes(term))));const page=await readRetailFormCandidates(tx,scope,{field:'brand',category:'laptop',q});assert.equal(page.total,expected.length);}
 result.checks.push('Brand aliases and model brand scope retain original identity-picker rules, long original tail search and full exact selection; valid expanding Unicode query remains idempotent');
 await tx`update chinatech_v2_private.store_state set revision=77,settings=jsonb_set(settings,'{revision}','11'::jsonb)where store_id=${store}`;
 const copied=await readRetailCreationDefaults(tx,scope,units[70].id);assert.equal(copied.copy.model,units[70].model);assert.equal(copied.revision,11);assert.equal(copied.warrantyMonths,defaultStoreSettings.retailWarrantyMonths);assert.deepEqual(Object.keys(copied.copy).sort(),['id','code','category','brand','model','color','ramGb','bodyStorage','disks','cpu','gpu','keyboard','edition','productCode'].sort());assert.equal((await readRetailCreationDefaults(tx,scope,'missing')).copy,null);
 for(const change of[{id:'new',code:units[0].code},{id:'new',brand:'ＡＰＰＬＥ',serial:units[0].serial},{id:'new',brand:'DEMO',serial:units[0].serial},{id:units[0].id,code:units[0].code},{id:'new',code:'ＳＮ-SS'},{id:'new',imei1:'490-154 203237518'},{id:'new',imei2:'490154203237518'},{id:units[10].id,imei1:units[10].imei2}]){const draft={...emptyRetailUnit(),...change},expected=identityConflict(draft,units),actual=await readRetailIdentityConflict(tx,scope,{id:draft.id,code:draft.code,brand:draft.brand,serial:draft.serial,imei1:draft.imei1,imei2:draft.imei2});assert.equal(actual?.id,expected?.id);}
 result.checks.push('Copy reads only14 original fields/default warranty with no photo/event/financial/inspection identity; full-store code/SN brand scope/self-exclusion conflict matches original');
 const[maximum]=await tx`select max(octet_length(value))::integer original from chinatech_v2_private.retail_form_values where store_id=${store}`;result.longestOriginalBytes=maximum.original;result.pass=true;throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 const[after]=await sql`select count(*)::integer n from chinatech_v2.stores where id=${store}`;assert.equal(after.n,0);result.cleanup='owned store and canonical/projection rows rolled back; preexisting exact DDL retained';
}finally{await sql.end();}
writeFileSync('../proof/retail-form-read-oracle.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
