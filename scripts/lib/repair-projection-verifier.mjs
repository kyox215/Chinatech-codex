// Operator-only verification. Original documents are read in batches <=200;
// only the current repair's narrow, independently verified procurement facts
// survive a batch. No event bodies, costs, photos or signatures accumulate.
import assert from 'node:assert/strict';
import {sourceLoader} from '../../tests/helpers/typescript-source.mjs';
const load=sourceLoader(),{arrivedQuantity,procurementStatus}=load('./lib/procurement'),{intakeDirectoryEntry}=load('./lib/repair-intake-record'),{overlayRepair}=load('./lib/repair-workflow');
const preview=value=>Array.from(value??'').slice(0,161).join('');
export async function verifyRepairProjection(tx,storeId){
 const [counts]=await tx`select (select count(*)::integer from chinatech_v2_private.repair_intakes where store_id=${storeId}) canonical,(select count(*)::integer from chinatech_v2_private.repair_list_sources where store_id=${storeId}) projected`;
 assert.equal(counts.canonical,counts.projected,'No extra or missing repair projections');
 let cursor='',verified=0,verifiedProcurements=0,maxCanonicalBatch=0,maxRelatedBatch=0;
 for(;;){
  const repairs=await tx`select id,data,workflow from chinatech_v2_private.repair_intakes where store_id=${storeId} and id>${cursor} order by id limit 200`;
  maxCanonicalBatch=Math.max(maxCanonicalBatch,repairs.length);if(!repairs.length)break;
  for(const repair of repairs){
   let partCursor='';const facts=[];
   for(;;){
    const rows=await tx`select id,data from chinatech_v2_private.procurement_records where store_id=${storeId} and repair_id=${repair.id} and id>${partCursor} order by id limit 200`;
    maxRelatedBatch=Math.max(maxRelatedBatch,rows.length);if(!rows.length)break;
    const expected=rows.map(({data:row})=>({id:row.id,repairId:row.repairId,item:row.item,supplier:row.supplier,quantity:row.quantity,arrived:arrivedQuantity(row),status:procurementStatus(row),ledgerRevision:row.events.length,specification:row.specification??null}));
    const actual=await tx`select id,repair_id as "repairId",item,supplier,quantity,arrived,status,ledger_revision as "ledgerRevision",specification from chinatech_v2_private.procurement_list_sources where store_id=${storeId} and id=any(${tx.array(rows.map(row=>row.id),25)}) order by id`;
    assert.deepEqual([...actual],expected,'Target procurement projection must match original ledger, status, arrival, revision and display facts');
    for(let i=0;i<rows.length;i++){
     const document=rows[i].data,row=expected[i];assert.equal(document.repairId,repair.id,'Canonical dependency link must match the target repair');
     facts.push({id:row.id,item:row.item,supplier:row.supplier,specification:preview(row.specification),quantity:row.quantity,arrived:row.arrived,status:row.status,ledgerRevision:row.ledgerRevision,required:document.required??null,requirementId:document.requirementId??null,requirementRevision:document.requirementRevision??null});
    }
    verifiedProcurements+=rows.length;partCursor=rows.at(-1).id;
   }
   // The SQL fact function has a separate original-domain-function oracle in
   // repair-read-model.integration.mjs. Here the comparison verifies every
   // installed projection against its current canonical dependency set.
   const [{value}]=await tx`select chinatech_v2_private.repair_list_facts(${tx.json(repair.data)},${repair.workflow?tx.json(repair.workflow):null},${tx.json(facts)}) value`;
   const order=overlayRepair(intakeDirectoryEntry(repair.data),repair.workflow??undefined);
   const summary={id:order.id,category:order.device.category,model:order.device.model,customerName:order.customer.name,customerNameMissing:Boolean(order.customerNameMissing),phone:order.customer.phone,priority:order.priority,rework:Boolean(order.repairOrigin),createdAt:order.createdAt,updatedAt:order.updatedAt,stage:value.stage,history:value.history,workflowGroup:value.workflowGroup,partsGroup:value.parts.group,progress:value.progress,contact:value.contact,chips:value.chips,chipCount:value.chipCount,suppliers:value.suppliers,suppliersPreview:value.suppliersPreview};
   const expected={id:order.id,createdAt:order.createdAt,updatedAt:order.updatedAt,priority:{紧急:0,优先:1,普通:2}[order.priority],stage:value.stage,history:value.history,currentHandover:value.currentHandover,collectedUnpaid:value.contact.collectedUnpaid,workflowGroup:value.workflowGroup,partsGroup:value.parts.group,notified:value.pickupNotice.startsWith('已通知'),search:[order.id,order.customer.name,order.customer.phone,order.device.brand,order.device.model,order.device.serial,order.issue].join(' ').toLocaleLowerCase(),summary};
   const [actual]=await tx`select id,created_at as "createdAt",updated_at as "updatedAt",priority,stage,history,current_handover as "currentHandover",collected_unpaid as "collectedUnpaid",workflow_group as "workflowGroup",parts_group as "partsGroup",notified,search,summary from chinatech_v2_private.repair_list_sources where store_id=${storeId} and id=${repair.id}`;
   assert.deepEqual(actual,expected,'Every repair fact, complete dependency link, ordering/search column and displayed summary must match');verified++;
  }
  cursor=repairs.at(-1).id;
 }
 assert.equal(verified,counts.canonical);
 const [links]=await tx`select exists(select 1 from chinatech_v2_private.procurement_records p where p.store_id=${storeId} and not exists(select 1 from chinatech_v2_private.repair_intakes r where r.store_id=p.store_id and r.id=p.repair_id)) orphan`;
 assert.equal(links.orphan,false,'Every procurement dependency must reference an actual canonical repair');
 return{verifiedRepairs:verified,verifiedProcurements,maxCanonicalBatch,maxRelatedBatch};
}
