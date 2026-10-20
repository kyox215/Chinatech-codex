"use client";
import type {BackendReadScope} from "@/lib/backend/read-plan";
import {requestScopedList} from "@/lib/backend/scoped-read-client";
import type {ProcurementListPage,ProcurementListQuery} from "@/lib/backend/procurement-list-contract";
import {procurementListResponseVersion} from "@/lib/backend/procurement-list-contract";
import type {ProcurementBatchPage,ProcurementBatchQuery,ProcurementRepairCandidate} from "@/lib/backend/procurement-batch-contract";

export {requestScopedList};
export async function requestProcurementList(scope:BackendReadScope,query:ProcurementListQuery,options:{cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal}={}) {
 const params=new URLSearchParams(query);
 for(const key of ["cursor","known","anchor"] as const)if(options[key])params.set(key,options[key]!);
 if(options.seek!==undefined)params.set("seek",String(options.seek));
 const value=await requestScopedList(scope,"/api/backend/v2/procurement?"+params,options);
 if(!value.unchanged&&(value.formatVersion!==procurementListResponseVersion||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>50))throw new Error("后台资料暂不可用。");
 return value as ProcurementListPage|{unchanged:true;stateToken:string};
}
export async function requestProcurementBatch(scope:BackendReadScope,query:ProcurementBatchQuery,options:{cursor?:string;ids?:string[];seek?:number;signal?:AbortSignal}={}) {
 const params=new URLSearchParams(query);if(options.cursor)params.set("cursor",options.cursor);
 if(options.seek!==undefined)params.set("seek",String(options.seek));
 const value=await requestScopedList(scope,"/api/backend/v2/procurement/batch?"+params,options);
 if(value.items.length>(query.kind==="repairs"?12:options.ids?100:50))throw new Error("后台资料暂不可用。");
 return value as ProcurementBatchPage|{scope:BackendReadScope;items:ProcurementRepairCandidate[]};
}
