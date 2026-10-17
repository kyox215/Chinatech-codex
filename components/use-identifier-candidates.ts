"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {useActivityFeedback} from "./operation-feedback";
import {backendScopeKey,type BackendReadScope} from "@/lib/backend/read-plan";
import {requestScopedList} from "@/lib/backend/scoped-read-client";
type CandidatePage<T>={raw:string;scope:BackendReadScope;generation:string;stateToken:string;startIndex:number;total:number;items:T[];nextCursor:string|null};
const versionChangedCode="READ_VERSION_CHANGED";
/** Scoped, sequential identifier results; at most ten 50-row batches in memory. */
export function useIdentifierCandidates<T extends {id:string}>(scope:BackendReadScope|undefined,path:string,raw:string,revision:number,pageSize=50){
 const scopeKey=scope?backendScopeKey(scope):"",key=JSON.stringify([scopeKey,path,raw]);
 const [data,setData]=useState<{key:string;page:CandidatePage<T>;extent:number}|null>(null),[status,setStatus]=useState({key,pending:false,error:""});
 const current=useRef(data),latest=useRef({scope,key,raw,path,pageSize}),flight=useRef<AbortController|null>(null),loadRef=useRef<(mode?:"after"|"seek",position?:number)=>Promise<void>>(async()=>{});
 const visible=data?.key===key&&scope?data:null;
 const load=useCallback(async(mode?:"after"|"seek",position?:number)=>{
  const expected=latest.current,previous=current.current?.key===expected.key?current.current:null;
  if(!expected.scope||flight.current||mode==="after"&&!previous?.page.nextCursor)return;
  const controller=new AbortController();flight.current=controller;
  const live=()=>flight.current===controller&&!controller.signal.aborted&&latest.current.key===expected.key;
  const read=async(cursor?:string,seek?:number)=>{
   const params=new URLSearchParams({raw:expected.raw});if(cursor)params.set("cursor",cursor);if(seek!==undefined)params.set("seek",String(seek));
   const value=await requestScopedList(expected.scope!,expected.path+"?"+params,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   if(value.raw!==expected.raw||value.items.length>expected.pageSize||!Number.isSafeInteger(value.total)||value.total<0||!Number.isSafeInteger(value.startIndex)||value.startIndex<0||typeof value.stateToken!=="string")throw new Error("后台资料暂不可用。");
   return value as CandidatePage<T>;
  };
  setStatus({key:expected.key,pending:true,error:""});
  try{
   let page=await read(mode==="after"?previous!.page.nextCursor!:undefined,mode==="seek"?position:mode?undefined:previous?.page.startIndex);
   if(!live())return;
   if(mode==="after"&&previous){
    if(page.stateToken!==previous.page.stateToken)throw Object.assign(new Error("资料已更新，请刷新后重试。"),{code:versionChangedCode});
    const items=[...previous.page.items,...page.items],dropped=Math.max(0,items.length-500);
    page={...page,startIndex:previous.page.startIndex+dropped,items:items.slice(-500)};
   }else if(!mode&&previous){
    const target=Math.min(500,previous.page.items.length);
    while(live()&&page.items.length<target&&page.nextCursor){const next=await read(page.nextCursor);if(next.stateToken!==page.stateToken)throw Object.assign(new Error("资料已更新，请刷新后重试。"),{code:versionChangedCode});page={...next,startIndex:page.startIndex,items:[...page.items,...next.items]};}
   }
   if(live()){const next={key:expected.key,page,extent:Math.max(previous?.extent??0,page.startIndex+page.items.length)};current.current=next;setData(next);}
  }catch(reason){if(live()){if(mode&&reason instanceof Error&&"code"in reason&&reason.code==="READ_VERSION_CHANGED"){flight.current=null;void loadRef.current();return;}setStatus({key:expected.key,pending:false,error:reason instanceof Error?reason.message:"后台资料暂不可用。"});}}
  finally{if(flight.current===controller){flight.current=null;if(live()||!controller.signal.aborted&&latest.current.key===expected.key)setStatus(previous=>previous.key===expected.key?{...previous,pending:false}:previous);}}
 },[]);
 useLayoutEffect(()=>{latest.current={scope,key,raw,path,pageSize};current.current=visible;loadRef.current=load;},[scope,key,raw,path,pageSize,visible,load]);
 useEffect(()=>{flight.current?.abort();flight.current=null;if(!scopeKey)return;void loadRef.current();return()=>{flight.current?.abort();flight.current=null;};},[scopeKey,key,revision]);
 const pending=status.key===key&&status.pending,error=status.key===key?status.error:"";
 useActivityFeedback(pending,{kind:"read"});
 return{page:visible?.page??null,extent:visible?.extent??0,pending,error,key,loadMore:()=>void load("after"),seek:(position:number)=>void load("seek",position),retry:()=>void load()};
}
