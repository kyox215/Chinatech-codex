import 'server-only';
import type {TransactionSql} from 'postgres';
import {nativeRetailSortKeys} from '../server/intl-sort-keys';
import {nativeSortRulesHash} from '../server/intl-sort-contract';
import {BackendError} from './database';

/** Only source facts changed by this already authorized command are transferred. */
export async function beginRetailSort(tx:TransactionSql,storeId:string){
 await tx`select chinatech_v2_private.retail_sort_begin_v1(${storeId})`;
}
export async function finishRetailSort(tx:TransactionSql,storeId:string,ids:ReadonlySet<string>){
 if(ids.size>2)throw new BackendError('后台核对结果无效，请稍后重试。',503);
 const rows=ids.size?await tx`select key,title,intake_date,sale_sort_date,sort_source_hash from chinatech_v2_private.retail_list_sources where store_id=${storeId} and id=any(${tx.array([...ids],25)}) and (sort_input_hash is distinct from sort_source_hash or sort_rules_hash is distinct from ${nativeSortRulesHash})`:[];
 if(rows.length>4||Buffer.byteLength(JSON.stringify(rows))>1000000)throw new BackendError('后台核对结果无效，请稍后重试。',503);
 for(const row of rows){
  let keys:ReturnType<typeof nativeRetailSortKeys>;
  try{keys=nativeRetailSortKeys({title:row.title,key:row.key,intakeDate:row.intake_date,saleSortDate:row.sale_sort_date});}catch{throw new BackendError('后台资料暂不可用。',503);}
  await tx`select chinatech_v2_private.retail_sort_put_v1(${storeId},${row.key},${row.sort_source_hash},${nativeSortRulesHash},${keys.name},${keys.tie},${keys.intake},${keys.sale})`;
 }
 await tx`select chinatech_v2_private.retail_sort_finish_v1(${storeId})`;
}
