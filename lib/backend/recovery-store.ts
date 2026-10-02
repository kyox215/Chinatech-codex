"use client";
import type { BackendCommand, BackendSnapshot } from "./contracts";

export type PendingOperation = { scope: string; command: BackendCommand; phase: "prepared" | "unknown"; createdAt: number };
export type DeviceDraft<T = unknown> = { id: string; scope: string; form: string; version: 1; updatedAt: number; data: T };
export function memberScope(state: BackendSnapshot) { return `${state.storeId}:${state.staff.currentId}`; }
export function draftScope(state: BackendSnapshot) {
  const member = state.staff.members.find(row => row.id === state.staff.currentId);
  return `${memberScope(state)}:${JSON.stringify([member?.accountStatus,member?.membershipStatus,[...(member?.permissions??[])].sort()])}`;
}

// Never store credentials or a server snapshot here. Only explicit input and the
// exact confirmed operation are device recovery data; the server remains authoritative.
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("此浏览器不能保存恢复资料，请启用本站存储。")); return; }
    const request=indexedDB.open("chinatech-device-recovery",2);
    let expired=false;
    const timer=setTimeout(()=>{expired=true;reject(new Error("设备存储未响应，请保持页面打开后重试。"));},4000);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains("operations"))request.result.createObjectStore("operations",{keyPath:"scope"});
      const drafts=request.result.objectStoreNames.contains("drafts")?request.transaction!.objectStore("drafts"):request.result.createObjectStore("drafts",{keyPath:"id"});
      if(!drafts.indexNames.contains("scope_form"))drafts.createIndex("scope_form",["scope","form"]);
    };
    request.onerror=()=>{clearTimeout(timer);reject(new Error("设备恢复资料无法读取，原资料未被覆盖。"));};
    request.onsuccess=()=>{clearTimeout(timer);if(expired) request.result.close();else resolve(request.result);};
  });
}
async function transaction<T>(name:"operations"|"drafts",mode:IDBTransactionMode,run:(store:IDBObjectStore,finish:(result:T)=>void,fail:(error:Error)=>void)=>void):Promise<T> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode);let result:T;let failure:Error|undefined;
    const timer=setTimeout(()=>{failure=new Error("设备存储超时，请保持页面打开。 ");tx.abort();},4000);
    const close=()=>{clearTimeout(timer);db.close();};
    tx.oncomplete=()=>{close();resolve(result);};
    tx.onabort=tx.onerror=()=>{close();reject(failure??new Error("设备存储失败或空间不足，恢复资料尚未保存。"));};
    try {run(tx.objectStore(name),value=>{result=value;},error=>{failure=error;tx.abort();});}
    catch(error){failure=error instanceof Error?error:new Error("恢复资料格式无效。");tx.abort();}
  });
}
export function pendingOperation(scope:string) {return transaction<PendingOperation|undefined>("operations","readonly",(store,finish)=>{const r=store.get(scope);r.onsuccess=()=>finish(r.result);});}
export function reserveOperation(operation:PendingOperation) {
  return transaction<void>("operations","readwrite",(store,finish,fail)=>{
    const r=store.get(operation.scope);
    r.onsuccess=()=>{if(r.result){fail(new Error("此账号在本设备还有待核对的提交，请先处理页面上的提交恢复提示。"));return;}store.add(operation);finish();};
  });
}
export function forgetOperation(scope:string,requestId:string) {return transaction<void>("operations","readwrite",(store,finish)=>{const r=store.get(scope);r.onsuccess=()=>{if(r.result?.command.requestId===requestId)store.delete(scope);finish();};});}
export function markOperationUnknown(scope:string,requestId:string) {return transaction<void>("operations","readwrite",(store,finish)=>{const r=store.get(scope);r.onsuccess=()=>{if(r.result?.command.requestId===requestId)store.put({...r.result,phase:"unknown"});finish();};});}
export function saveDeviceDraft(draft:DeviceDraft) {return transaction<void>("drafts","readwrite",(store,finish)=>{store.put(draft);finish();});}
export function removeDeviceDraft(id:string) {return transaction<void>("drafts","readwrite",(store,finish)=>{store.delete(id);finish();});}
export function listDeviceDrafts<T>(scope:string,form:string) {return transaction<DeviceDraft<T>[]>("drafts","readonly",(store,finish)=>{const r=store.index("scope_form").getAll([scope,form]);r.onsuccess=()=>finish((r.result as DeviceDraft<T>[]).filter(d=>d.version===1).sort((a,b)=>b.updatedAt-a.updatedAt));});}
