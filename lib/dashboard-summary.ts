import type {IntakeReceiptData} from './repair-intake-record';
import {intakeDirectoryEntry} from './repair-intake-record';
import type {ProcurementRecord} from './procurement';
import {arrivedQuantity,procurementStatus} from './procurement';
import type {RepairWorkflow} from './repair-workflow';
import {hasCurrentRepairHandover,initialRepairWorkflow,overlayRepair,repairProgress,workflowGroup,workflowGroups} from './repair-workflow';
import type {RetailUnit} from './retail';
import type {RetailHistoryRecord} from './retail-history';
import {buildRetailListIndex} from './retail-list-model';
import type {StoreSettings} from './store-settings';
import {defaultRepairGroups,visibleRepairGroups} from './repair-groups';
import type {DashboardActivity,DashboardData} from './backend/dashboard-contract';

const preview=(value:string)=>[...value].slice(0,200).join('');
const shortened=(value:string)=>[...value].length>200;
const sensitive=/成本|毛利|利润|costCents|refurbCents|grossProfit/i;
/** The original dashboard selection, retained as a canonical JS oracle. It is
 * used for operator verification/tests, never to load a store in a read route. */
export function buildDashboardSummary(source:{
  intakes:IntakeReceiptData[];workflows:Record<string,RepairWorkflow>;
  procurement:ProcurementRecord[];retail:RetailUnit[];history:RetailHistoryRecord[];
  settings:Pick<StoreSettings,'repairGroups'>;
},access:{repairs:boolean;retail:boolean;financial:boolean}):DashboardData {
  const intakes=access.repairs?source.intakes:[],records=access.repairs?source.procurement:[];
  const units=access.retail?source.retail:[],history=access.retail?source.history:[];
  const orders=intakes.map(intakeDirectoryEntry).map(order=>overlayRepair(order,source.workflows[order.id]));
  const counts=Object.fromEntries(Object.keys(workflowGroups).map(group=>[group,0])) as DashboardData['counts'];
  for(const order of orders)counts[workflowGroup(order,records,source.workflows[order.id])]++;
  const activities:DashboardActivity[]=[];
  function activity(value:Omit<DashboardActivity,'key'|'previews'>&{eventId?:string}){
    if(!value.time)return;
    const previews=['label','display'].filter(key=>shortened(value[key as 'label'|'display']));
    const{eventId='',...row}=value,key='['+[row.source,row.entityId,eventId].map(value=>JSON.stringify(value)).join(', ')+']';
    activities.push({...row,key,label:preview(row.label),display:preview(row.display),previews});
  }
  for(const order of orders){
    activity({id:`intake:${order.id}`,source:'intake',entityId:order.id,repairId:order.id,time:order.createdAt,type:'intake',label:'',display:order.id,quantity:null});
    for(const event of source.workflows[order.id]?.events??[])activity({id:`repair:${order.id}:${event.id}`,source:'repair',eventId:event.id,entityId:order.id,repairId:order.id,time:event.time,type:event.type,label:event.label,display:order.id,quantity:null});
  }
  for(const row of records)for(const event of row.events)activity({id:`procurement:${row.id}:${event.id}`,source:'procurement',eventId:event.id,entityId:row.id,repairId:row.repairId,time:event.time,type:event.type,label:'',display:row.item,quantity:'quantity'in event?event.quantity:null});
  for(const unit of units)for(const event of unit.events)activity({id:`retail:${unit.id}:${event.id}`,source:'retail',eventId:event.id,entityId:unit.id,repairId:'',time:event.time,type:'retail',label:!access.financial&&(event.sensitive==='financial'||sensitive.test(event.title+' '+event.detail))?'财务资料更正':event.title,display:unit.code,quantity:null});
  const retail={available:0,sold:0,other:0};for(const row of buildRetailListIndex(units,history))retail[row.view]++;
  return{
    counts,debtCount:orders.filter(order=>{const workflow=source.workflows[order.id]??initialRepairWorkflow(order);return hasCurrentRepairHandover(workflow)&&workflow.followUp?.collectedUnpaid;}).length,
    groups:access.repairs?visibleRepairGroups(source.settings.repairGroups??defaultRepairGroups(),'workflow'):[],
    recent:orders.toSorted((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).slice(0,4).map(order=>{
      const raw={brand:order.device.brand,model:order.device.model,customerName:order.customer.name,issue:order.issue,...(order.issueNote!==undefined?{issueNote:order.issueNote}:{})};
      return{id:order.id,...Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,preview(value)])) as typeof raw,customerNameMissing:order.customerNameMissing===true,...(order.faults?{faults:[...order.faults]}:{}),previews:Object.keys(raw).filter(key=>shortened(raw[key as keyof typeof raw]??'')),progress:((value)=>({label:value.label,tone:value.tone}))(repairProgress(order,records,source.workflows[order.id]))};
    }),
    procurement:{total:records.length,pending:records.filter(row=>procurementStatus(row)!=='complete').slice(0,3).map(row=>({id:row.id,repairId:row.repairId,item:preview(row.item),supplier:preview(row.supplier),quantity:row.quantity,arrived:arrivedQuantity(row),status:procurementStatus(row),expectedAt:preview(row.expectedAt??''),previews:['item','supplier','expectedAt'].filter(key=>shortened(row[key as 'item'|'supplier'|'expectedAt']??''))}))},
    retail,activity:activities.toSorted((a,b)=>b.time.localeCompare(a.time)||a.id.localeCompare(b.id)).slice(0,5),
  };
}
