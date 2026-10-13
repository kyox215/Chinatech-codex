"use client";
import { useEffect, useState } from 'react';
import { backendSnapshot } from '@/lib/backend/client';
import { useStaff } from '@/components/staff/use-staff';
import { CatalogError } from '@/lib/device-catalog';
type Cached = { expires: number; result: Promise<unknown> };
const requests=new Map<string,Cached>();
export function invalidateCatalog(){requests.clear();window.dispatchEvent(new Event('ct:catalog-updated'));}
export function catalogScope(){const state=backendSnapshot();return state?`${state.storeId}:${state.staff.currentId}:${state.staff.members.find(row=>row.id===state.staff.currentId)?.revision}`:'preview';}
export function catalogHeaders():Record<string,string>{const state=backendSnapshot();return state?{'x-ct-store-id':state.storeId}:{};}
export function useCatalogRead<T>(params:Record<string,string>,enabled=true){
  const staff=useStaff();const [epoch,setEpoch]=useState(0);const [value,setValue]=useState<{key:string;data:T|null;error:string;loading:boolean}>({key:'',data:null,error:'',loading:false});
  const kind=params.kind;const scope=catalogScope();const query=new URLSearchParams(params).toString();const key='catalog-v1|'+scope+'|'+query+'|'+epoch;
  useEffect(()=>{const refresh=()=>{requests.clear();setEpoch(value=>value+1);};window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('ct:catalog-updated',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('ct:catalog-updated',refresh);};},[]);
  useEffect(()=>{
    if(!enabled||!staff.ready||!staff.member)return;let live=true;
    const timeout=setTimeout(()=>{
      setValue({key,data:null,error:'',loading:true});const cacheKey='catalog-v1|'+scope+'|'+query;
      let pending=requests.get(cacheKey);if(!pending||pending.expires<Date.now()){
        const result=fetch('/api/catalog?'+query,{credentials:'same-origin',cache:'no-store',headers:catalogHeaders()}).then(async response=>{const data=await response.json();if(!response.ok)throw new CatalogError(typeof data.message==='string'?data.message:'设备目录暂不可用，请稍后重试。',response.status);return data;});
        pending={expires:Date.now()+15000,result};requests.set(cacheKey,pending);void result.finally(()=>{if(requests.get(cacheKey)?.result===result)requests.delete(cacheKey);}).catch(()=>undefined);
      }
      pending.result.then(data=>{if(live&&catalogScope()===scope)setValue({key,data:data as T,error:'',loading:false});}).catch(error=>{if(live&&catalogScope()===scope)setValue({key,data:null,error:error instanceof CatalogError?error.message:'设备目录暂不可用，请稍后重试。',loading:false});});
    },kind==='models'?150:0);
    return()=>{live=false;clearTimeout(timeout);};
  },[key,scope,query,kind,enabled,staff.ready,staff.member]);
  return {data:value.key===key?value.data:null,error:value.key===key?value.error:'',loading:enabled&&(value.key!==key||value.loading),retry:()=>setEpoch(value=>value+1)};
}
