import type{TransactionSql}from'postgres';
import{defaultStoreSettings,type StoreSettings}from'../store-settings';
import{BackendError}from'./database';
import{applySettingsPatch,type SettingsPatch}from'./settings-patch';

type Access={settings:boolean;financeRead:boolean;financeEdit:boolean};
/** Validate only the explicitly supplied section with the original validator.
 * The small validation envelope is never persisted as a complete settings row. */
export function validateSettingsPatch(input:unknown,revision:number,access:Access):SettingsPatch{
 const raw=input as SettingsPatch;
 const seed:StoreSettings={...defaultStoreSettings,revision,suppliers:[],finance:[]};
 if(raw?.type==='finance.void')seed.finance=[{id:raw.id,kind:'income',amountCents:1,purpose:'validation',relatedId:'',note:'',time:'validation'}];
 const next=applySettingsPatch(seed,input,access);
 switch(raw.type){
  case'general':return{type:raw.type,values:{shopName:next.shopName,address:next.address,phone:next.phone,repairWarrantyMonths:next.repairWarrantyMonths,retailWarrantyMonths:next.retailWarrantyMonths}};
  case'printing':return{type:raw.type,paper:next.paper};
  case'orders':return{type:raw.type,repairGroups:next.repairGroups!};
  case'supplier':return{type:raw.type,supplier:next.suppliers[0]};
  case'finance.append':return{type:raw.type,entry:next.finance[0]};
  case'finance.void':return{type:raw.type,id:raw.id,reason:next.finance[0].voidReason!};
 }
}

/** Runs after the normal store lock/current membership/idempotency checks.
 * SQL retains the untouched JSONB sections; only a scalar witness is read for
 * uniqueness, ledger capacity or the exact original position to void/update. */
export async function writeSettingsPatch(tx:TransactionSql,storeId:string,revision:number,input:unknown,access:Access){
 const patch=validateSettingsPatch(input,revision,access);let changed;
 if(patch.type==='general'||patch.type==='printing'||patch.type==='orders'){
  const value=patch.type==='general'?patch.values:patch.type==='printing'?{paper:patch.paper}:{repairGroups:patch.repairGroups};
  changed=await tx`update chinatech_v2_private.store_state set settings=jsonb_set(settings||${tx.json(value)},'{revision}',to_jsonb(${revision+1}::bigint)) where store_id=${storeId} and(settings->>'revision')::bigint=${revision} returning(settings->>'revision')revision`;
 }else if(patch.type==='supplier'){
  const supplier=patch.supplier;
  const[witness]=await tx`with source as(select value,ordinality-1 position from chinatech_v2_private.store_state st cross join lateral jsonb_array_elements(st.settings->'suppliers')with ordinality where st.store_id=${storeId})select count(*)filter(where value->>'id'=${supplier.id})::integer matches,min(position)filter(where value->>'id'=${supplier.id})::text position,count(*)filter(where value->>'id'<>${supplier.id} and chinatech_v2_private.query_lower(chinatech_v2_private.directory_trim(value->>'name'))=${supplier.name.trim().toLowerCase()})::integer duplicate from source`;
  if(witness.matches>1||witness.duplicate)throw new BackendError('供应商资料异常或名称重复。',409);
  const position=witness.position===null?null:Number(witness.position);if(position!==null&&(!Number.isSafeInteger(position)||position<0))throw new BackendError('后台暂时不可用，请稍后重试。',503);
  const replacement=position===null?tx`(settings->'suppliers')||${tx.json([supplier])}`:tx`jsonb_set(settings->'suppliers',array[${String(position)}],${tx.json(supplier)})`;
  changed=await tx`update chinatech_v2_private.store_state set settings=jsonb_set(jsonb_set(settings,'{suppliers}',${replacement}),'{revision}',to_jsonb(${revision+1}::bigint)) where store_id=${storeId} and(settings->>'revision')::bigint=${revision} returning(settings->>'revision')revision`;
 }else if(patch.type==='finance.append'){
  const[witness]=await tx`select jsonb_array_length(settings->'finance')count,exists(select 1 from jsonb_array_elements(settings->'finance')value where value->>'id'=${patch.entry.id})duplicate from chinatech_v2_private.store_state where store_id=${storeId}`;
  if(!witness)throw new BackendError('后台暂时不可用，请稍后重试。',503);
  if(witness.duplicate)throw new BackendError('收支记录重复或作废原因异常。',409);
  if(witness.count>=5000)throw new BackendError('本地设置格式异常。');
  changed=await tx`update chinatech_v2_private.store_state set settings=jsonb_set(jsonb_set(settings,'{finance}',(settings->'finance')||${tx.json([patch.entry])}),'{revision}',to_jsonb(${revision+1}::bigint)) where store_id=${storeId} and(settings->>'revision')::bigint=${revision} returning(settings->>'revision')revision`;
 }else{
  const[witness]=await tx`with source as(select value,ordinality-1 position from chinatech_v2_private.store_state st cross join lateral jsonb_array_elements(st.settings->'finance')with ordinality where st.store_id=${storeId} and value->>'id'=${patch.id})select count(*)::integer matches,min(position)::text position,bool_or(coalesce(value->>'voidReason','')<>'')voided from source`;
  if(witness.matches!==1||witness.voided)throw new BackendError('原收支事实不能覆盖或删除；更正须追加。',409);
  const position=Number(witness.position);if(!Number.isSafeInteger(position)||position<0)throw new BackendError('后台暂时不可用，请稍后重试。',503);
  changed=await tx`update chinatech_v2_private.store_state set settings=jsonb_set(jsonb_set(settings,array['finance',${String(position)},'voidReason'],${tx.json(patch.reason)}),'{revision}',to_jsonb(${revision+1}::bigint)) where store_id=${storeId} and(settings->>'revision')::bigint=${revision} returning(settings->>'revision')revision`;
 }
 if(changed.length!==1)throw new BackendError('设置已变化，请重新核对。',409);
 return revision+1;
}
