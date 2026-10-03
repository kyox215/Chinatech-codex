"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { useBackendState } from "@/lib/backend/react";
import { backendCommand } from "@/lib/backend/client";
import { ProcurementContext, RetailContext, type ProcurementAction, type ProcurementState, type RetailAction, type RetailState } from "./backend-domain-context";

type Ui={procurement:Omit<ProcurementState,"records"|"repairUpdates">;retail:Omit<RetailState,"units"|"ready"|"error">};
const defaultUi:Ui={procurement:{feedback:null,listView:{query:"",filter:"all",repairId:"",groupBy:"supplier"}},retail:{returnTo:"/app/retail",returnScroll:0,feedback:null}};
const UiContext=createContext<{ui:Ui;update:(change:(current:Ui)=>Ui)=>void}|null>(null);
export function BackendDomainsProvider({children}:{children:React.ReactNode}) {
  const parent=useContext(UiContext);const [local,setLocal]=useState(defaultUi);const ui=parent?.ui??local;const update=parent?.update??setLocal;
  const state=useBackendState();
  async function procurement(action:ProcurementAction) {
    if(action.type==="list-view"){update(current=>({...current,procurement:{...current.procurement,listView:action.view}}));return;}
    if(action.type==="clear-feedback"){update(current=>({...current,procurement:{...current.procurement,feedback:null}}));return;}
    const recordId="record" in action?action.record.id:"id" in action?action.id:"batch";
    try{if(action.type==="batch"){const {type:_type,...payload}=action;void _type;await backendCommand("procurement.batch",payload);}else await backendCommand("procurement",action);update(current=>({...current,procurement:{...current.procurement,feedback:{recordId,error:false,message:"配件事实已保存。"}}}));}
    catch(error){update(current=>({...current,procurement:{...current.procurement,feedback:{recordId,error:true,message:error instanceof Error?error.message:"保存失败。"}}}));throw error;}
  }
  async function retail(action:RetailAction) {
    if(action.type==="remember"){update(current=>({...current,retail:{...current.retail,returnTo:action.url,returnScroll:action.scroll}}));return true;}
    const id=action.type==="create"?action.unit.id:action.id;
    try{await backendCommand("retail",action.type==="create"?{type:action.type,unit:action.unit}:{type:action.type,id:action.id,command:action.command,version:action.version});update(current=>({...current,retail:{...current.retail,feedback:{id,error:false,message:"已保存并追加到历史。"}}}));return true;}
    catch(error){update(current=>({...current,retail:{...current.retail,feedback:{id,error:true,message:error instanceof Error?error.message:"保存失败。"}}}));return false;}
  }
  const repairUpdates=useMemo(()=>Object.fromEntries((state?.intakes??[]).map(row=>[row.id,row.updatedAt])),[state?.intakes]);
  return <UiContext.Provider value={{ui,update}}><ProcurementContext.Provider value={{...ui.procurement,records:state?.procurement??[],repairUpdates,dispatch:procurement}}><RetailContext.Provider value={{...ui.retail,units:state?.retail??[],ready:Boolean(state),error:state?"":"后台资料暂不可用。",dispatch:retail}}>{children}</RetailContext.Provider></ProcurementContext.Provider></UiContext.Provider>;
}
