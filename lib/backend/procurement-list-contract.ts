import type { BackendReadScope } from "./read-plan";
import type { ProcurementStatus } from "../procurement";
export type ProcurementListQuery={q:string;filter:"all"|"draft"|"open"|"complete";repairId:string;groupBy:"status"|"supplier"|"repair"|"none"};
export type ProcurementListSummary={id:string;repairId:string;repairModel:string|null;item:string;supplier:string;quantity:number;arrived:number;status:ProcurementStatus;expectedAt:string;ledgerRevision:number;groupKey:string;groupFirst:string;groupCount:number};
export type ProcurementListPage={formatVersion:1;scope:BackendReadScope;generation:string;query:ProcurementListQuery;stateToken:string;total:number;groupTotal:number;stats:{all:number;draft:number;open:number;complete:number};items:ProcurementListSummary[];startIndex:number;previousCursor:string|null;nextCursor:string|null};
export const procurementReadVersionChangedCode="READ_VERSION_CHANGED";
export function procurementListQuery(raw:Partial<ProcurementListQuery>={}):ProcurementListQuery {
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(key=>!["q","filter","repairId","groupBy"].includes(key)))throw new Error("请求资料无效。");
 const {q="",filter="all",repairId="",groupBy="supplier"}=raw;
 if(typeof q!=="string"||q.length>160||typeof repairId!=="string"||repairId.length>100||!["all","draft","open","complete"].includes(filter)||!["status","supplier","repair","none"].includes(groupBy))throw new Error("请求资料无效。");
 return{q:q.trim().toLowerCase(),filter,repairId,groupBy};
}
export function procurementCursor(token:string,row:Pick<ProcurementListSummary,"id"|"groupFirst">,direction:"before"|"after") {
 const bytes=new TextEncoder().encode(JSON.stringify([token,row.groupFirst,row.id,direction]));
 return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join("")).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
