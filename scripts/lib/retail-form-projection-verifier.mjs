import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{sourceLoader}from'../../tests/helpers/typescript-source.mjs';
const{catalogNormalize,canonicalCatalogBrand}=sourceLoader()('./lib/device-catalog');
export async function retailFormCanonicalBatch(tx,storeId,cursor){
 return tx`select id,jsonb_build_object('category',data->'category','brand',data->'brand','model',data->'model','cpu',data->'cpu','gpu',data->'gpu','keyboard',data->'keyboard','edition',data->'edition') data from chinatech_v2_private.retail_units where store_id=${storeId} and id>${cursor} order by id limit 200`;
}
export function retailFormExpectedValues(unitId,data){
 const hash=value=>createHash('sha256').update(value).digest('hex');
 return['brand','model','cpu','gpu','keyboard','edition'].flatMap(field=>{
  const raw=data[field]??'',identity=field==='brand'||field==='model';
  if(!raw.trim()||!identity&&(raw.length>5000||/[\u0000-\u001f\u007f]/.test(raw)))return[];
  const value=identity?raw:raw.trim();
  const brand_key=canonicalCatalogBrand(data.brand??''),value_key=value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US'),catalog_key=catalogNormalize(value);
  return[{unit_id:unitId,field,category:data.category,brand_key,value,option_key:hash(value),value_key,catalog_key,search:value.toLowerCase(),brand_key_hash:hash(brand_key),value_key_hash:hash(value_key),catalog_key_hash:hash(catalog_key)}];
 });
}
export async function verifyRetailFormProjection(tx,storeId){
 let cursor='',verified=0,projectedValues=0,maxCanonicalBatch=0,maxSelectedTargetBytes=0,maxProjectionBatchBytes=0;
 for(;;){const rows=await retailFormCanonicalBatch(tx,storeId,cursor);assert(rows.length<=200);if(!rows.length)break;maxCanonicalBatch=Math.max(maxCanonicalBatch,rows.length);
  // The source remains full and authoritative. Hash complete derived columns in
  // PostgreSQL so compatibility expansion never moves a second wide copy into
  // operator memory; compare independently computed full JS values one unit at a time.
  const actual=await tx`select unit_id,field,category,encode(sha256(convert_to(brand_key,'UTF8')),'hex') brand_key,encode(sha256(convert_to(value,'UTF8')),'hex') value,option_key,encode(sha256(convert_to(value_key,'UTF8')),'hex') value_key,encode(sha256(convert_to(catalog_key,'UTF8')),'hex') catalog_key,encode(sha256(convert_to(search,'UTF8')),'hex') search,brand_key_hash,value_key_hash,catalog_key_hash from chinatech_v2_private.retail_form_values where store_id=${storeId} and unit_id=any(${tx.array(rows.map(row=>row.id),25)})`;
  maxProjectionBatchBytes=Math.max(maxProjectionBatchBytes,Buffer.byteLength(JSON.stringify(actual)));
  const byKey=new Map(actual.map(row=>[row.unit_id+':'+row.field,row]));let expectedCount=0;
  for(const row of rows){maxSelectedTargetBytes=Math.max(maxSelectedTargetBytes,Buffer.byteLength(JSON.stringify(row.data)));for(const expected of retailFormExpectedValues(row.id,row.data)){const digest={...expected};for(const field of['brand_key','value','value_key','catalog_key','search'])digest[field]=createHash('sha256').update(expected[field]).digest('hex');assert.deepEqual({...byKey.get(row.id+':'+expected.field)},digest);expectedCount++;}verified++;}
  assert.equal(actual.length,expectedCount);projectedValues+=actual.length;cursor=rows.at(-1).id;
 }
 const[counts]=await tx`select(select count(*)from chinatech_v2_private.retail_units where store_id=${storeId})::integer canonical,(select count(*)from chinatech_v2_private.retail_form_values where store_id=${storeId})::integer projected`;
 assert.equal(counts.canonical,verified);assert.equal(counts.projected,projectedValues,'No extra or missing recorded value');return{verified,projectedValues,maxCanonicalBatch,maxSelectedTargetBytes,maxProjectionBatchBytes};
}
