"use client";
import {flushSync} from "react-dom";
import {backendSnapshot,clearBackend} from "./client";
import {backendScopeKey,pagePlanKey,type PageReadPlan} from "./read-plan";
import type {BackendSnapshot} from "./contracts";
import{readResponseObject}from'./read-response';

export async function requestBackendEntityPage(plan:PageReadPlan,scope:string,known?:string):Promise<BackendSnapshot|{unchanged:true;stateToken:string}> {
 const matches=()=>Boolean(backendSnapshot()?.read)&&backendScopeKey(backendSnapshot()!.read!.scope)===scope;
 if(!matches())throw new Error("账号访问权限已变化。");
 const current=backendSnapshot()!,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const params=new URLSearchParams({plan:JSON.stringify(plan),...(known?{known}:{})}),response=await fetch(`/api/backend/v2/page?${params}`,{cache:"no-store",signal:controller.signal,headers:{"x-ct-store-id":current.storeId,"x-ct-read-scope":scope}});
  // Known authorization denial must hide the current private document before
  // attempting to decode a potentially empty/HTML proxy error response.
  if(response.status===401||response.status===403){if(matches()){flushSync(()=>clearBackend());window.location.assign(response.status===401?"/login":"/account/pending");}throw new Error("账号访问权限已变化。");}
  const data=await readResponseObject(response);
  if(!matches())throw new Error('账号访问权限已变化。');
  if(response.status===409&&data.code==="IDENTITY_CHANGED"){if(matches()){flushSync(()=>clearBackend());window.location.reload();}throw new Error("账号访问权限已变化。");}
  if(!response.ok)throw new Error(typeof data.message==="string"?data.message:"后台暂时不可用，当前输入已保留。 ");
  if(data.unchanged===true){if(!known||data.stateToken!==known)throw new Error("后台核对结果无效，请稍后重试。");return{unchanged:true,stateToken:known};}
  if(!data.read||backendScopeKey(data.read.scope)!==scope||pagePlanKey(data.read.plan)!==pagePlanKey(plan))throw new Error("后台核对结果无效，请稍后重试。");
  return data;
 }finally{clearTimeout(timer);}
}
