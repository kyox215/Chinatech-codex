"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {useBackendState} from "@/components/backend-snapshot";
import {useActivityFeedback} from "@/components/operation-feedback";
import {can} from "@/lib/staff";
import {backendScopeKey} from "@/lib/backend/read-plan";
import {repairListQuery,repairReadVersionRelation,type RepairListPage,type RepairListQuery} from "@/lib/backend/repair-list-contract";
import {acceptRepairWindow,emptyRepairWindowCache,mergeRepairWindows,repairGroupWindow,type RepairWindowCache} from "@/lib/backend/repair-list-window";
import {requestRepairList} from "./repair-read-client";
type View={scope:string;page:RepairListPage;cache:RepairWindowCache};
const metadata=(page:RepairListPage)=>({...page,items:[]});
const noErrors:Record<string,string>={};
const noPending:Record<string,boolean>={};
export function useRepairListPage(raw:RepairListQuery,returnGroup?:string,returnAnchor?:string) {
 const backend=useBackendState(),member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId),scope=backend.snapshot?.repairListEnabled&&can(member,"repairs.view")?backend.snapshot.read?.scope:undefined,scopeKey=scope?backendScopeKey(scope):"",initial=scope?backend.snapshot?.repairList:undefined,invalid=raw.q.length>160,query=repairListQuery({...raw,q:invalid?"":raw.q}),queryKey=JSON.stringify(query);
 const [view,setView]=useState<View|null>(()=>initial?{scope:scopeKey,page:metadata(initial),cache:acceptRepairWindow(emptyRepairWindowCache(),initial)}:null),current=useRef(view),latest=useRef({scope,scopeKey,queryKey,invalid});
 const statusKey=scopeKey+queryKey;
 const [busyState,setBusyState]=useState<{key:string;values:Record<string,boolean>}>({key:statusKey,values:{}}),[errorState,setErrorState]=useState<{key:string;values:Record<string,string>}>({key:statusKey,values:{}}),flights=useRef(new Map<string,AbortController>()),anchors=useRef<{recent?:string;ids:Record<string,string>}>({ids:{}}),reload=useRef(false);
 const pending=busyState.key===statusKey?busyState.values:noPending,errors=errorState.key===statusKey?errorState.values:noErrors;
 const returnKey=JSON.stringify([returnGroup,returnAnchor]),consumedReturn=useRef(initial&&initial.group===returnGroup&&initial.items.some(row=>row.id===returnAnchor)?returnKey:"");
 const visible=view?.scope===scopeKey?view:null,active=Object.values(pending).some(Boolean)&&!invalid;
 useActivityFeedback(active,{kind:"read"});
 const inputs=useRef({returnGroup,returnAnchor,returnKey,errors}),loadRef=useRef<(group?:string,kind?:"refresh"|"ensure"|"append"|"seek",rank?:number)=>Promise<void>>(async()=>{});
 useLayoutEffect(()=>{inputs.current={returnGroup,returnAnchor,returnKey,errors};},[returnGroup,returnAnchor,returnKey,errors]);
 const assign=useCallback((next:View)=>{current.current=next;setView(next);},[]);
 const load=useCallback(async(group?:string,kind:"refresh"|"ensure"|"append"|"seek"="refresh",rank?:number):Promise<void>=>{
  const {returnGroup,returnAnchor,returnKey,errors}=inputs.current;
  const expected=latest.current;if(!expected.scope||expected.invalid)return;
  const previous=current.current,same=Boolean(previous&&previous.scope===expected.scopeKey&&JSON.stringify(previous.page.query)===expected.queryKey),old=same?previous:null;
  const restoring=Boolean(returnAnchor&&returnGroup&&consumedReturn.current!==returnKey);
  const selected=group??(restoring?returnGroup:old?anchors.current.recent??returnGroup:returnGroup),oldWindow=old&&selected?repairGroupWindow(old.cache,old.page,selected):null,key=selected??"_meta";
  if(kind==="ensure"&&oldWindow?.items.length&&!errors[key])return;
  if(kind==="append"&&oldWindow?.items.length&&!oldWindow.nextCursor)return;
  if(flights.current.has(key)){if(kind==="refresh")reload.current=true;return;}
  const controller=new AbortController();flights.current.set(key,controller);
  const isCurrent=()=>flights.current.get(key)===controller&&!controller.signal.aborted&&latest.current.scopeKey===expected.scopeKey&&latest.current.queryKey===expected.queryKey;
  const expectedStatus=expected.scopeKey+expected.queryKey;
  const markPending=(value:boolean)=>setBusyState(state=>state.key===expectedStatus?{key:state.key,values:{...state.values,[key]:value}}:value?{key:expectedStatus,values:{[key]:true}}:state);
  const markError=(value:string)=>setErrorState(state=>({key:expectedStatus,values:{...(state.key===expectedStatus?state.values:{}),[key]:value}}));
  markPending(true);markError("");
  const focused=document.activeElement instanceof HTMLElement?document.activeElement.closest<HTMLElement>("[data-window-key]")?.dataset.windowKey:undefined;
  try{
   const missingReturn=restoring&&returnGroup===selected;
   const first=await requestRepairList(expected.scope,JSON.parse(expected.queryKey),{group:selected,cursor:kind==="append"&&oldWindow?.items.length?oldWindow.nextCursor??undefined:undefined,known:kind==="refresh"&&old&&!missingReturn?old.page.stateToken:undefined,anchor:kind!=="append"&&kind!=="seek"?missingReturn?returnAnchor:selected?anchors.current.ids[selected]??oldWindow?.items[0]?.id:undefined:undefined,seek:kind==="seek"?rank:undefined,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   if(!isCurrent()||"unchanged" in first)return;
   const before=current.current,compatible=before&&before.scope===expected.scopeKey&&JSON.stringify(before.page.query)===expected.queryKey;
   if(compatible&&["stale","inconsistent"].includes(repairReadVersionRelation(before.page,first))){reload.current=true;return;}
   let cache=acceptRepairWindow(compatible?before.cache:emptyRepairWindowCache(),first,focused);
   if(kind==="refresh"&&old&&old.page.stateToken!==first.stateToken){
    // Reauthorize the previously loaded windows, at most ten responses shared
    // across groups. Keep the old content until this complete new window set
    // is ready; no mix of generations and no collapse to the first50.
    const targets=[...new Set(old.cache.pages.map(page=>page.group))];let budget=first.items.length?1:0;
    for(const target of targets){
     const count=old.cache.pages.filter(page=>page.group===target).length;if(!first.groups.some(value=>value.key===target&&value.visibleCount))continue;
     let page=target===first.group?first:null,loaded=page?.items.length?1:0;
     if(!page&&budget<10){const oldRows=repairGroupWindow(old.cache,old.page,target);const response=await requestRepairList(expected.scope,JSON.parse(expected.queryKey),{group:target,anchor:anchors.current.ids[target]??oldRows.items[0]?.id,signal:controller.signal});if(!isCurrent()||"unchanged" in response)return;if(response.stateToken!==first.stateToken)throw Object.assign(new Error("资料已更新，请刷新后重试。"),{code:"READ_VERSION_CHANGED"});page=response;cache=acceptRepairWindow(cache,response,focused);budget++;loaded++;}
     while(page&&loaded<count&&budget<10&&page.nextCursor){const response=await requestRepairList(expected.scope,JSON.parse(expected.queryKey),{group:target,cursor:page.nextCursor,signal:controller.signal});if(!isCurrent()||"unchanged" in response)return;if(response.stateToken!==first.stateToken)throw Object.assign(new Error("资料已更新，请刷新后重试。"),{code:"READ_VERSION_CHANGED"});cache=acceptRepairWindow(cache,response,focused);page=response;loaded++;budget++;}
    }
   }
   if(isCurrent()){
    const latestView=current.current,matching=latestView?.scope===expected.scopeKey&&JSON.stringify(latestView.page.query)===expected.queryKey;
    if(matching&&["stale","inconsistent"].includes(repairReadVersionRelation(latestView.page,first))){reload.current=true;return;}
    if(matching&&latestView.cache!==before?.cache&&latestView.cache.token===first.stateToken){const currentFocus=document.activeElement instanceof HTMLElement?document.activeElement.closest<HTMLElement>("[data-window-key]")?.dataset.windowKey:undefined;cache=mergeRepairWindows(cache,latestView.cache,currentFocus);}
    if(first.group===returnGroup&&first.items.some(row=>row.id===returnAnchor))consumedReturn.current=returnKey;
    const observedRevision=matching&&latestView.page.stateToken===first.stateToken&&BigInt(latestView.page.observedRevision)>BigInt(first.observedRevision)?latestView.page.observedRevision:first.observedRevision;
    assign({scope:expected.scopeKey,page:{...metadata(first),observedRevision},cache});
   }
  }catch(reason){
   if(!isCurrent())return;
   if(typeof reason==="object"&&reason&&"code" in reason&&reason.code==="READ_VERSION_CHANGED"){reload.current=true;return;}
   markError(reason instanceof Error?reason.message:"后台资料暂不可用。");
  }finally{
   if(flights.current.get(key)===controller){flights.current.delete(key);markPending(false);if(reload.current&&!flights.current.size){reload.current=false;void loadRef.current();}}
  }
 },[assign]);
 useLayoutEffect(()=>{loadRef.current=load;},[load]);
 useLayoutEffect(()=>{if(latest.current.scopeKey!==scopeKey||latest.current.queryKey!==queryKey)anchors.current={ids:{}};latest.current={scope,scopeKey,queryKey,invalid};},[scope,scopeKey,queryKey,invalid]);
 const initialCurrent=Boolean(initial&&visible&&initial.stateToken===visible.page.stateToken&&JSON.stringify(initial.query)===queryKey&&(!returnAnchor||visible.cache.pages.some(page=>page.items.some(row=>row.id===returnAnchor))));
 useEffect(()=>{
  if(!scopeKey||invalid||initialCurrent)return;
  const activeFlights=flights.current,timer=setTimeout(()=>void load(),150);return()=>{clearTimeout(timer);for(const controller of activeFlights.values())controller.abort();activeFlights.clear();};
 },[scopeKey,queryKey,invalid,initialCurrent,initial,returnGroup,returnAnchor,load]);
 useEffect(()=>{const activeFlights=flights.current;return()=>{for(const controller of activeFlights.values())controller.abort();activeFlights.clear();};},[]);
 const page=visible?.page??null,matching=Boolean(page&&JSON.stringify(page.query)===queryKey);
 return{page,cache:visible?.cache??emptyRepairWindowCache(),pending:active,error:invalid?"请求资料无效。":errors._meta??"",resetKey:scopeKey+JSON.stringify(page?.query??query),scopeKey,
  group:(key:string)=>({...page&&visible?repairGroupWindow(visible.cache,page,key):{items:[],startIndex:0,extent:0,hasMore:true},pending:pending[key],error:errors[key]}),
  ensure:(key:string)=>{if(matching)void load(key,"ensure");},loadMore:(key:string)=>{if(matching)void load(key,"append");},seek:(key:string,index:number)=>{if(matching)void load(key,"seek",index);},
  remember:(key:string,id:string)=>{anchors.current.recent=key;anchors.current.ids[key]=id;},refresh:()=>void load()};
}
