import type {BackendSnapshot} from "./contracts";
import {backendScopeKey,pagePlanKey,type PageReadPlan} from "./read-plan";

export type BackendReadSource={read:()=>BackendSnapshot|null;server:()=>BackendSnapshot|null;subscribe:(listener:()=>void)=>()=>void;isActive:()=>boolean;hydrated?:boolean;refreshAfterCommand?:()=>Promise<BackendSnapshot|null>};
type EntityStatus={pending:boolean;error:string;revision:number};
/** A local target reader, never a second root bootstrap. It has no configure,
 * reconcile, release or global page-plan ownership. */
export function createBackendEntitySource(parent:BackendReadSource,plan:PageReadPlan,fetchPage:(plan:PageReadPlan,scope:string,known?:string)=>Promise<BackendSnapshot|{unchanged:true;stateToken:string}>) {
 const original=parent.read()?.read?.scope,scope=original?backendScopeKey(original):"";
 let value:BackendSnapshot|null=null,status:EntityStatus={pending:false,error:"",revision:0},flight:Promise<BackendSnapshot|null>|null=null,disposed=false,epoch=0;
 const listeners=new Set<()=>void>(),notify=()=>listeners.forEach(listener=>listener());
 const matches=()=>!disposed&&Boolean(scope)&&parent.read()?.read&&backendScopeKey(parent.read()!.read!.scope)===scope;
 const read=()=>matches()?value:null;
 const update=(next:Omit<EntityStatus,"revision">)=>{status={...next,revision:status.revision+1};notify();};
 async function refresh():Promise<BackendSnapshot|null>{
  if(!matches())return null;if(flight)return flight;
  const requestEpoch=epoch;update({pending:true,error:""});
  const run=(async()=>{
   try{
    const next=await Promise.resolve().then(()=>fetchPage(plan,scope,value?.stateToken));
    if(!matches()||requestEpoch!==epoch)return null;
    if("unchanged" in next){if(!value||next.stateToken!==value.stateToken)throw new Error("后台核对结果无效，请稍后重试。");}
    else{if(!next.read||backendScopeKey(next.read.scope)!==scope||pagePlanKey(next.read.plan)!==pagePlanKey(plan))throw new Error("后台核对结果无效，请稍后重试。");value=next;}
    update({pending:false,error:""});return value;
   }catch(error){if(matches()&&requestEpoch===epoch)update({pending:false,error:error instanceof Error?error.message:"后台暂时不可用，当前输入已保留。 "});throw error;}
   finally{if(requestEpoch===epoch)flight=null;}
  })();flight=run;return run;
 }
 const source:BackendReadSource={read,server:()=>null,isActive:()=>Boolean(matches()&&parent.isActive()),hydrated:true,subscribe(listener){listeners.add(listener);const stop=parent.subscribe(listener);return()=>{listeners.delete(listener);stop();};},async refreshAfterCommand(){try{return await refresh();}catch{return null;}}};
 return{source,refresh,status:()=>status,activate(){disposed=false;},dispose(){disposed=true;epoch++;value=null;flight=null;status={pending:false,error:"",revision:status.revision+1};notify();},scope};
}
