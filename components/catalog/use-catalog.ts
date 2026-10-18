"use client";
import { useBackendState } from "@/components/backend-snapshot";
import type { StaffMember } from "@/lib/staff";
import { useActivityFeedback } from "@/components/operation-feedback";
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { backendReadGeneration, backendSnapshot, isBackendClient } from '@/lib/backend/client';
import { readStaffSnapshot,subscribeStaff } from '@/lib/staff-client';
import { subscribeAuthChanged } from '@/lib/auth-events';
import { useStaff } from '@/components/staff/use-staff';
import { CatalogError, type CatalogPage, type CatalogPickerResponse } from '@/lib/device-catalog';
import { createCatalogIndexClient, type PickerQuery, type PickerRead } from '@/lib/device-catalog-index-client';
import { useCatalogInitialData } from './catalog-initial-data';
import { catalogPickerScopeKey } from '@/lib/device-catalog';
import { mergeCatalogWindow } from '@/lib/catalog-window';
type Cached = { expires: number; result: Promise<unknown>;controller:AbortController;readers:number };
const requests=new Map<string,Cached>();
export function invalidateCatalog(){requests.clear();pickerIndex.invalidate();window.dispatchEvent(new Event('ct:catalog-updated'));}
function keyedScope(state:ReturnType<typeof backendSnapshot>,member:StaffMember|null,formal:boolean){if(!member||formal&&!state)return '';return JSON.stringify([backendReadGeneration(),state?.storeId??'preview',member.id,member.revision,member.accountStatus,member.membershipStatus,[...member.permissions].sort()]);}
export function catalogScope(){return keyedScope(backendSnapshot(),readStaffSnapshot().member,isBackendClient());}
export function catalogHeaders():Record<string,string>{const state=backendSnapshot(),scope=state?.read?.scope;return state?{'x-ct-store-id':state.storeId,...(scope?{'x-ct-account-id':scope.accountId,'x-ct-session-id':scope.sessionId,'x-ct-catalog-scope':catalogPickerScopeKey(scope)}:{})}:{};}
export function useCatalogRead<T>(params:Record<string,string>,enabled=true,retainPrevious=false){
  const initial=useCatalogInitialData();
  const backend=useBackendState();const staff=useStaff();const liveScope=useSyncExternalStore(subscribeStaff,catalogScope,()=>'');const [epoch,setEpoch]=useState(0);const [foreground,setForeground]=useState(false);
  const [value,setValue]=useState<{key:string;scope:string;query:string;data:T|null;error:string;status:number|null;loading:boolean}>({key:'',scope:'',query:'',data:null,error:'',status:null,loading:false});
  const kind=params.kind;const scope=keyedScope(backend.snapshot,staff.member,backend.formal);const query=new URLSearchParams(params).toString();const key='catalog-v1|'+scope+'|'+query+'|'+epoch;
  // Visibility changes are a new scope; never retain administrator rows for a viewer.
  const retentionScope=scope+'|'+kind+'|'+(params.disabled??'');
  const awaiting=backend.formal&&Boolean(backend.snapshot)&&(!backend.active||scope!==liveScope);
  const canRead=staff.ready&&Boolean(staff.member)&&Boolean(scope)&&!awaiting;
  const seedMatches=Boolean(initial?.formatVersion===1&&initial.page.revision===initial.state.revision&&backend.snapshot?.read?.scope.formatVersion===2&&staff.member&&catalogPickerScopeKey(initial.scope)===catalogPickerScopeKey(backend.snapshot.read.scope)&&initial.scope.memberId===staff.member.id&&initial.scope.memberRevision===staff.member.revision);
  const firstPage=kind==='models'&&Object.entries(params).every(([name,value])=>name==='kind'||name==='page'&&value==='1'||name==='disabled'&&value===String(initial?.includeDisabled)||['category','brand','q'].includes(name)&&value==='');
  const seeded=epoch===0&&seedMatches&&(kind==='state'||firstPage)?(kind==='state'?initial!.state:initial!.page) as T:null;
  const current=value.key===key?value:seeded?{key,scope:retentionScope,query,data:seeded,error:'',status:null,loading:false}:value;
  const retained=enabled&&canRead&&current.scope===retentionScope&&(retainPrevious||current.query===query)?current.data:null;
  const loading=enabled&&(awaiting||!staff.ready||canRead&&(current.key!==key||current.loading));
  useActivityFeedback(loading&&(!retained||value.query!==query||foreground),{kind:'read',scope});
  useEffect(()=>{const refresh=()=>{requests.clear();setForeground(false);setEpoch(value=>value+1);};window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('ct:catalog-updated',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('ct:catalog-updated',refresh);};},[]);
  useEffect(()=>{
    if(!enabled||!canRead||seeded)return;let live=true;const headers=catalogHeaders();let pending:Cached|undefined;
    const timeout=setTimeout(()=>{
      setValue(previous=>({key,scope:retentionScope,query:previous.scope===retentionScope?previous.query:query,data:previous.scope===retentionScope&&(retainPrevious||previous.query===query)?previous.data:null,error:'',status:null,loading:true}));
      const cacheKey='catalog-v1|'+scope+'|'+query;
      pending=requests.get(cacheKey);if(!pending||pending.expires<Date.now()){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
        const result=fetch('/api/catalog?'+query,{credentials:'same-origin',cache:'no-store',headers,signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new CatalogError(typeof data.message==='string'?data.message:'设备目录暂不可用，请稍后重试。',response.status);return data;});
        pending={expires:Date.now()+15000,result,controller,readers:0};requests.set(cacheKey,pending);void result.finally(()=>{clearTimeout(timer);if(requests.get(cacheKey)?.result===result)requests.delete(cacheKey);}).catch(()=>undefined);
      }
      pending.readers++;
      pending.result.then(data=>{if(live&&catalogScope()===scope){if(kind==='models')mergeCatalogWindow([],data as CatalogPage);setValue({key,scope:retentionScope,query,data:data as T,error:'',status:null,loading:false});setForeground(false);}}).catch(error=>{if(live&&catalogScope()===scope){setValue(previous=>({...previous,key,scope:retentionScope,data:error instanceof CatalogError&&[401,403,409].includes(error.status)?null:previous.scope===retentionScope&&(retainPrevious||previous.query===query)?previous.data:null,error:error instanceof CatalogError?error.message:'设备目录暂不可用，请稍后重试。',status:error instanceof CatalogError?error.status:null,loading:false}));setForeground(false);}});
    },0);
    return()=>{live=false;clearTimeout(timeout);if(pending&&--pending.readers===0){pending.controller.abort();const cacheKey='catalog-v1|'+scope+'|'+query;if(requests.get(cacheKey)===pending)requests.delete(cacheKey);}};
  },[key,scope,query,kind,enabled,canRead,retentionScope,retainPrevious,seeded]);
  return {data:retained,blocked:current.key===key&&[401,403,409].includes(current.status??0),error:staff.ready&&!canRead&&!awaiting?staff.error||'当前账号没有获授权的门店。':current.key===key?current.error:'',loading,stale:Boolean(retained&&(current.key!==key||current.query!==query||current.error)),retry:()=>{setForeground(true);setEpoch(value=>value+1);}};
}

