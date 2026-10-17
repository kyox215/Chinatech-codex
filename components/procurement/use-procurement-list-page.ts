"use client";
import{useBackendState}from'@/components/backend-snapshot';
import{useSummaryListPage}from'@/components/use-summary-list-page';
import{mergeProcurementWindow}from'@/lib/backend/procurement-list-window';
import{procurementListQuery,procurementListResponseVersion,type ProcurementListQuery,type ProcurementListSummary,type ProcurementListPage}from'@/lib/backend/procurement-list-contract';
import{requestProcurementList}from'./procurement-read-client';
import{can}from'@/lib/staff';
const rowKey=(row:ProcurementListSummary)=>row.id;
export function useProcurementListPage(raw:ProcurementListQuery,returnAnchor?:string){
 const backend=useBackendState(),member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId),scope=backend.snapshot?.procurementListEnabled&&can(member,'repairs.view')?backend.snapshot.read?.scope:undefined;
 const invalidQuery=raw.q.length>160,query=procurementListQuery({...raw,q:invalidQuery?'':raw.q}),initial=scope&&backend.snapshot?.procurementList?.formatVersion===procurementListResponseVersion?backend.snapshot.procurementList:undefined;
 return useSummaryListPage<ProcurementListQuery,ProcurementListSummary,ProcurementListPage>({scope,initial,query,returnAnchor,invalidQuery,formatVersion:procurementListResponseVersion,rowKey,request:requestProcurementList,merge:mergeProcurementWindow});
}
