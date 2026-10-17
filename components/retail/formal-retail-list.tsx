"use client";
import{replaceBackendDocumentUrl}from"@/lib/backend/client";
import{useEffect,useRef}from'react';
import{useSearchParams}from'next/navigation';
import{useBackendState}from'@/components/backend-snapshot';
import{backendSnapshot,subscribeBackend}from'@/lib/backend/client';
import{backendScopeKey}from'@/lib/backend/read-plan';
import{retailListLocation,retailQueryFromParams,bindRetailListPosition,rememberRetailListPosition}from'@/lib/retail-list-location';
import{defaultRetailListSort}from'@/lib/retail-list-model';
import{RetailListBody}from'./retail-list-body';
import{FormalRetailRecordScanner}from'./retail-record-scanner';
import{RetailFacetFilter}from'./retail-facet-filter';
import{useRetailListPage}from'./use-retail-list-page';
export function FormalRetailList({legacyFacets}:{legacyFacets?:{category?:string;status?:string}}){
 const backend=useBackendState(),scope=backend.snapshot?.read?.scope,scopeKey=scope?backendScopeKey(scope):'',params=useSearchParams(),query=retailQueryFromParams(params,legacyFacets),rawAnchor=params.get('anchor')??'',anchor=/^(unit|history):[\s\S]{1,100}$/u.test(rawAnchor)?rawAnchor:undefined,remote=useRetailListPage(query,anchor),page=remote.page,visibleAnchor=useRef<string|null>(null);
 useEffect(()=>{bindRetailListPosition(()=>{const current=backendSnapshot()?.read?.scope;return current?backendScopeKey(current):null;},subscribeBackend);},[]);
 const update=(patch:Partial<typeof query>)=>{const next={...query,...patch};replaceBackendDocumentUrl(retailListLocation(next));};
 const remember=(id:string)=>{
  if(!scopeKey)return;const rows=[...document.querySelectorAll<HTMLElement>('[data-window-key]')].filter(node=>/^(unit|history):/.test(node.dataset.windowKey??'')),row=rows.find(node=>node.getBoundingClientRect().bottom>0&&node.getBoundingClientRect().top<window.innerHeight),key=row?.dataset.windowKey??visibleAnchor.current??'',location=retailListLocation(page?.query??query,key,row?.getBoundingClientRect().top??0);rememberRetailListPosition(scopeKey,id,location);replaceBackendDocumentUrl(location);
 };
 if(!scope)return null;
 return <RetailListBody query={query} rowsQuery={page?.query??query} items={page?.items??[]} total={page?.total??0} viewCounts={page?.viewCounts} conditionCounts={page?.conditionCounts} ready={Boolean(page)} pending={remote.pending} error={remote.error} retry={remote.retry} update={update} clear={()=>replaceBackendDocumentUrl(retailListLocation({view:query.view,q:'',condition:'all',category:'all',status:'all',review:false,sort:defaultRetailListSort(query.view)}))} categoryFilter={<RetailFacetFilter scope={scope} view={query.view} kind="category" value={query.category} selected={page?.selectedFacets?.category} onChange={category=>update({category})}/>} statusFilter={<RetailFacetFilter scope={scope} view={query.view} kind="status" value={query.status} selected={page?.selectedFacets?.status} onChange={status=>update({status})}/>} renderScanner={close=><FormalRetailRecordScanner scope={scope} onClose={close} onNavigate={remember} returnTo={retailListLocation(page?.query??query)}/>} listUrl={retailListLocation(query)} hasMore={Boolean(page?.nextCursor)} loadMore={remote.loadMore} startIndex={page?.startIndex} extent={remote.extent} version={page?.stateToken} resetKey={remote.resetKey} anchor={anchor} offset={Number(params.get('offset')??0)} scopeKey={scopeKey} rememberAnchor={key=>{visibleAnchor.current=key;remote.rememberAnchor(key);}} seek={remote.seek} loadPrevious={remote.error?undefined:remote.loadPrevious}/>;
}
