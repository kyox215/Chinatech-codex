"use client";
import{useBackendState}from'@/components/backend-snapshot';
import{useSummaryListPage}from'@/components/use-summary-list-page';
import{mergeRetailWindow}from'@/lib/backend/retail-list-window';
import{retailListQuery,type RetailListQuery,type RetailListSummary,type RetailListPage}from'@/lib/backend/retail-list-contract';
import{can}from'@/lib/staff';
import{requestRetailList}from'./retail-read-client';
const rowKey=(row:RetailListSummary)=>row.key;
export function useRetailListPage(raw:RetailListQuery,returnAnchor?:string){
 const backend=useBackendState(),member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId),scope=backend.snapshot?.retailListEnabled&&can(member,'retail.view')?backend.snapshot.read?.scope:undefined;
 const invalidQuery=raw.q.length>160,query=retailListQuery({...raw,q:invalidQuery?'':raw.q}),initial=scope&&backend.snapshot?.retailList?.formatVersion===1?backend.snapshot.retailList:undefined;
 return useSummaryListPage<RetailListQuery,RetailListSummary,RetailListPage>({scope,initial,query,returnAnchor,invalidQuery,formatVersion:1,rowKey,request:requestRetailList,merge:mergeRetailWindow});
}
