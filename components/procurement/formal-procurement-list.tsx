"use client";
import{replaceBackendDocumentUrl}from"@/lib/backend/client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {useLanguage} from "@/components/language-provider";
import {useBackendState} from "@/components/backend-snapshot";
import {SearchCombobox,type ComboboxOption} from "@/components/search-combobox";
import {useActivityFeedback} from "@/components/operation-feedback";
import {useStaff} from "@/components/staff/use-staff";
import {backendSnapshot,subscribeBackend} from "@/lib/backend/client";
import {backendScopeKey} from "@/lib/backend/read-plan";
import {procurementListQuery,type ProcurementListQuery} from "@/lib/backend/procurement-list-contract";
import {bindProcurementListPosition,procurementListLocation} from "@/lib/procurement-list-location";
import {requestProcurementBatch} from "./procurement-read-client";
import {useProcurementListPage} from "./use-procurement-list-page";
import {ProcurementListBody} from "./procurement-list-body";
function readQuery(params:ReturnType<typeof useSearchParams>):ProcurementListQuery {
 const filter=params.get("filter"),groupBy=params.get("groupBy");
 const rawQuery=params.get("q")??"",parsed=procurementListQuery({q:rawQuery.length<=160?rawQuery:"",repairId:(params.get("repairId")??params.get("repair")??"").slice(0,100),filter:["all","draft","open","complete"].includes(filter??"")?filter as ProcurementListQuery["filter"]:"all",groupBy:["status","supplier","repair","none"].includes(groupBy??"")?groupBy as ProcurementListQuery["groupBy"]:"supplier"});return rawQuery.length<=160?parsed:{...parsed,q:rawQuery};
}
export function FormalProcurementList() {
 const {t}=useLanguage(),backend=useBackendState(),staff=useStaff(),params=useSearchParams(),query=readQuery(params);
 const [repairQuery,setRepairQuery]=useState(""),[repairOpen,setRepairOpen]=useState(false),[candidatePending,setCandidatePending]=useState(false),[repairCandidates,setRepairCandidates]=useState<{key:string;options:ComboboxOption[]}>({key:"",options:[]}),[candidateError,setCandidateError]=useState("");
 const rawAnchor=params.get("anchor"),anchor=rawAnchor&&rawAnchor.length<=100?rawAnchor:undefined;
 const offset=Number(params.get("offset")??0),list=useProcurementListPage(query,anchor),page=list.page,scope=backend.snapshot?.read?.scope,scopeKey=scope?backendScopeKey(scope):"",canView=staff.can("repairs.view");
 const update=(value:Partial<ProcurementListQuery>)=>replaceBackendDocumentUrl(procurementListLocation({...query,...value}));
 useEffect(()=>bindProcurementListPosition(()=>{const value=backendSnapshot()?.read?.scope;return value?backendScopeKey(value):null;},subscribeBackend),[]);
 useActivityFeedback(candidatePending&&repairOpen,{kind:"read"});
 useEffect(()=>{
  const key=scopeKey+repairQuery;if(!scope||!canView||!repairOpen||repairCandidates.key===key)return;
  const controller=new AbortController();let live=true;
  const timeout=setTimeout(()=>{setCandidatePending(true);setCandidateError("");void requestProcurementBatch(scope,{kind:"repairs",q:repairQuery.trim(),repairId:"",supplierId:""},{signal:controller.signal}).then(value=>{if(live){setCandidateError("");setRepairCandidates({key,options:value.items.map(row=>({value:row.id,label:row.id,detail:("model" in row?row.model:row.repairModel)??undefined}))});}}).catch(reason=>{if(live&&!controller.signal.aborted)setCandidateError(reason instanceof Error?reason.message:"后台资料暂不可用。");}).finally(()=>{if(live)setCandidatePending(false);});},150);
  return()=>{live=false;clearTimeout(timeout);controller.abort();setCandidatePending(false);};
 },[scope,scopeKey,repairQuery,canView,repairOpen,repairCandidates.key]);
 const options=repairCandidates.key===scopeKey+repairQuery?repairCandidates.options:[];
 const selectedRepair=query.repairId&&!options.some(row=>row.value===query.repairId)?[{value:query.repairId,label:query.repairId},...options]:options;
 return <ProcurementListBody query={query} displayQuery={params.get("q")??""} update={update} items={page?.items??[]} rowsQuery={page?.query??query} stats={page?.stats} total={page?.total??0} groupTotal={page?.groupTotal??0} ready={Boolean(page)} pending={list.pending} error={list.error} retry={list.retry} hasMore={Boolean(page?.nextCursor)&&JSON.stringify(page?.query)===JSON.stringify(query)} loadMore={list.loadMore} resetKey={list.resetKey} startIndex={page?.startIndex??0} extent={list.extent} version={page?.stateToken} windowKey={JSON.stringify([scopeKey,page?.query])} rememberAnchor={list.rememberAnchor} seek={list.seek} loadPrevious={!list.error&&page?.previousCursor?list.loadPrevious:undefined} anchor={anchor} offset={offset} scopeKey={scopeKey} repairFilter={<SearchCombobox className="module-select" label={t("关联工单筛选")} maxLength={160} value={query.repairId} options={selectedRepair} filterOptions={false} loading={candidatePending} loadingLabel="正在处理…" onOpenChange={setRepairOpen} commitOnBlur showAllOnOpen onQueryChange={setRepairQuery} onChange={value=>{if(!value||selectedRepair.some(row=>row.value===value))update({repairId:value});}} emptyText={repairCandidates.key===scopeKey+repairQuery?"没有符合条件的采购":null} error={candidateError}/>}/>;
}
