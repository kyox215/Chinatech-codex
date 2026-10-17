import type {RepairPartsGroup} from "../procurement";
import {repairStatusOptions,type RepairStatus} from "../repair-status";
import type {RepairTone} from "../repair-fixtures";
import type {BackendReadScope} from "./read-plan";
import {listSearchInput} from "./list-search";

export type RepairListQuery={q:string;status:"all"|"including_cancelled"|"handover"|RepairStatus;view:"active"|"history"|"all";partsFilter:"all"|RepairPartsGroup;noticeFilter:"all"|"notified"|"unnotified";groupBy:"workflow"|"parts"|"none";sort:"updated"|"created"|"priority"};
export type RepairListChip={id:string;title:string;request:string;preview:boolean;preset:boolean;mode:"pending"|"parts"|"none"};
export type RepairContactFacts={ready:boolean;partsFollowup:"arrival"|"purchase"|null;legacy:boolean;pickupNotice:string;arrivalNotice:string;awaitingReply:boolean;collectedUnpaid:boolean;handedOver:boolean;handoverUnpaid:boolean;quoteOutcome:"contacted"|"unreachable"|"awaiting_reply"|null;quoteTime:string|null};
export type RepairListSummary={id:string;category:string;model:string;technician?:string;customerName:string;customerNameMissing:boolean;phone:string;priority:"紧急"|"优先"|"普通";rework:boolean;createdAt:string;updatedAt:string;stage:RepairStatus;history:boolean;workflowGroup:string;partsGroup:RepairPartsGroup;progress:{label:string;tone:RepairTone;note:string};contact:RepairContactFacts;chips:RepairListChip[];chipCount:number;suppliers:string;suppliersPreview:boolean};
export type RepairListGroup={key:string;label:string;count:number;visibleCount:number;notified:number};
export type RepairListPage={formatVersion:1;scope:BackendReadScope;generation:string;observedRevision:string;query:RepairListQuery;stateToken:string;total:number;stats:{all:number;active:number;history:number};groups:RepairListGroup[];partGroups:{key:RepairPartsGroup;label:string}[];group:string|null;items:RepairListSummary[];startIndex:number;previousCursor:string|null;nextCursor:string|null};
export type RepairReadVersion=Pick<RepairListPage,"generation"|"observedRevision"|"stateToken">;
export function repairReadVersionValid(value:RepairReadVersion){return typeof value.generation==="string"&&typeof value.observedRevision==="string"&&/^(0|[1-9]\d*)$/.test(value.generation)&&/^(0|[1-9]\d*)$/.test(value.observedRevision)&&typeof value.stateToken==="string"&&Boolean(value.stateToken);}
/** Store revision disambiguates configuration changes within one projection
 * generation. It is an ordering witness, not part of the unchanged token. */
export function repairReadVersionRelation(current:RepairReadVersion,next:RepairReadVersion):"same"|"newer"|"stale"|"inconsistent" {
 if(!repairReadVersionValid(current)||!repairReadVersionValid(next))return"inconsistent";
 const a=BigInt(current.generation),b=BigInt(next.generation),left=BigInt(current.observedRevision),right=BigInt(next.observedRevision);
 if(b<a)return"stale";
 if(b>a)return right<left||next.stateToken===current.stateToken?"inconsistent":"newer";
 if(next.stateToken===current.stateToken)return"same";
 return right>left?"newer":right<left?"stale":"inconsistent";
}
export const repairReadVersionChangedCode="READ_VERSION_CHANGED";
export function repairListQuery(raw:Partial<RepairListQuery>={}):RepairListQuery {
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(key=>!["q","status","view","partsFilter","noticeFilter","groupBy","sort"].includes(key)))throw new Error("请求资料无效。");
 const {q="",status="all",view="active",partsFilter="all",noticeFilter="all",groupBy="workflow",sort="updated"}=raw;
 if(typeof q!=="string"||q.length>160||!["all","including_cancelled","handover",...repairStatusOptions.map(row=>row.value)].includes(status)||!["active","history","all"].includes(view)||!["all","draft","cart","mixed","ordered","complete","unrecorded"].includes(partsFilter)||!["all","notified","unnotified"].includes(noticeFilter)||!["workflow","parts","none"].includes(groupBy)||!["updated","created","priority"].includes(sort))throw new Error("请求资料无效。");
 return{q:listSearchInput(q),status,view,partsFilter,noticeFilter,groupBy,sort};
}
export function repairCursor(token:string,group:string,id:string,direction:"before"|"after") {
 const bytes=new TextEncoder().encode(JSON.stringify([token,group,id,direction]));return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join("")).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
