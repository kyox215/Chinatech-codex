"use client";
import {useContext,useEffect,useEffectEvent,useRef,useState,useSyncExternalStore} from "react";
import {BackendSnapshotContext,useBackendState} from "@/components/backend-snapshot";
import {createBackendEntitySource} from "@/lib/backend/entity-source";
import {requestBackendEntityPage} from "@/lib/backend/page-read-client";
import {backendRecovery,subscribeRecovery} from "@/lib/backend/client";
import {useActivityFeedback} from "@/components/operation-feedback";
import {useLanguage} from "@/components/language-provider";
import {ReadFailure} from "@/components/page-recovery";
import {ProcurementProvider} from "@/components/procurement/procurement-provider";
import {RepairProcurementDialog} from "@/components/procurement/repair-procurement-shortcut";
import {useRepairDirectory} from "./local-intake-store";
import {RepairStageDialog} from "./repair-stage-control";
import {RepairContactDialog} from "./repair-contact-control";
import type {BackendSnapshot} from "@/lib/backend/contracts";
export type RepairOperationKind="stage"|"contact"|"parts";

/** Owner sits outside every row, group and window. Only this target's real
 * operation facts are provided to the original dialogs and domain providers. */
export function RepairEntityOperation({id,kind,onClose,onParts,onSaved,onPending}:{id:string;kind:RepairOperationKind;onClose:()=>void;onParts:()=>void;onSaved:(snapshot:BackendSnapshot|null,error:string)=>void;onPending?:(pending:boolean)=>void}) {
 const parent=useContext(BackendSnapshotContext),backend=useBackendState();
 if(!parent)throw new Error("后台资料暂不可用。");
 const [controller]=useState(()=>createBackendEntitySource(parent,{kind:"repair-operation",id,purpose:kind},requestBackendEntityPage));
 const state=useSyncExternalStore(controller.source.subscribe,controller.status,controller.status),snapshot=controller.source.read(),notified=useRef(false),closing=useRef(false),ownedReceipt=useRef<string|null>(null);
 const pendingChanged=useEffectEvent((pending:boolean)=>onPending?.(pending));
 useActivityFeedback(state.pending,{kind:"read"});
 useEffect(()=>{pendingChanged(state.pending);return()=>pendingChanged(false);},[state.pending]);
 useEffect(()=>{controller.activate();void controller.refresh().catch(()=>{});return()=>controller.dispose();},[controller]);
 useEffect(()=>{
  let previous=backendRecovery().receipt?.requestId;
  return subscribeRecovery(()=>{const receipt=backendRecovery().receipt;if(!receipt||receipt.requestId===previous)return;previous=receipt.requestId;if(receipt.kind.startsWith("repair.")||receipt.kind.startsWith("procurement"))void controller.source.refreshAfterCommand?.();});
 },[controller]);
 if(!backend.snapshot?.read||!controller.source.isActive())return null;
 function saved(){if(notified.current)return;notified.current=true;onSaved(controller.status().error?null:controller.source.read(),controller.status().error);}
 async function close(){
  if(closing.current)return;closing.current=true;
  try{if(!notified.current&&ownedReceipt.current){await controller.source.refreshAfterCommand?.();saved();}onClose();}finally{closing.current=false;}
 }
 const readFailure=state.error?<ReadFailure message={state.error} pending={state.pending} onRetry={()=>void controller.refresh().catch(()=>{})}/>:null;
 return <>{!snapshot?readFailure:null}{snapshot?<BackendSnapshotContext.Provider value={controller.source}><ProcurementProvider><RepairEntityDialog id={id} kind={kind} onClose={()=>void close()} onParts={onParts} onSaved={saved} onConfirmed={requestId=>{if(controller.source.read())ownedReceipt.current=requestId;}} readFailure={readFailure}/></ProcurementProvider></BackendSnapshotContext.Provider>:null}</>;
}
function RepairEntityDialog({id,kind,onClose,onParts,onSaved,onConfirmed,readFailure}:{id:string;kind:RepairOperationKind;onClose:()=>void;onParts:()=>void;onSaved:()=>void;onConfirmed:(requestId:string)=>void;readFailure:React.ReactNode}) {
 const {t}=useLanguage();
 const order=useRepairDirectory().find(row=>row.id===id);
 if(!order)return <ReadFailure message={t("关联工单不存在。")}/>;
 return kind==="stage"?<RepairStageDialog order={order} readFailure={readFailure} onSaved={onSaved} onOrder={onParts} onClose={onClose}/>:kind==="contact"?<RepairContactDialog order={order} readFailure={readFailure} onSaved={onSaved} onClose={onClose}/>:<RepairProcurementDialog repairId={id} onClose={onClose} onConfirmed={onConfirmed} readFailure={readFailure}/>;
}
