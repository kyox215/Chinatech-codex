"use client";
import{replaceBackendDocumentUrl}from"@/lib/backend/client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import {useBackendState} from "@/components/backend-snapshot";
import {useStaff} from "@/components/staff/use-staff";
import {useLanguage} from "@/components/language-provider";
import {Toast,toastNoticeId} from "@/components/toast";
import {useProcurement} from "@/components/procurement/procurement-provider";
import {SupplierBatchDialog} from "@/components/procurement/supplier-batch-dialog";
import {backendSnapshot,subscribeBackend} from "@/lib/backend/client";
import type {BackendSnapshot} from "@/lib/backend/contracts";
import {backendScopeKey} from "@/lib/backend/read-plan";
import {repairListQuery,type RepairListQuery} from "@/lib/backend/repair-list-contract";
import {repairListSummary} from "@/lib/repair-list-model";
import {intakeDirectoryEntry} from "@/lib/repair-intake-record";
import {overlayRepair,hasCurrentRepairHandover} from "@/lib/repair-workflow";
import {bindRepairListPosition,repairListLocation,rememberRepairListPosition} from "@/lib/repair-list-location";
import {readRepairListView,writeRepairListView} from "@/lib/repair-list-view-state";
import {RepairListBody} from "./repair-list-body";
import {useRepairListPage} from "./use-repair-list-page";
import {RepairStageButton} from "./repair-stage-control";
import {RepairContactPresentation} from "./repair-contact-control";
import {RepairEntityOperation,type RepairOperationKind} from "./repair-entity-operation";
export function FormalRepairList() {
 const backend=useBackendState(),staff=useStaff(),{systemText}=useLanguage(),params=useSearchParams(),rawQuery=params.get("q")??"",scopeKey=backend.snapshot?.read?backendScopeKey(backend.snapshot.read.scope):"";
 const values=Object.fromEntries(["q","status","view","partsFilter","noticeFilter","groupBy","sort"].flatMap(key=>params.has(key)?[[key,params.get(key)!]]:[])),query=repairListQuery({...values,q:rawQuery.length<=160?rawQuery:""} as Partial<RepairListQuery>);
 if(rawQuery.length>160)query.q=rawQuery;
 const [restored]=useState(()=>readRepairListView(scopeKey)),[filtersOpen,setFiltersOpen]=useState(restored?.filtersOpen??false),[openGroups,setOpenGroups]=useState<Record<string,boolean>>(restored?.openGroups??{}),[batch,setBatch]=useState(false),[operation,setOperation]=useState<{id:string;kind:RepairOperationKind}|null>(null),[operationPending,setOperationPending]=useState(false),[readError,setReadError]=useState("");
 const table=useRef<HTMLDivElement>(null),origin=useRef<RepairOperationKind>("parts"),{feedback}=useProcurement(),canEdit=staff.can("repairs.edit");
 const group=params.get("group")??undefined,rawAnchor=params.get("anchor"),anchor=rawAnchor&&rawAnchor.length<=100?rawAnchor:undefined,offset=Number(params.get("offset")??0),list=useRepairListPage(query,group,anchor),page=list.page;
 useEffect(()=>bindRepairListPosition(()=>{const current=backendSnapshot()?.read?.scope;return current?backendScopeKey(current):null;},subscribeBackend),[]);
 useEffect(()=>{writeRepairListView(scopeKey,{query:query.q,status:query.status,view:query.view,noticeFilter:query.noticeFilter,partsFilter:query.partsFilter,groupBy:query.groupBy,sort:query.sort,filtersOpen,openGroups,scrollY:0,scrollLeft:table.current?.scrollLeft??0});},[scopeKey,query.q,query.status,query.view,query.noticeFilter,query.partsFilter,query.groupBy,query.sort,filtersOpen,openGroups]);
 const update=(patch:Partial<RepairListQuery>)=>replaceBackendDocumentUrl(repairListLocation({...query,...patch}));
 const open=(id:string,kind:RepairOperationKind)=>{origin.current=kind;setReadError("");setOperation({id,kind});};
 const pendingChanged=useCallback((value:boolean)=>setOperationPending(value),[]);
 function followSaved(snapshot:BackendSnapshot|null,error:string){
  if(error||!snapshot){setReadError(error||"后台暂时不可用，当前输入已保留。 ");list.refresh();return;}
  const intake=snapshot.intakes.find(row=>row.id===operation?.id);if(!intake){list.refresh();return;}
  const workflow=snapshot.workflows[intake.id],order=overlayRepair(intakeDirectoryEntry(intake),workflow),row=repairListSummary(order,snapshot.procurement,workflow),next={...query};
  if(next.view!=="all")next.view=row.history?"history":"active";
  if(!["all","including_cancelled"].includes(next.status))next.status=next.status==="handover"&&workflow&&hasCurrentRepairHandover(workflow)?"handover":row.stage;
  if(next.noticeFilter!=="all"&&row.workflowGroup==="ready")next.noticeFilter=row.contact.pickupNotice.startsWith("已通知")?"notified":"unnotified";
  if(next.partsFilter!=="all")next.partsFilter=row.partsGroup;
  const targetGroup=row.history?next.view==="all"&&next.groupBy==="workflow"?"history":next.view==="history"||next.groupBy==="none"?"all":row.partsGroup:next.groupBy==="none"?"all":next.groupBy==="workflow"?row.workflowGroup:row.partsGroup;
  setOpenGroups(current=>({...current,[targetGroup]:true}));replaceBackendDocumentUrl(repairListLocation(next,targetGroup,row.id,0));
 }
 function closeOperation(){const current=operation;setOperation(null);if(current)requestAnimationFrame(()=>{const target=document.getElementById(`repair-${origin.current==="parts"?"action":origin.current}-${current.id}`);target?.focus({preventScroll:true});});}
 return <RepairListBody query={query} displayQuery={rawQuery} update={update} groups={(page?.groups??[]).map(value=>({...value,window:list.group(value.key)}))} partGroups={page?.partGroups??[]} stats={page?.stats} total={page?.total??0} ready={Boolean(page)} pending={list.pending} error={readError||list.error} retry={()=>{setReadError("");list.refresh();}} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} openGroups={openGroups} toggleGroup={(key,value)=>setOpenGroups(current=>({...current,[key]:value}))} tableRef={table} onBatch={()=>setBatch(true)} openParts={id=>open(id,"parts")} pendingParts={operationPending&&operation?.kind==="parts"?operation.id:undefined} stage={row=><RepairStageButton orderId={row.id} triggerId={`repair-stage-${row.id}`} stage={row.stage} progress={row.progress} canEdit={canEdit} pending={operationPending&&operation?.id===row.id&&operation.kind==="stage"} onClick={()=>open(row.id,"stage")}/>} contact={row=><RepairContactPresentation orderId={row.id} facts={row.contact} history={row.history} canEdit={canEdit} pending={operationPending&&operation?.id===row.id&&operation.kind==="contact"} onClick={()=>open(row.id,"contact")}/>} resetKey={list.resetKey} ensureGroup={list.ensure} loadMore={list.loadMore} loadPrevious={list.loadPrevious} seek={list.seek} rememberAnchor={list.remember} returnGroup={group} returnAnchor={anchor} returnOffset={Number.isFinite(offset)?Math.max(-2000,Math.min(2000,offset)):0} rowHref={(row,key)=>`/app/repairs/${encodeURIComponent(row.id)}?returnTo=${encodeURIComponent(repairListLocation(page?.query??query,key,row.id))}`} onNavigate={(event,row,key)=>{const location=repairListLocation(page?.query??query,key,row.id,event.currentTarget.getBoundingClientRect().top);rememberRepairListPosition(scopeKey,row.id,location);replaceBackendDocumentUrl(location);}} notice={feedback&&!feedback.error&&!operation?<Toast message={systemText(feedback.message)} noticeId={toastNoticeId(feedback)}/>:null}>
  {operation?<RepairEntityOperation key={scopeKey+operation.id+operation.kind} id={operation.id} kind={operation.kind} onClose={closeOperation} onParts={()=>setOperation({...operation,kind:"parts"})} onSaved={followSaved} onPending={pendingChanged}/>:null}
  {batch&&canEdit?<SupplierBatchDialog action="arrival" onSaved={()=>list.refresh()} onClose={()=>setBatch(false)}/>:null}
 </RepairListBody>;
}
