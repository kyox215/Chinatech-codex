"use client";
import{useEffect,useState}from'react';import{useBackendState}from'@/components/backend-snapshot';import{useIdentifierCandidates}from'@/components/use-identifier-candidates';import{can}from'@/lib/staff';import{requestScopedList}from'@/lib/backend/scoped-read-client';import{intakeHistoryQuery,type IntakeHistoryItem,type IntakeHistoryPage,type IntakeDraftMetadata}from'@/lib/backend/intake-lookup-contract';import{validIntakePolicy}from'@/lib/repair-intake-record';import type{BackendReadScope}from'@/lib/backend/read-plan';
export function useIntakeHistory(serial:string,brand:string,model:string,kind:'exact'|'related',enabled:boolean){
 const backend=useBackendState(),member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId);let raw='',invalid=false;
 try{raw=JSON.stringify(intakeHistoryQuery({serial,brand,model,kind}));}catch{invalid=true;}
 const[debounced,setDebounced]=useState(raw);
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(raw),150);return()=>clearTimeout(timer);},[raw]);
 const scope=enabled&&!invalid&&raw===debounced&&can(member,'repairs.view')&&(serial.trim()||brand.trim()&&model.trim())?backend.snapshot?.read?.scope:undefined;
 const result=useIdentifierCandidates<IntakeHistoryItem>(scope,'/api/backend/v2/intake-history',raw,backend.snapshot?.revision??0,kind==='related'?3:50);
 return{...result,page:result.page as IntakeHistoryPage|null,error:invalid?'请求资料无效。':result.error};
}
export async function requestIntakeDraftMetadata(scope:BackendReadScope,id:string,signal?:AbortSignal):Promise<IntakeDraftMetadata>{
 const value=await requestScopedList(scope,'/api/backend/v2/intake-draft?'+new URLSearchParams({id}),{signal}),item=value.items[0];
 if(value.items.length!==1||item.id!==id||typeof item.exists!=='boolean'||!Number.isSafeInteger(item.revision)||item.revision<0||!Number.isSafeInteger(item.signatureCount)||item.signatureCount<0||!validIntakePolicy(item.policy)||item.exists!==(item.revision>0))throw new Error('后台资料暂不可用。');
 return item;
}
