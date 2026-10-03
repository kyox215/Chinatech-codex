"use client";
import { useEffect, useState } from "react";
import { useBackendMode, useBackendState } from "@/lib/backend/react";
import { customerCandidates, type Customer } from "@/lib/customers";

export function useBackendLookup<T>(kind:string,query:string,type="internal",page=1) {
  const backend=useBackendMode();const snapshot=useBackendState();const identity=`${snapshot?.storeId}:${snapshot?.staff.currentId}:${snapshot?.stateToken}`;
  const key=JSON.stringify([identity,kind,query,type,page]);
  const [result,setResult]=useState<{key:string;rows:T[];total:number;page:number;pageCount:number;loading:boolean;error:string;exact?:number;related?:number}>({key:"",rows:[],total:0,page:1,pageCount:1,loading:false,error:""});
  useEffect(()=>{
    if(!backend || !query.trim())return;
    const controller=new AbortController();let active=true;const timeout=window.setTimeout(()=>controller.abort(),20000);
    queueMicrotask(()=>{if(active)setResult({key,rows:[],total:0,page:1,pageCount:1,loading:true,error:""});});
    void fetch(`/api/backend/lookup?${new URLSearchParams({kind,q:query,type,page:String(page)})}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"读取失败。");if(active)setResult({key,rows:data.rows,total:data.total??data.rows.length,page:data.page??1,pageCount:data.pageCount??1,loading:false,error:"",exact:data.exact,related:data.related});}).catch(error=>{if(active)setResult({key,rows:[],total:0,page:1,pageCount:1,loading:false,error:error instanceof Error && error.name!=="AbortError"?error.message:"查询超时，请重试。"});}).finally(()=>window.clearTimeout(timeout));
    return()=>{active=false;controller.abort();window.clearTimeout(timeout);};
  },[backend,key,kind,query,type,page]);
  return result.key===key?{...result,backend}:{rows:[] as T[],total:0,page:1,pageCount:1,loading:backend && Boolean(query.trim()),error:"",backend,exact:undefined as number|undefined,related:undefined as number|undefined};
}
export function useCustomerCandidates(query:string,local:readonly Customer[]) {
  const remote=useBackendLookup<Customer>("customer",query.replace(/\D/g,"").length>=3?query:"");
  return {...remote,rows:remote.backend?remote.rows:customerCandidates(query,local)};
}
