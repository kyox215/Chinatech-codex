import 'server-only';
import {createHash} from 'node:crypto';
import type {TransactionSql} from 'postgres';
import {BackendError} from './database';
import {backendScopeKey,type BackendReadScope} from './read-plan';
import {projectionQueryRulesHash} from './query-rules-version';
import {retailVocabularyHash} from './retail-vocabulary-version';
import {dashboardRulesHash} from './dashboard-version';
import {defaultRepairGroups,visibleRepairGroups} from '../repair-groups';
import {workflowGroups} from '../repair-workflow';
import type {DashboardData,DashboardPage} from './dashboard-contract';

export type DashboardContext={generation:string;stateToken:string;groups:DashboardData['groups']};
/** Must run in the same current authorized read transaction as dashboardSql.
 * Only applicable domains are required; an unrelated domain never blocks it. */
export async function dashboardReadContext(tx:TransactionSql,scope:BackendReadScope):Promise<DashboardContext>{
 const repairs=scope.permissions.includes('repairs.view'),retail=scope.permissions.includes('retail.view');
 const[row]=await tx`select s.name,st.settings->'repairGroups' groups,
  (select (to_jsonb(m)-'backfill_cursor'-'verified_at')||jsonb_build_object('generation',m.generation::text) from chinatech_v2_private.dashboard_models m where m.store_id=s.id) dashboard,
  ${repairs?tx`(select (to_jsonb(m)-'backfill_cursor'-'verified_at')||jsonb_build_object('generation',m.generation::text) from chinatech_v2_private.repair_list_models m where m.store_id=s.id)`:tx`null::jsonb`} repair,
  ${repairs?tx`(select (to_jsonb(m)-'backfill_cursor'-'verified_at')||jsonb_build_object('generation',m.generation::text) from chinatech_v2_private.procurement_list_models m where m.store_id=s.id)`:tx`null::jsonb`} procurement,
  ${retail?tx`(select (to_jsonb(m)-'backfill_cursor'-'verified_at')||jsonb_build_object('generation',m.generation::text) from chinatech_v2_private.retail_list_models m where m.store_id=s.id)`:tx`null::jsonb`} retail
  from chinatech_v2.stores s join chinatech_v2_private.store_state st on st.store_id=s.id where s.id=${scope.storeId}`;
 if(!row)throw new BackendError('后台资料暂不可用。',503);
 const models=[row.dashboard,...(repairs?[row.repair,row.procurement]:[]),...(retail?[row.retail]:[])];
 if(models.some(model=>!model?.ready||model.format_version!==1||model.query_rules_hash!==projectionQueryRulesHash)||row.dashboard.rules_hash!==dashboardRulesHash||retail&&row.retail.vocabulary_hash!==retailVocabularyHash)throw new BackendError('后台资料暂不可用。',503);
 // Bigints stay text. A composite is an identity witness, never numeric ordering.
 const generation=JSON.stringify(models.map(model=>String(model.generation)));
 const groups=repairs?visibleRepairGroups(row.groups??defaultRepairGroups(),'workflow'):[];
 const stateToken=createHash('sha256').update(JSON.stringify([1,dashboardRulesHash,projectionQueryRulesHash,backendScopeKey(scope),generation,row.name,groups])).digest('hex');
 return{generation,stateToken,groups};
}

/** Counts range over all authorized narrow projection rows. Only the selected
 * four/three/five targets are joined to originals or stable display metadata. */