/** Debounce only a changed nonempty search within the same authenticated filters. */
export function useCatalogSearch(text: string, filters: string) {
  const [settled,setSettled]=useState({filters,text});
  const immediate=settled.filters!==filters||!text;
  if(immediate&&(settled.filters!==filters||settled.text!==text))setSettled({filters,text});
  const query=immediate?text:settled.text;
  useEffect(()=>{
    if(immediate)return;
    if(text===settled.text)return;
    const timer=setTimeout(()=>setSettled({filters,text}),150);return()=>clearTimeout(timer);
  },[text,filters,immediate,settled.text]);
  return {query,flush:()=>setSettled({filters,text})};
}
/** Retain at most 10 existing 50-row API batches; old ranges use the same API. */
export function useCatalogPages(params: Record<string, string>, enabled: boolean, revision: string) {
  const backend = useBackendState(); const staff = useStaff();
  const scope = keyedScope(backend.snapshot, staff.member, backend.formal);
  const key = JSON.stringify([scope, params, revision]);
  type Window={key:string;scope:string;page:number;pages:CatalogPage[];retained:CatalogPage[];response:CatalogPage|null;extent:number};
  const [window, setWindow] = useState<Window>({ key, scope, page: 1, pages: [], retained:[], response: null, extent:0 });
  const current = window.key === key ? window : { key, scope, page: 1, pages: [], retained:window.scope===scope?window.pages:[], response: null, extent:0 };
  if (window.key !== key) setWindow(current);
  const read = useCatalogRead<CatalogPage>({ ...params, page: String(current.page) }, enabled);
  let pages = current.pages;
  const response = read.data;
  if (read.blocked && pages.length) {
    pages = [];
    setWindow({ ...current, pages, retained:[], response: null });
  }
  if (response && response !== current.response && !read.stale) {
    if (response.page !== 1 && (!pages.length || pages[0].revision !== response.revision)) {
      pages = [];
      setWindow({ ...current, page: 1, pages, retained:[], response: null, extent:0 });
    } else {
      pages = mergeCatalogWindow(pages, response);
      setWindow({ ...current, pages, retained:[], response, extent:Math.max(current.extent,(response.page-1)*50+response.rows.length) });
    }
  }
  const visiblePages = enabled && !read.blocked ? pages.length?pages:current.retained : [];
  const rows = [...new Map(visiblePages.flatMap(page => page.rows).map(row => [row.id, row])).values()];
  const total = visiblePages.at(-1)?.total ?? 0;
  const startIndex=((visiblePages[0]?.page??1)-1)*50,end=startIndex+rows.length;
  const next=(page:number)=>{if(!read.loading&&!read.error&&pages.length)setWindow({...current,page});};
  return { ...read, stale:read.stale||Boolean(current.retained.length), rows, total, startIndex, extent:Math.max(current.extent,end), resetKey: key, hasMore:!!pages.length&&end < total,
    loadMore: () => { if (read.error) read.retry(); else if (end < total) next((pages.at(-1)?.page??0)+1); },
    loadPrevious:()=>{if(pages[0]?.page>1)next(pages[0].page-1);},
    seek:(index:number)=>{if(Number.isSafeInteger(index)&&index>=0&&index<total)next(Math.floor(index/50)+1);},
  };
}

