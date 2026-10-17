"use client";
import {flushSync} from "react-dom";
import {backendSnapshot,clearBackend} from "@/lib/backend/client";
import {backendScopeKey,type BackendReadScope} from "@/lib/backend/read-plan";
import type {ProcurementListPage,ProcurementListQuery} from "@/lib/backend/procurement-list-contract";
import type {ProcurementBatchPage,ProcurementBatchQuery,ProcurementRepairCandidate} from "@/lib/backend/procurement-batch-contract";

async function request(scope:BackendReadScope,path:string,options:{signal?:AbortSignal;ids?:string[]}={}) {
 const response=await fetch(path,{cache:"no-store",signal:options.signal,method:options.ids?"POST":"GET",body:options.ids?JSON.stringify({ids:options.ids}):undefined,headers:{"x-ct-store-id":scope.storeId,"x-ct-read-scope":backendScopeKey(scope),...(options.ids?{"Content-Type":"application/json"}:{})}});
 const isCurrent=()=>{const current=backendSnapshot()?.read?.scope;return current&&backendScopeKey(current)===backendScopeKey(scope);};
 if(!isCurrent())throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
 // A denied HTML/empty response must remove private content before JSON parsing.
 // Late denials from a previous identity must never clear the new identity.
 if(response.status===401||response.status===403){flushSync(()=>clearBackend());window.location.assign(response.status===401?"/login":"/account/pending");}
 const payload=await response.json();
 if(!isCurrent())throw new Error("登录身份或页面版本已变化，请刷新后重新核对。");
 if(payload.code==="IDENTITY_CHANGED"){flushSync(()=>clearBackend());window.location.reload();}
 if(!response.ok)throw Object.assign(new Error(payload.message||"后台资料暂不可用。"),{code:payload.code,status:response.status});
 if(!payload.unchanged&&(!payload.scope||backendScopeKey(payload.scope)!==backendScopeKey(scope)||!Array.isArray(payload.items)))throw new Error("后台资料暂不可用。");
 return payload;
}
export async function requestProcurementList(scope:BackendReadScope,query:ProcurementListQuery,options:{cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal}={}) {
 const params=new URLSearchParams(query);
 for(const key of ["cursor","known","anchor"] as const)if(options[key])params.set(key,options[key]!);
 if(options.seek!==undefined)params.set("seek",String(options.seek));
 const value=await request(scope,"/api/backend/v2/procurement?"+params,options);
 if(!value.unchanged&&(JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>50))throw new Error("后台资料暂不可用。");
 return value as ProcurementListPage|{unchanged:true;stateToken:string};
}
export async function requestProcurementBatch(scope:BackendReadScope,query:ProcurementBatchQuery,options:{cursor?:string;ids?:string[];seek?:number;signal?:AbortSignal}={}) {
 const params=new URLSearchParams(query);if(options.cursor)params.set("cursor",options.cursor);
 if(options.seek!==undefined)params.set("seek",String(options.seek));
 const value=await request(scope,"/api/backend/v2/procurement/batch?"+params,options);
 if(value.items.length>(query.kind==="repairs"?12:options.ids?100:50))throw new Error("后台资料暂不可用。");
 return value as ProcurementBatchPage|{scope:BackendReadScope;items:ProcurementRepairCandidate[]};
}