export function dashboardSql(tx:TransactionSql,scope:BackendReadScope,explain=false){
 const financial=scope.permissions.includes('financial.read'),repairs=scope.permissions.includes('repairs.view'),retail=scope.permissions.includes('retail.view');
 const missingCustomerName="未填写姓名";
 const activityPart=(source:string,enabled:boolean)=>tx`select * from chinatech_v2_private.dashboard_activity_events where store_id=${scope.storeId} and source=${source} and ${enabled} order by time collate chinatech_v2_private.retail_list_ties desc,id collate chinatech_v2_private.retail_list_ties,case kind when'intake'then 0 when'repair'then 1 when'procurement'then 2 else 3 end,entity_id,position limit 5`;
 return tx`${explain?tx`explain(analyze,buffers,format json)`:tx``}with
 repairs as not materialized(select * from chinatech_v2_private.repair_list_sources where store_id=${scope.storeId}),
 recent as materialized(select id,updated_at,summary from repairs order by updated_at collate chinatech_v2_private.retail_list_ties desc,id collate chinatech_v2_private.retail_list_ties limit 4),
 purchases as not materialized(select * from chinatech_v2_private.procurement_list_sources where store_id=${scope.storeId}),
 pending as materialized(select * from purchases where status<>'complete' order by id limit 3),
 activity_candidates as materialized((${activityPart('repair',repairs)})union all(${activityPart('procurement',repairs)})union all(${activityPart('retail',retail)})),
 activity as materialized(select * from activity_candidates order by time collate chinatech_v2_private.retail_list_ties desc,id collate chinatech_v2_private.retail_list_ties,case kind when'intake'then 0 when'repair'then 1 when'procurement'then 2 else 3 end,entity_id,position limit 5),
 retail as not materialized(select s.view from chinatech_v2_private.retail_list_sources s where s.store_id=${scope.storeId} and s.active and(s.source='unit' or not exists(select 1 from chinatech_v2_private.retail_list_sources u where u.store_id=s.store_id and u.source='unit' and u.origin_id=s.id and u.active)))
 select
 coalesce((select jsonb_object_agg(workflow_group,count)from(select workflow_group,count(*)::integer count from repairs group by workflow_group)c),'{}'::jsonb) counts,
 (select count(*)::integer from repairs where current_handover and collected_unpaid)debt_count,
 coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',r.id,'brand',left(d.data->>'brand',200),'model',left(d.data->>'model',200),'customerName',left(coalesce(nullif(d.data->>'customerName',''),${missingCustomerName}),200),'customerNameMissing',r.summary->'customerNameMissing','issue',left(d.data->>'issue',200),'faults',d.data->'faults','issueNote',case when d.data?'issueNote'then to_jsonb(left(d.data->>'issueNote',200))else null end,
 'progress',jsonb_build_object('label',r.summary->'progress'->'label','tone',r.summary->'progress'->'tone'),
 'previews',to_jsonb(array_remove(array[case when length(d.data->>'brand')>200 then'brand'end,case when length(d.data->>'model')>200 then'model'end,case when length(d.data->>'customerName')>200 then'customerName'end,case when length(d.data->>'issue')>200 then'issue'end,case when length(d.data->>'issueNote')>200 then'issueNote'end],null))))order by r.updated_at collate chinatech_v2_private.retail_list_ties desc,r.id collate chinatech_v2_private.retail_list_ties)
 from recent r join chinatech_v2_private.repair_intakes d on d.store_id=${scope.storeId} and d.id=r.id),'[]'::jsonb)recent,
 (select count(*)::integer from purchases)procurement_total,
 coalesce((select jsonb_agg(jsonb_build_object('id',id,'repairId',repair_id,'item',left(item,200),'supplier',left(supplier,200),'quantity',quantity,'arrived',arrived,'status',status,'expectedAt',left(expected_at,200),'previews',to_jsonb(array_remove(array[case when length(item)>200 then'item'end,case when length(supplier)>200 then'supplier'end,case when length(expected_at)>200 then'expectedAt'end],null)))order by id)from pending),'[]'::jsonb)pending,
 (select jsonb_build_object('available',count(*)filter(where view='available'),'sold',count(*)filter(where view='sold'),'other',count(*)filter(where view='other'))from retail)retail,
 coalesce((select jsonb_agg(jsonb_build_object('key',e.key,'id',e.id,'source',e.kind,'entityId',e.entity_id,'repairId',h.repair_id,'time',e.time,'type',e.type,'label',left(${financial?tx`coalesce(p.label,e.label)`:tx`e.label`},200),'display',left(h.display,200),'quantity',e.quantity,'previews',to_jsonb(array_remove(array[case when length(${financial?tx`coalesce(p.label,e.label)`:tx`e.label`})>200 then'label'end,case when length(h.display)>200 then'display'end],null)))order by e.time collate chinatech_v2_private.retail_list_ties desc,e.id collate chinatech_v2_private.retail_list_ties,case e.kind when'intake'then 0 when'repair'then 1 when'procurement'then 2 else 3 end,e.entity_id,e.position)
 from activity e join chinatech_v2_private.dashboard_activity_heads h on h.store_id=e.store_id and h.source=e.source and h.entity_id=e.entity_id
 ${financial?tx`left join chinatech_v2_private.dashboard_activity_private p on p.store_id=e.store_id and p.key=e.key`:tx``}),'[]'::jsonb)activity`;
}

export async function readDashboard(tx:TransactionSql,scope:BackendReadScope,options:{context?:DashboardContext;known?:string}={}):Promise<DashboardPage|{unchanged:true;stateToken:string}>{
 const context=options.context??await dashboardReadContext(tx,scope);
 if(options.known===context.stateToken)return{unchanged:true,stateToken:context.stateToken};
 const[row]=await dashboardSql(tx,scope);
 const counts=Object.fromEntries(Object.keys(workflowGroups).map(group=>[group,Number(row.counts[group]??0)])) as DashboardData['counts'];
 return{formatVersion:1,scope,generation:context.generation,stateToken:context.stateToken,data:{counts,debtCount:Number(row.debt_count),groups:context.groups,recent:row.recent,procurement:{total:Number(row.procurement_total),pending:row.pending},retail:row.retail,activity:row.activity}};
}
