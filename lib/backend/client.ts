"use client";
import type { BackendCommand, BackendSnapshot, OperationReceipt, UnchangedState } from "./contracts";
import { memberScope, pendingOperation, reserveOperation, markOperationUnknown, forgetOperation, type PendingOperation } from "./recovery-store";

let snapshot:BackendSnapshot|null=null;
let configured=false;
let generation=0;
let writing=false;
let refreshFlight:Promise<void>|null=null;
let recoveryFlight:Promise<void>|null=null;
let recoveryGeneration=0;
let operationGeneration=0;
let recoveryOperationGeneration=0;
const listeners=new Set<()=>void>();
const recoveryListeners=new Set<()=>void>();
export type RecoveryStatus={busy:boolean;pending:PendingOperation|null;message:string;receipt?:OperationReceipt};
let recovery:RecoveryStatus={busy:false,pending:null,message:""};
export function backendRecovery(){return recovery;}
export function subscribeRecovery(listener:()=>void){recoveryListeners.add(listener);return()=>{recoveryListeners.delete(listener);};}
function recoveryUpdate(next:RecoveryStatus){recovery=next;recoveryListeners.forEach(listener=>listener());}
export function isBackendClient(){return configured;}
export function backendSnapshot(){return snapshot;}
export function subscribeBackend(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publish(next:BackendSnapshot|null){snapshot=next;listeners.forEach(listener=>listener());}
export function configureBackend(initial:BackendSnapshot){generation++;configured=true;refreshFlight=null;publish(initial);recoveryUpdate({busy:false,pending:null,message:""});void loadRecovery();}
export function clearBackend(){generation++;refreshFlight=null;publish(null);recoveryUpdate({busy:false,pending:null,message:""});}
function requestScope(){return {generation,identity:snapshot?.staff.currentId,storeId:snapshot?.storeId};}
function sameScope(scope:ReturnType<typeof requestScope>){return scope.generation===generation && scope.identity===snapshot?.staff.currentId && scope.storeId===snapshot?.storeId;}
function accept(next:BackendSnapshot,scope:ReturnType<typeof requestScope>){
  if(!sameScope(scope) || !snapshot) return false;
  if(next.storeId!==scope.storeId || next.staff.currentId!==scope.identity){clearBackend();window.location.reload();return false;}
  const before=snapshot.staff.members.find(row=>row.id===snapshot?.staff.currentId)?.revision??0;
  const after=next.staff.members.find(row=>row.id===next.staff.currentId)?.revision??0;
  if(next.revision<snapshot.revision || after<before) return false;
  if(next.stateToken && next.stateToken===snapshot.stateToken) return true;
  publish(next);return true;
}
async function request(url:string,init:RequestInit={}) {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try {const response=await fetch(url,{...init,cache:"no-store",signal:controller.signal});const data=await response.json();return {response,data};}
  finally {clearTimeout(timer);}
}
function redirectIdentity(status:number,code?:string){
  if(code==="IDENTITY_CHANGED"){clearBackend();window.location.reload();return true;}
  if(status===401){clearBackend();window.location.assign("/login");return true;}
  return false;
}
export function loadRecovery():Promise<void>{
  const scope=requestScope();if(!snapshot || writing)return Promise.resolve();
  const operationEpoch=operationGeneration;
  if(recoveryFlight && recoveryGeneration===scope.generation && recoveryOperationGeneration===operationEpoch)return recoveryFlight;
  const key=memberScope(snapshot);
  const promise=(async()=>{
    try {const pending=await pendingOperation(key);if(sameScope(scope) && !writing && operationGeneration===operationEpoch){
      const next=pending??null;
      const before=recovery.pending;
      if(next?.command.requestId!==before?.command.requestId || next?.phase!==before?.phase || next?.scope!==before?.scope || next?.createdAt!==before?.createdAt)recoveryUpdate({...recovery,pending:next});
    }}
    catch(error){if(sameScope(scope) && !writing && operationGeneration===operationEpoch)recoveryUpdate({...recovery,message:error instanceof Error?error.message:"设备恢复资料暂不可用。"});}
  })();
  recoveryFlight=promise;recoveryGeneration=scope.generation;recoveryOperationGeneration=operationEpoch;
  void promise.finally(()=>{if(recoveryFlight===promise)recoveryFlight=null;}).catch(()=>{});
  return promise;
}
export function refreshBackend():Promise<void> {
  if(refreshFlight)return refreshFlight;
  const scope=requestScope();if(!snapshot)return Promise.resolve();
  const previous=snapshot;
  const known=previous.stateToken && /^[a-f0-9]{64}$/.test(previous.stateToken)?previous.stateToken:undefined;
  const promise=(async()=>{
    const {response,data}=await request(known?`/api/backend/state?known=${known}`:"/api/backend/state");
    if(!sameScope(scope))return;
    if(response.status===401 || response.status===403){clearBackend();window.location.assign(response.status===401?"/login":"/account/pending");throw new Error("账号访问权限已变化。");}
    if(!response.ok)throw new Error("后台暂时不可用，当前输入已保留。 ");
    if(data.unchanged===true){
      const unchanged=data as UnchangedState;
      if(!known || unchanged.stateToken!==known || unchanged.storeId!==scope.storeId || unchanged.memberId!==scope.identity || unchanged.revision!==previous.revision)throw new Error("后台核对结果无效，请稍后重试。");
      return;
    }
    accept(data as BackendSnapshot,scope);
  })();
  refreshFlight=promise;
  void promise.finally(()=>{if(refreshFlight===promise)refreshFlight=null;}).catch(()=>{});
  return promise;
}
async function complete(operation:PendingOperation,next:BackendSnapshot,scope:ReturnType<typeof requestScope>){
  if(!sameScope(scope))throw new Error("身份已变化，请重新打开资料。");
  if(!next.operation || next.operation.requestId!==operation.command.requestId)throw new Error("提交回执尚未确认，请核对原请求。");
  accept(next,scope);
  if(!sameScope(scope))throw new Error("身份已变化，请重新打开资料。");
  let message="提交已确认保存。";
  try {await forgetOperation(operation.scope,operation.command.requestId);}catch{message="门店已保存，设备恢复记录尚未清理；可再次核对。";}
  if(!sameScope(scope))throw new Error("身份已变化，请重新打开资料。");
  recoveryUpdate({busy:false,pending:message.startsWith("门店")?operation:null,message,receipt:next.operation});
  return snapshot!;
}
async function send(operation:PendingOperation,scope:ReturnType<typeof requestScope>,recovering:boolean) {
  // Persist the unknown state BEFORE the network call, including page termination.
  await markOperationUnknown(operation.scope,operation.command.requestId);
  if(!sameScope(scope))throw new Error("身份已变化，请重新打开资料。");
  operation={...operation,phase:"unknown"};
  recoveryUpdate({busy:true,pending:operation,message:"正在提交…"});
  try {
    const {response,data}=await request("/api/backend/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(operation.command)});
    if(!sameScope(scope))throw new Error("身份已变化，请重新打开资料。");
    if(redirectIdentity(response.status,data.code))throw new Error("登录身份已变化，请重新登录后核对原提交。");
    if(!response.ok){
      if(response.status<500 && (!recovering || response.status===410))await forgetOperation(operation.scope,operation.command.requestId);
      if(response.status===409 || response.status===403)await refreshBackend().catch(()=>{});
      throw new Error(data.message||"提交未完成，请核对。");
    }
    return await complete(operation,data as BackendSnapshot,scope);
  } catch(error){
    if(sameScope(scope)){
      const pending=await pendingOperation(operation.scope).catch(()=>operation);
      if(sameScope(scope))recoveryUpdate({busy:false,pending:pending??null,message:pending?"提交结果待核对，请处理原提交，勿重复新建。":error instanceof Error?error.message:"保存被拒绝，输入已保留。"});
    }
    throw new Error(error instanceof Error && error.name!=="TypeError" && error.name!=="AbortError"?error.message:"连接中断或超时，提交结果待核对，输入已保留。");
  }
}
export async function backendCommand(kind:string,payload:unknown,requestId=crypto.randomUUID()) {
  const previous=snapshot;if(!previous)throw new Error("后台资料尚未载入，请稍后重试。");
  if(writing)throw new Error("另一个提交正在处理中，请稍候核对结果。");
  const scope=requestScope();
  const command:BackendCommand=JSON.parse(JSON.stringify({kind,payload,requestId,storeId:previous.storeId,memberId:previous.staff.currentId}));
  const operation:PendingOperation={scope:memberScope(previous),command,phase:"prepared",createdAt:Date.now()};
  writing=true;operationGeneration++;
  try {
    await reserveOperation(operation);
    if(!sameScope(scope))throw new Error("身份已变化，请重新打开资料。");
    recoveryUpdate({busy:false,pending:operation,message:"提交内容已保存在此设备，等待发送。"});
    if(typeof navigator!=="undefined" && !navigator.onLine)throw new Error("当前离线，提交内容已保存在此设备；联网后请核对并重试原提交。");
    return await send(operation,scope,false);
  } finally {writing=false;if(sameScope(scope))void loadRecovery();}
}
export async function recoverOperation(action:"check"|"retry"|"cancel") {
  if(writing || !snapshot)return;
  writing=true;operationGeneration++;const scope=requestScope();const key=memberScope(snapshot);
  try {
    const operation=await pendingOperation(key);if(!operation || !sameScope(scope))return;
    recoveryUpdate({busy:true,pending:operation,message:action==="cancel"?"正在核对并撤销未完成提交…":"正在核对原提交…"});
    const args={storeId:operation.command.storeId,memberId:operation.command.memberId,requestId:operation.command.requestId};
    const url="/api/backend/operation";
    const {response,data}=await request(action==="cancel"?url:`${url}?${new URLSearchParams(args)}`,action==="cancel"?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(args)}:undefined);
    if(!sameScope(scope))return;
    if(redirectIdentity(response.status,data.code))return;
    if(!response.ok)throw new Error(data.message||"暂时无法核对原提交。");
    if(data.status==="committed"){await complete(operation,data.snapshot,scope);return;}
    if(data.status==="cancelled"){
      await forgetOperation(key,operation.command.requestId);
      if(!sameScope(scope))return;
      recoveryUpdate({busy:false,pending:null,message:"此提交已撤销，服务器不会再执行它；输入草稿仍可重新核对。"});return;
    }
    if(action==="retry"){await send(operation,scope,true);return;}
    recoveryUpdate({busy:false,pending:operation,message:"尚未找到回执，原请求仍可能在处理。可重试原提交，或安全撤销后重新核对。"});
  } catch(error){if(sameScope(scope))recoveryUpdate({...recovery,busy:false,message:error instanceof Error?error.message:"暂时无法核对，请保持原提交。"});}
  finally {writing=false;if(sameScope(scope) && recovery.busy)recoveryUpdate({...recovery,busy:false});}
}
