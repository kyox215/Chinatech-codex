import type{BackendReadScope}from'./read-plan';
import type{CustomerProfile,CustomerSaleRecord}from'../customers';
import type{RepairTone}from'../repair-fixtures';
import{listSearchInput}from'./list-search';
export const customerDetailFormat=1;
export const customerRecordVersionChangedCode="READ_VERSION_CHANGED";
export const customerRecordKinds=['repairs','sales','history']as const;
export type CustomerRecordKind=typeof customerRecordKinds[number];
export type CustomerRecordsQuery={id:string;kind:CustomerRecordKind|'auto';q:string};
export type CustomerDetailProfile=CustomerProfile&{id:string;address:string;lastActivity:string};
export type CustomerRecordCounts=Record<CustomerRecordKind,number>;
type RecordIdentity={id:string;key:string;previews:string[]};
export type CustomerRepairSummary=RecordIdentity&{kind:'repairs';brand:string;model:string;createdAt:string;issue:string;faults?:string[];issueNote?:string;rework:boolean;progress:{label:string;tone:RepairTone;note:string}};
export type CustomerSaleSummary=RecordIdentity&{kind:'sales'}&Pick<CustomerSaleRecord,'unitId'|'unitCode'|'deviceName'|'time'|'priceCents'|'paidCents'|'delivered'|'customerName'|'customerEmail'|'customerAddress'|'customerNote'|'deliveryDate'|'refundedCents'|'returned'|'afterSaleCount'>;
export type CustomerHistorySummary=RecordIdentity&{kind:'history';sourceRow:number;sourceStatus:string|null;brand:string|null;model:string|null;intakeAt:string;pickupDate:string|null;salePriceCents:number|null;reviewCount:number};
export type CustomerRecordSummary=CustomerRepairSummary|CustomerSaleSummary|CustomerHistorySummary;
export type CustomerDetailPage={formatVersion:1;scope:BackendReadScope;generation:string;query:CustomerRecordsQuery&{kind:CustomerRecordKind};stateToken:string;profile:CustomerDetailProfile|null;counts:CustomerRecordCounts;total:number;items:CustomerRecordSummary[];startIndex:number;previousCursor:string|null;nextCursor:string|null;windowBatches?:{startIndex:number;size:number}[];windowExtent?:number};
export function customerRecordsQuery(raw:Partial<CustomerRecordsQuery>):CustomerRecordsQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['id','kind','q'].includes(key)))throw new Error('请求资料无效。');
 const{id='',kind='auto',q=''}=raw;if(!/^PHONE-[1-9]\d{6,14}$/.test(id)||!['auto',...customerRecordKinds].includes(kind))throw new Error('请求资料无效。');return{id,kind,q:listSearchInput(q)};
}
export function customerRecordKey(kind:CustomerRecordKind,originId:string,eventId:string){return'['+[kind,originId,eventId].map(value=>JSON.stringify(value)).join(', ')+']';}
export function customerRecordCursor(token:string,key:string,direction:'before'|'after'){const bytes=new TextEncoder().encode(JSON.stringify([token,key,direction]));return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