const pickerIndex=createCatalogIndexClient({
  scope:catalogScope,headers:catalogHeaders,fetch:(...args)=>fetch(...args),
  matches:(response:CatalogPickerResponse)=>{const state=backendSnapshot();if(!isBackendClient())return response.scope.accountId==='preview';const member=readStaffSnapshot().member;return Boolean(state&&member&&response.scope.storeId===state.storeId&&response.scope.memberId===member.id&&response.scope.memberRevision===member.revision);},
});
const emptyIndex:PickerRead={data:null,loading:false,error:'',ready:false};
let indexSubscriptions=0;
let stopIndexEvents:(()=>void)|undefined;
function subscribeIndex(listener:()=>void){
  const stop=pickerIndex.subscribe(listener);
  if(indexSubscriptions++===0){
    const revalidate=()=>{if(document.visibilityState==='visible'&&navigator.onLine)pickerIndex.invalidate(false);};
    const offline=()=>pickerIndex.invalidate();
    const stopAuth=subscribeAuthChanged(()=>pickerIndex.invalidate());
    let observedScope=catalogScope();
    const stopStaff=subscribeStaff(()=>{const next=catalogScope();if(next!==observedScope){observedScope=next;pickerIndex.invalidate();}});
    window.addEventListener('focus',revalidate);window.addEventListener('online',revalidate);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',revalidate);
    window.addEventListener('ct:catalog-updated',revalidate);
    const timer=window.setInterval(revalidate,30000);
    stopIndexEvents=()=>{stopAuth();stopStaff();clearInterval(timer);window.removeEventListener('focus',revalidate);window.removeEventListener('online',revalidate);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',revalidate);window.removeEventListener('ct:catalog-updated',revalidate);};
  }
  return()=>{stop();if(--indexSubscriptions===0){stopIndexEvents?.();stopIndexEvents=undefined;}};
}
export function useCatalogIndex(query:PickerQuery,enabled=true){
  const backend=useBackendState();const staff=useStaff();const liveScope=useSyncExternalStore(subscribeStaff,catalogScope,()=>'');const scope=keyedScope(backend.snapshot,staff.member,backend.formal);const queryKey=JSON.stringify(query);
  const awaiting=backend.formal&&Boolean(backend.snapshot)&&(!backend.active||scope!==liveScope);
  const canRead=staff.ready&&Boolean(staff.member)&&Boolean(scope)&&!awaiting;
  const getSnapshot=useCallback(()=>canRead&&scope===catalogScope()?pickerIndex.read(JSON.parse(queryKey)):emptyIndex,[queryKey,scope,canRead]);
  const value=useSyncExternalStore(subscribeIndex,getSnapshot,()=>emptyIndex);
  useEffect(()=>{if(enabled&&canRead)return pickerIndex.retain(JSON.parse(queryKey));},[enabled,canRead,scope,queryKey]);
  useEffect(()=>{if(enabled&&canRead&&!value.ready&&!value.error)void pickerIndex.load(JSON.parse(queryKey));},[enabled,canRead,scope,queryKey,value]);
  return {...value,data:canRead?value.data:null,ready:canRead&&value.ready,error:staff.ready&&!canRead&&!awaiting?staff.error||'当前账号没有获授权的门店。':value.error,loading:enabled&&(awaiting||!staff.ready||canRead&&(!value.ready&&!value.error)),retry:()=>void pickerIndex.load(query,true)};
}
