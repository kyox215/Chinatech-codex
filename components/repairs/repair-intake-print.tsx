"use client";
import{useContext,useEffect,useState,useSyncExternalStore,type RefObject}from'react';
import{BackendSnapshotContext,useBackendState}from'@/components/backend-snapshot';
import{ReadFailure,ReadPending}from'@/components/page-recovery';
import{useActivityFeedback}from'@/components/operation-feedback';
import{useLanguage}from'@/components/language-provider';
import{createBackendEntitySource}from'@/lib/backend/entity-source';
import{requestBackendEntityPage}from'@/lib/backend/page-read-client';
import type{IntakeReceiptData}from'@/lib/repair-intake-record';
import{IntakeReceipt}from'./intake-receipt';
type Props={data:IntakeReceiptData;onClose:()=>void;restoreFocusRef?:RefObject<HTMLElement|null>};
export function RepairIntakePrint(props:Props){
 const backend=useBackendState();
 return backend.formal?<FormalPrint {...props}/>:<IntakeReceipt {...props}/>;
}
function FormalPrint(props:Props){
 const parent=useContext(BackendSnapshotContext),{t}=useLanguage();
 if(!parent)throw new Error('后台资料暂不可用。');
 const[controller]=useState(()=>createBackendEntitySource(parent,{kind:'repair',id:props.data.id},requestBackendEntityPage));
 const status=useSyncExternalStore(controller.source.subscribe,controller.status,controller.status),snapshot=controller.source.read();
 useActivityFeedback(status.pending,{kind:'read'});
 useEffect(()=>{controller.activate();void controller.refresh().catch(()=>{});return()=>controller.dispose();},[controller]);
 if(!controller.source.isActive())return null;
 return snapshot?<BackendSnapshotContext.Provider value={controller.source}><IntakeReceipt {...props}/></BackendSnapshotContext.Provider>:<>{status.error?<ReadFailure message={status.error} pending={status.pending} onRetry={()=>void controller.refresh().catch(()=>{})}/>:status.pending?<ReadPending label="正在读取工单…"/>:null}<button type="button" className="button button--secondary" onClick={props.onClose}>{t('返回')}</button></>;
}
