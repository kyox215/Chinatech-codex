"use client";
import {flushSync} from "react-dom";
import {backendSnapshot,clearBackend} from "./client";
import {backendScopeKey,type BackendReadScope} from "./read-plan";
import{readResponseObject}from'./read-response';

/** Read-only transport. A business command's ordinary 403 never uses this path. */
export async function requestScopedList(scope:BackendReadScope,path:string,options:{signal?:AbortSignal;ids?:string[];body?:unknown}={}) {
 const body=options.body??(options.ids?{ids:options.ids}:undefined);
 const response=await fetch(path,{cache:"no-store",signal:options.signal,method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body),headers:{"x-ct-store-id":scope.storeId,"x-ct-read-scope":backendScopeKey(scope),...(body===undefined?{}:{"Content-Type":"application/json"})}});
 const isCurrent=()=>{const current=backendSnapshot()?.read?.scope;return current&&backendScopeKey(current)===backendScopeKey(scope);};
 if(!isCurrent())throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
 if(response.status===401||response.status===403){flushSync(()=>clearBackend());window.location.assign(response.status===401?"/login":"/account/pending");throw Object.assign(new Error('账号访问权限已变化。'),{status:response.status});}
 const payload=await readResponseObject(response);
 if(!isCurrent())throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
 if(payload.code==="IDENTITY_CHANGED"){flushSync(()=>clearBackend());window.location.reload();throw new Error('账号访问权限已变化。');}
 if(!response.ok)throw Object.assign(new Error(typeof payload.message==='string'?payload.message:"后台资料暂不可用。"),{code:payload.code,status:response.status});
 if(!payload.unchanged&&(!payload.scope||backendScopeKey(payload.scope)!==backendScopeKey(scope)||!Array.isArray(payload.items)))throw new Error("后台资料暂不可用。");
 return payload;
}
