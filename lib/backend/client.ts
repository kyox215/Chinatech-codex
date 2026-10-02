"use client";
import type { BackendSnapshot } from "./contracts";

let snapshot:BackendSnapshot|null=null;
let configured=false;
let generation=0;
const listeners=new Set<()=>void>();
export function isBackendClient(){return configured;}
export function backendSnapshot(){return snapshot;}
export function subscribeBackend(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publish(next:BackendSnapshot|null){snapshot=next;listeners.forEach(listener=>listener());}
export function configureBackend(initial:BackendSnapshot){generation++;configured=true;publish(initial);}
export function clearBackend(){generation++;publish(null);}
function requestScope(){return {generation,identity:snapshot?.staff.currentId,storeId:snapshot?.storeId};}
function sameScope(scope:ReturnType<typeof requestScope>){return scope.generation===generation && scope.identity===snapshot?.staff.currentId && scope.storeId===snapshot?.storeId;}
function accept(next:BackendSnapshot,scope:ReturnType<typeof requestScope>){
  if(!sameScope(scope) || !snapshot) return false;
  if(next.storeId!==scope.storeId || next.staff.currentId!==scope.identity) return false;
  const before=snapshot.staff.members.find(row=>row.id===snapshot?.staff.currentId)?.revision??0;
  const after=next.staff.members.find(row=>row.id===next.staff.currentId)?.revision??0;
  if(next.revision<snapshot.revision || after<before) return false;
  publish(next);return true;
}
export async function refreshBackend() {
  const scope=requestScope();if(!snapshot) return;
  const response=await fetch("/api/backend/state",{cache:"no-store"});
  if(!sameScope(scope)) return;
  if(response.status===401 || response.status===403){clearBackend();window.location.assign(response.status===401?"/login":"/account/pending");throw new Error("账号访问权限已变化。");}
  if(!response.ok) throw new Error("后台暂时不可用，请重试。");
  const next=await response.json() as BackendSnapshot;accept(next,scope);
}
export async function backendCommand(kind:string,payload:unknown,requestId=crypto.randomUUID()) {
  const previous=snapshot;if(!previous) throw new Error("后台资料尚未载入，请稍后重试。");
  const scope=requestScope();
  let response:Response;
  const body=JSON.stringify({kind,payload,requestId,storeId:previous.storeId});
  try {response=await fetch("/api/backend/command",{method:"POST",headers:{"Content-Type":"application/json"},body});}
  catch { // The same operation key makes a retry safe after an ambiguous network failure.
    response=await fetch("/api/backend/command",{method:"POST",headers:{"Content-Type":"application/json"},body});
  }
  if(!sameScope(scope)) throw new Error("身份已变化，请重新打开资料。");
  if(response.status===401){clearBackend();window.location.assign("/login");throw new Error("账号会话已失效。");}
  if(!response.ok){const error=await response.json() as {message?:string};if(response.status===409 || response.status===403) await refreshBackend().catch(()=>{});throw new Error(error.message||"保存失败。");}
  const next=await response.json() as BackendSnapshot;
  if(!sameScope(scope)){throw new Error("身份已变化，请重新打开资料。");}
  accept(next,scope);return snapshot!;
}
