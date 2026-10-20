import assert from 'node:assert/strict';
import {sourceLoader} from '../../tests/helpers/typescript-source.mjs';
const load=sourceLoader(),{nativeRetailSortKeys}=load('./lib/server/intl-sort-keys'),{nativeSortRulesHash}=load('./lib/server/intl-sort-contract');
export {nativeSortRulesHash};
// Explicit owner-only operator. Current raw projection witnesses are checked in
// the same locked transaction; only <=200 narrow source facts cross each batch.
export async function fillRetailNativeSort(tx,storeId,keys){
 assert(keys.length<=200);
 let count=0;for(let offset=0;offset<keys.length;offset+=25){const part=keys.slice(offset,offset+25);const rows=part.length?await tx`select key,title,intake_date,sale_sort_date,sort_source_hash from chinatech_v2_private.retail_list_sources where store_id=${storeId} and key=any(${tx.array(part,25)}) order by key for update`:[];
 assert.equal(rows.length,part.length);assert(Buffer.byteLength(JSON.stringify(rows))<=4500000);
 for(const row of rows){
  assert.match(row.sort_source_hash,/^[a-f0-9]{64}$/);
  const keys=nativeRetailSortKeys({title:row.title,key:row.key,intakeDate:row.intake_date,saleSortDate:row.sale_sort_date});
  // Owner bypass is confined to this local operator; runtime has no table UPDATE.
  const updated=await tx`update chinatech_v2_private.retail_list_sources set sort_input_hash=${row.sort_source_hash},sort_rules_hash=${nativeSortRulesHash},sort_name=${keys.name},sort_tie=${keys.tie},sort_intake=${keys.intake},sort_sale=${keys.sale} where store_id=${storeId} and key=${row.key} and sort_source_hash=${row.sort_source_hash} returning key`;
  assert.equal(updated.length,1);
 }
 count+=rows.length;}return count;
}
export async function requireRetailNativeSort(tx,storeId){
 await tx`select chinatech_v2_private.retail_sort_producers_v1()`;
 const[model]=await tx`select sort_rules_hash from chinatech_v2_private.retail_list_models where store_id=${storeId} for update`;
 assert.equal(model?.sort_rules_hash,nativeSortRulesHash);
 const[pending]=await tx`select count(*)::integer n from chinatech_v2_private.retail_list_sources where store_id=${storeId} and (sort_input_hash is distinct from sort_source_hash or sort_rules_hash is distinct from ${nativeSortRulesHash})`;
 assert.equal(pending.n,0,'Every source must have current native keys before activation');
}
