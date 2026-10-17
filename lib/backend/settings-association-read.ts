import type{TransactionSql}from'postgres';
import type{BackendReadScope}from'./read-plan';
import{repairReadContext}from'./repair-list';
import{retailModelGeneration}from'./retail-list-read';
import{retailFormGeneration}from'./retail-form-read';
import type{SettingsAssociation,SettingsSectionQuery}from'./settings-section-contract';

export async function settingsAssociationGeneration(tx:TransactionSql,scope:BackendReadScope){
 const repair=scope.permissions.includes('repairs.view')?(await repairReadContext(tx,scope)).generation:null;
 const retail=scope.permissions.includes('retail.view')?[await retailModelGeneration(tx,scope.storeId),await retailFormGeneration(tx,scope.storeId)]:null;
 return JSON.stringify([repair,retail]);
}
/** Labels come from the existing full-text, photo-free projections. They keep
 * canonical input order (repairs, then units), source-qualified option keys and
 * the original bare relatedId value. No sales/history/finance facts are read. */
export async function readSettingsAssociations(tx:TransactionSql,scope:BackendReadScope,query:SettingsSectionQuery,startIndex:number,pageLimit:number):Promise<{items:SettingsAssociation[];total:number}[]>{
 const needle=query.q.trim().toLowerCase();
 return tx`with source as(
  select 0 kind,'repair'::text source,id,id||' · '||coalesce(summary->>'model','')label from chinatech_v2_private.repair_list_sources where store_id=${scope.storeId} and ${scope.permissions.includes('repairs.view')}
  union all
  select 1 kind,'unit'::text source,s.id,s.code||' · '||coalesce(v.value,'')label from chinatech_v2_private.retail_list_sources s left join chinatech_v2_private.retail_form_values v on v.store_id=s.store_id and v.unit_id=s.id and v.field='model' where s.store_id=${scope.storeId} and s.source='unit' and ${scope.permissions.includes('retail.view')}
 ),matches as(select*from source where(${query.id}=''or id=${query.id})and(${needle}=''or strpos(chinatech_v2_private.query_lower(label),${needle})>0)),page as(select*from matches order by kind,id offset ${startIndex} limit ${pageLimit})
 select(select count(*)::integer from matches)total,coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',source||':'||id,'source',source,'label',left(label,200),'previews',case when length(label)>200 then'['||'"label"'||']'else'[]'end::jsonb)order by kind,id)from page),'[]'::jsonb)items`;
}
