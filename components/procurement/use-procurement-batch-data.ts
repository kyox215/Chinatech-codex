"use client";
import {useEffect,useEffectEvent,useLayoutEffect,useRef,useState} from "react";
import {useBackendState} from "@/components/backend-snapshot";
import {backendScopeKey} from "@/lib/backend/read-plan";
import type {ProcurementBatchPage,ProcurementBatchRow,ProcurementSupplierCandidate} from "@/lib/backend/procurement-batch-contract";
import {requestProcurementBatch} from "./procurement-read-client";
export type ProcurementBatchData={supplierId:string;setSupplierQuery:(query:string)=>void;setSupplierId:(id:string)=>void;suppliers:ProcurementSupplierCandidate[];supplier:ProcurementSupplierCandidate|null;rows:ProcurementBatchRow[];startIndex:number;total:number;eligible:number;unresolved:number;pending:boolean;ready:boolean;error:string;hasMore:boolean;loadMore:()=>void;seek:(index:number)=>void;retry:()=>void;selectFirst:()=>Promise<ProcurementBatchRow[]>;readChosen:(ids:string[])=>Promise<ProcurementBatchRow[]>;resetKey:string;version?:string};
export function useFormalProcurementBatchData(repairId=""):ProcurementBatchData {
 const backend=useBackendState(),scope=backend.snapshot?.read?.scope,key=scope?backendScopeKey(scope):"";
 const [supplierId,setSupplierId]=useState(""),[supplierQuery,setSupplierQuery]=useState(""),[supplierState,setSuppliers]=useState<{key:string;scope:string;repairId:string;page:ProcurementBatchPage}|null>(null),[state,setState]=useState<{key:string;page:ProcurementBatchPage;rows:ProcurementBatchRow[];startIndex:number}|null>(null),[pending,setPending]=useState(false),[supplierPending,setSupplierPending]=useState(false),[retryGeneration,setRetryGeneration]=useState(0),[error,setError]=useState("");
 const latest=useRef({key,supplierId,repairId}),flight=useRef<AbortController|null>(null);useLayoutEffect(()=>{latest.current={key,supplierId,repairId};},[key,supplierId,repairId]);
 const currentKey=JSON.stringify([key,supplierId,repairId]),visible=state?.key===currentKey?state:null,suppliers=supplierState?.key===JSON.stringify([key,repairId,supplierQuery])?supplierState.page:null,summary=supplierState?.scope===key&&supplierState.repairId===repairId?supplierState.page:null;
 async function read(id:string,cursor?:string,ids?:string[],signal?:AbortSignal,seek?:number) {
  if(!scope)throw new Error("后台资料暂不可用。");
  const value=await requestProcurementBatch(scope,{kind:"rows",q:"",repairId,supplierId:id},{cursor,ids,signal,seek});if(!("stateToken" in value))throw new Error("后台资料暂不可用。");return value;
 }
 async function load(append=false,seek?:number) {
  if(!scope||!supplierId||flight.current||append&&!visible?.page.nextCursor)return;
  const expected=currentKey,controller=new AbortController();flight.current=controller;setPending(true);setError("");
  try{const page=await read(supplierId,append?visible?.page.nextCursor??undefined:undefined,undefined,controller.signal,seek);if(JSON.stringify([latest.current.key,latest.current.supplierId,latest.current.repairId])!==expected)return;
   const all=append&&visible?[...visible.rows,...page.items]:page.items,dropped=Math.max(0,all.length-500);setState({key:expected,page,rows:all.slice(-500),startIndex:append?(visible?.startIndex??0)+dropped:page.startIndex});
  }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"后台资料暂不可用。");}finally{if(flight.current===controller){flight.current=null;setPending(false);}}
 }
 useEffect(()=>{
  if(!scope)return;const controller=new AbortController();let live=true;
  const timer=setTimeout(()=>{setSupplierPending(true);void requestProcurementBatch(scope,{kind:"suppliers",q:supplierQuery.trim().toLowerCase().slice(0,160),repairId,supplierId:""},{signal:controller.signal}).then(page=>{if(live&&"stateToken" in page){setSuppliers({key:JSON.stringify([key,repairId,supplierQuery]),scope:key,repairId,page});setError("");}}).catch(reason=>{if(live&&!controller.signal.aborted)setError(reason instanceof Error?reason.message:"后台资料暂不可用。");}).finally(()=>{if(live)setSupplierPending(false);});},150);
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[scope,key,repairId,supplierQuery,retryGeneration]);
 const readCurrent=useEffectEvent(()=>{if(supplierId)void load();});
 useEffect(()=>{flight.current?.abort();flight.current=null;const timer=setTimeout(()=>readCurrent(),0);return()=>{clearTimeout(timer);flight.current?.abort();flight.current=null;};},[currentKey]); // A supplier/scope change owns a new read lifetime.
 return {supplierId,setSupplierId,setSupplierQuery,suppliers:suppliers?.suppliers??[],supplier:visible?.page.supplier??null,rows:visible?.rows??[],startIndex:visible?.startIndex??0,total:visible?.page.total??0,eligible:summary?.eligible??0,unresolved:summary?.unresolved??0,ready:Boolean(summary),pending:pending||supplierPending,error,hasMore:Boolean(visible?.page.nextCursor),loadMore:()=>void load(true),seek:index=>void load(false,index),retry:()=>{setRetryGeneration(current=>current+1);void load();},resetKey:currentKey,version:visible?.page.stateToken,
  selectFirst:async()=>{const first=await read(supplierId);if(!first.nextCursor)return first.items;const second=await read(supplierId,first.nextCursor);return [...first.items,...second.items].slice(0,100);},
  readChosen:async ids=>(await read(supplierId,undefined,ids)).items};
}
