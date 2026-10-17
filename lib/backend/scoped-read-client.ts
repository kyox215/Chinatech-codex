"use client";
import {flushSync} from "react-dom";
import {backendSnapshot,clearBackend} from "./client";
import {backendScopeKey,type BackendReadScope} from "./read-plan";

/** Read-only transport. A business command's ordinary 403 never uses this path. */
export async function requestScopedList(scope:BackendReadScope,path:string,options:{signal?:AbortSignal;ids?:string[]}={}) {
 const response=await fetch(path,{cache:"no-store",signal:options.signal,method:options.ids?"POST":"GET",body:options.ids?JSON.stringify({ids:options.ids}):undefined,headers:{"x-ct-store-id":scope.storeId,"x-ct-read-scope":backendScopeKey(scope),...(options.ids?{"Content-Type":"application/json"}:{})}});
 const isCurrent=()=>{const current=backendSnapshot()?.read?.scope;return current&&backendScopeKey(current)===backendScopeKey(scope);};
 if(!isCurrent())throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
 if(response.status===401||response.status===403){flushSync(()=>clearBackend());window.location.assign(response.status===401?"/login":"/account/pending");}
 const payload=await response.json();
 if(!isCurrent())throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
 if(payload.code==="IDENTITY_CHANGED"){flushSync(()=>clearBackend());window.location.reload();}
 if(!response.ok)throw Object.assign(new Error(payload.message||"后台资料暂不可用。"),{code:payload.code,status:response.status});
 if(!payload.unchanged&&(!payload.scope||backendScopeKey(payload.scope)!==backendScopeKey(scope)||!Array.isArray(payload.items)))throw new Error("后台资料暂不可用。");
 return payload;
}
