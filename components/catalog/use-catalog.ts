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
type Cached = { expires: number; result: Promise<unknown>;controller:AbortController;readers:number };
const requests=new Map<string,Cached>();
export function invalidateCatalog(){requests.clear();pickerIndex.invalidate();window.dispatchEvent(new Event('ct:catalog-updated'));}
function keyedScope(state:ReturnType<typeof backendSnapshot>,member:StaffMember|null,formal:boolean){if(!member||formal&&!state)return '';return JSON.stringify([backendReadGeneration(),state?.storeId??'preview',member.id,member.revision,member.accountStatus,member.membershipStatus,[...member.permissions].sort()]);}
export function catalogScope(){return keyedScope(backendSnapshot(),readStaffSnapshot().member,isBackendClient());}
export function catalogHeaders():Record<string,string>{const state=backendSnapshot();return state?{'x-ct-store-id':state.storeId}:{};}
export function useCatalogRead<T>(params:Record<string,string>,enabled=true,retainPrevious=false){
  const backend=useBackendState();const staff=useStaff();const liveScope=useSyncExternalStore(subscribeStaff,catalogScope,()=>'');const [epoch,setEpoch]=useState(0);const [foreground,setForeground]=useState(false);
  const [value,setValue]=useState<{key:string;scope:string;query:string;data:T|null;error:string;status:number|null;loading:boolean}>({key:'',scope:'',query:'',data:null,error:'',status:null,loading:false});
  const kind=params.kind;const scope=keyedScope(backend.snapshot,staff.member,backend.formal);const query=new URLSearchParams(params).toString();const key='catalog-v1|'+scope+'|'+query+'|'+epoch;
  // Visibility changes are a new scope; never retain administrator rows for a viewer.
  const retentionScope=scope+'|'+kind+'|'+(params.disabled??'');
  const awaiting=backend.formal&&Boolean(backend.snapshot)&&(!backend.active||scope!==liveScope);
  const canRead=staff.ready&&Boolean(staff.member)&&Boolean(scope)&&!awaiting;
  const retained=enabled&&canRead&&value.scope===retentionScope&&(retainPrevious||value.query===query)?value.data:null;
  const loading=enabled&&(awaiting||!staff.ready||canRead&&(value.key!==key||value.loading));
  useActivityFeedback(loading&&(!retained||value.query!==query||foreground),{kind:'read',scope});
  useEffect(()=>{const refresh=()=>{requests.clear();setForeground(false);setEpoch(value=>value+1);};window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('ct:catalog-updated',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('ct:catalog-updated',refresh);};},[]);
  useEffect(()=>{
    if(!enabled||!canRead)return;let live=true;const headers=catalogHeaders();let pending:Cached|undefined;
    const timeout=setTimeout(()=>{
      setValue(previous=>({key,scope:retentionScope,query:previous.scope===retentionScope?previous.query:query,data:previous.scope===retentionScope&&(retainPrevious||previous.query===query)?previous.data:null,error:'',status:null,loading:true}));
      const cacheKey='catalog-v1|'+scope+'|'+query;
      pending=requests.get(cacheKey);if(!pending||pending.expires<Date.now()){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
        const result=fetch('/api/catalog?'+query,{credentials:'same-origin',cache:'no-store',headers,signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new CatalogError(typeof data.message==='string'?data.message:'设备目录暂不可用，请稍后重试。',response.status);return data;});
        pending={expires:Date.now()+15000,result,controller,readers:0};requests.set(cacheKey,pending);void result.finally(()=>{clearTimeout(timer);if(requests.get(cacheKey)?.result===result)requests.delete(cacheKey);}).catch(()=>undefined);
      }
      pending.readers++;
      pending.result.then(data=>{if(live&&catalogScope()===scope){setValue({key,scope:retentionScope,query,data:data as T,error:'',status:null,loading:false});setForeground(false);}}).catch(error=>{if(live&&catalogScope()===scope){setValue(previous=>({...previous,key,scope:retentionScope,data:error instanceof CatalogError&&[401,403,409].includes(error.status)?null:previous.scope===retentionScope&&(retainPrevious||previous.query===query)?previous.data:null,error:error instanceof CatalogError?error.message:'设备目录暂不可用，请稍后重试。',status:error instanceof CatalogError?error.status:null,loading:false}));setForeground(false);}});
    },kind==='models'?150:0);
    return()=>{live=false;clearTimeout(timeout);if(pending&&--pending.readers===0){pending.controller.abort();const cacheKey='catalog-v1|'+scope+'|'+query;if(requests.get(cacheKey)===pending)requests.delete(cacheKey);}};
  },[key,scope,query,kind,enabled,canRead,retentionScope,retainPrevious]);
  return {data:retained,blocked:value.key===key&&[401,403,409].includes(value.status??0),error:staff.ready&&!canRead&&!awaiting?staff.error||'当前账号没有获授权的门店。':value.key===key?value.error:'',loading,stale:Boolean(retained&&(value.key!==key||value.query!==query||value.error)),retry:()=>{setForeground(true);setEpoch(value=>value+1);}};
}

/** Accumulate the catalog's existing 50-row API pages without retaining another scope. */
export function useCatalogPages(params: Record<string, string>, enabled: boolean, revision: string) {
  const backend = useBackendState(); const staff = useStaff();
  const scope = keyedScope(backend.snapshot, staff.member, backend.formal);
  const key = JSON.stringify([scope, params, revision]);
  const [window, setWindow] = useState<{ key: string; page: number; pages: CatalogPage[]; response: CatalogPage | null }>({ key, page: 1, pages: [], response: null });
  const current = window.key === key ? window : { key, page: 1, pages: [], response: null };
  if (window.key !== key) setWindow(current);
  const read = useCatalogRead<CatalogPage>({ ...params, page: String(current.page) }, enabled);
  let pages = current.pages;
  const response = read.data;
  if (read.blocked && pages.length) {
    pages = [];
    setWindow({ ...current, pages, response: null });
  }
  if (response && response !== current.response && !read.stale) {
    if (pages.length && pages[0].revision !== response.revision && response.page !== 1) {
      pages = [];
      setWindow({ key, page: 1, pages, response: null });
    } else if (response.page <= pages.length + 1) {
      pages = [...pages.slice(0, response.page - 1), response];
      setWindow({ ...current, pages, response });
    } else {
      // A rejected accumulated window must restart from its first authorized page.
      setWindow({ key, page: 1, pages: [], response: null });
    }
  }
  const visiblePages = enabled && !read.blocked ? pages : [];
  const rows = [...new Map(visiblePages.flatMap(page => page.rows).map(row => [row.id, row])).values()];
  const total = visiblePages.at(-1)?.total ?? 0;
  return { ...read, rows, total, resetKey: key, hasMore: rows.length < total,
    loadMore: () => { if (read.error) read.retry(); else if (!read.loading && rows.length < total) setWindow({ ...current, page: current.page + 1 }); },
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
