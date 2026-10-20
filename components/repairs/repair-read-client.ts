"use client";
import type {BackendReadScope} from "@/lib/backend/read-plan";
import {repairReadVersionValid,type RepairListPage,type RepairListQuery} from "@/lib/backend/repair-list-contract";
import {requestScopedList} from "@/components/procurement/procurement-read-client";
export async function requestRepairList(scope:BackendReadScope,query:RepairListQuery,options:{group?:string;cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal}={}) {
 const params=new URLSearchParams(query);
 for(const key of ["group","cursor","known","anchor"] as const)if(options[key])params.set(key,options[key]!);
 if(options.seek!==undefined)params.set("seek",String(options.seek));
 const value=await requestScopedList(scope,"/api/backend/v2/repairs?"+params,{signal:options.signal});
 if(value.unchanged&&(!options.known||value.stateToken!==options.known))throw new Error("后台核对结果无效，请稍后重试。");
 if(!value.unchanged&&(!repairReadVersionValid(value)||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>50||options.group!==undefined&&value.group!==options.group||!Array.isArray(value.groups)||!Array.isArray(value.partGroups)))throw new Error("后台资料暂不可用。");
 return value as RepairListPage|{unchanged:true;stateToken:string};
}
