"use client";
import{createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode}from'react';
import{useBackendState}from'@/components/backend-snapshot';
import{useActivityFeedback}from'@/components/operation-feedback';
import{useStaff}from'@/components/staff/use-staff';
import type{ComboboxOption}from'@/components/search-combobox';
import type{HistoricalCatalogSource}from'@/components/catalog/historical-catalog-source';
import{backendScopeKey,type BackendReadScope}from'@/lib/backend/read-plan';
import{requestScopedList}from'@/lib/backend/scoped-read-client';
import{retailFormCandidateQuery,type RetailFormCandidateQuery,type RetailFormCandidatePage,type RetailFormCandidateValue}from'@/lib/backend/retail-form-contract';
const OwnerContext=createContext('');
export function RetailFormSuggestionOwner({owner,children}:{owner:string;children:ReactNode}){return <OwnerContext.Provider value={owner}>{children}</OwnerContext.Provider>;}
export async function requestRetailFormOptions(scope:BackendReadScope,raw:Partial<RetailFormCandidateQuery>,signal?:AbortSignal){
 const query=retailFormCandidateQuery(raw),value=await requestScopedList(scope,'/api/backend/v2/retail/form-candidates',{body:query,signal});
 if(query.key){const item=value.items[0] as RetailFormCandidateValue|undefined;if(value.items.length!==1||!item||item.formatVersion!==1||item.key!==query.key||JSON.stringify(item.query)!==JSON.stringify(query)||typeof item.value!=='string')throw new Error('后台资料暂不可用。');return item;}
 if(value.formatVersion!==1||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>12||!Number.isSafeInteger(value.total))throw new Error('后台资料暂不可用。');return value as RetailFormCandidatePage;
}
export function useRetailRecordedOptions({field,category,brand='',value,onCommit}:{field:RetailFormCandidateQuery['field'];category:RetailFormCandidateQuery['category'];brand?:string;value:string;onCommit:(value:string)=>void}):HistoricalCatalogSource|undefined{
 const backend=useBackendState(),staff=useStaff(),owner=useContext(OwnerContext),scope=backend.snapshot?.read?.scope;
 const enabled=backend.active&&backend.snapshot?.retailFormEnabled&&backend.snapshot.read?.plan.kind==='retail-new'&&staff.can('retail.view')&&staff.can('retail.edit'),scopeKey=enabled&&scope?backendScopeKey(scope):'',controlKey=JSON.stringify([scopeKey,owner,field,category,brand,value]);
 const[open,setOpen]=useState(false),[q,setQuery]=useState(''),[retry,setRetry]=useState(0),[data,setData]=useState<{key:string;page:RetailFormCandidatePage}|null>(null),[status,setStatus]=useState({key:'',pending:false,error:''}),[choice,setChoice]=useState({key:'',pending:false,error:''}),choiceFlight=useRef<AbortController|null>(null),choiceEpoch=useRef(0),latest=useRef({controlKey,onCommit});
 const requestKey=JSON.stringify([scopeKey,owner,field,category,brand,q]);
 useLayoutEffect(()=>{latest.current={controlKey,onCommit};},[controlKey,onCommit]);
 useLayoutEffect(()=>{const epoch=++choiceEpoch.current;let live=true;choiceFlight.current?.abort();choiceFlight.current=null;queueMicrotask(()=>{if(live&&choiceEpoch.current===epoch)setChoice({key:controlKey,pending:false,error:''});});return()=>{live=false;choiceFlight.current?.abort();choiceFlight.current=null;};},[controlKey]);
 useEffect(()=>{
  if(!scopeKey||!scope||!open||q.length>160)return;
  const controller=new AbortController();let live=true;
  const timeout=setTimeout(()=>{setStatus({key:requestKey,pending:true,error:''});void requestRetailFormOptions(scope,{field,category,brand,q},AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])).then(page=>{if(live&&'items'in page)setData({key:requestKey,page});}).catch(error=>{if(live&&!controller.signal.aborted)setStatus({key:requestKey,pending:false,error:error instanceof Error?error.message:'后台资料暂不可用。'});}).finally(()=>{if(live)setStatus(previous=>previous.key===requestKey?{...previous,pending:false}:previous);});},150);
  return()=>{live=false;clearTimeout(timeout);controller.abort();};
 },[scope,scopeKey,owner,field,category,brand,q,open,retry,requestKey]);
 const onQueryChange=useCallback((query:string)=>{choiceEpoch.current++;choiceFlight.current?.abort();choiceFlight.current=null;setChoice({key:latest.current.controlKey,pending:false,error:''});setQuery(query);},[setChoice,setQuery]);
 const select=(option:ComboboxOption)=>{
  if(!scopeKey||!scope)return;const expected=controlKey,epoch=++choiceEpoch.current,controller=new AbortController();choiceFlight.current?.abort();choiceFlight.current=controller;setChoice({key:expected,pending:true,error:''});
  const current=()=>!controller.signal.aborted&&latest.current.controlKey===expected&&choiceEpoch.current===epoch;
  void requestRetailFormOptions(scope,{field,category,brand,key:option.value},AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])).then(item=>{if(current()&&'value'in item)latest.current.onCommit(item.value);}).catch(error=>{if(current())setChoice({key:expected,pending:false,error:error instanceof Error?error.message:'后台资料暂不可用。'});}).finally(()=>{if(current()){choiceFlight.current=null;setChoice(previous=>previous.key===expected?{...previous,pending:false}:previous);}});
 };
 const pending=Boolean(scopeKey)&&(open&&status.key===requestKey&&status.pending||choice.key===controlKey&&choice.pending),visible=data?.key===requestKey?data.page:null;
 useActivityFeedback(pending,{kind:'read'});
 if(!backend.formal||!backend.snapshot?.retailFormEnabled||backend.snapshot.read?.plan.kind!=='retail-new')return undefined;
 return{options:visible?.items.map(item=>({value:item.key,key:'history:'+item.key,label:item.label+(item.preview?'…':''),detail:item.detail,catalogKey:item.catalogKey}))??[],total:visible?.total??0,loading:pending,error:q.length>160?'请求资料无效。':choice.key===controlKey&&choice.error||status.key===requestKey&&status.error||'',onOpenChange:setOpen,onQueryChange,onSelect:select,retry:()=>setRetry(previous=>previous+1)};
}
