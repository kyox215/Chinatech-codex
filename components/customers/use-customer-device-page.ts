"use client";
import{useBackendState}from'@/components/backend-snapshot';
import{useSummaryListPage}from'@/components/use-summary-list-page';
import{requestScopedList}from'@/lib/backend/scoped-read-client';
import{backendScopeKey}from'@/lib/backend/read-plan';
import{customerDeviceFormat}from'@/lib/backend/customer-device-version';
import{customerDeviceQuery,type CustomerDeviceQuery,type CustomerDevicePage,type CustomerDeviceSummary,type CustomerDeviceRecordSummary}from'@/lib/backend/customer-device-contract';
import{mergeCustomerDeviceWindow}from'@/lib/backend/customer-device-window';
import{can}from'@/lib/staff';
const rowKey=(row:{id:string})=>row.id;
export async function requestCustomerDevices<T extends CustomerDeviceSummary|CustomerDeviceRecordSummary>(scope:CustomerDevicePage['scope'],query:CustomerDeviceQuery,options:{cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal}={}){
 const params=new URLSearchParams(query);for(const key of['cursor','known','anchor']as const)if(options[key]&&(query.kind!=='original'||key==='known'))params.set(key,options[key]!);if(query.kind!=='original'&&options.seek!==undefined)params.set('seek',String(options.seek));
 const value=await requestScopedList(scope,'/api/backend/v2/customer-devices?'+params,options);
 if(!value.unchanged&&(value.formatVersion!==customerDeviceFormat||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>50||!Number.isSafeInteger(value.total)||value.total<0||!Number.isSafeInteger(value.startIndex)||value.startIndex<0||value.items.some((row:CustomerDeviceSummary|CustomerDeviceRecordSummary)=>typeof row.id!=='string'||(query.kind!=='records'?!('model'in row)||!Array.isArray(row.previews)||!Number.isSafeInteger(row.recordCount)||row.recordCount<1:!('href'in row)||!['repair','sale'].includes(row.type)||typeof row.phone!=='string'||typeof row.time!=='string'))))throw new Error('后台资料暂不可用。');
 return value as CustomerDevicePage<T>|{unchanged:true;stateToken:string};
}
export function useCustomerDevicePage<T extends CustomerDeviceSummary|CustomerDeviceRecordSummary>(raw:CustomerDeviceQuery,returnAnchor?:string){
 const backend=useBackendState(),member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId),scope=backend.snapshot?.customerDeviceEnabled&&(can(member,'repairs.view')||can(member,'retail.view'))?backend.snapshot.read?.scope:undefined,initial=raw.kind==='devices'&&scope&&backend.snapshot?.customerDevices&&backendScopeKey(backend.snapshot.customerDevices.scope)===backendScopeKey(scope)?backend.snapshot.customerDevices as CustomerDevicePage<T>:undefined,invalidQuery=raw.q.length>160;
 const query=customerDeviceQuery({...raw,q:invalidQuery?'':raw.q});
 return useSummaryListPage<CustomerDeviceQuery,T,CustomerDevicePage<T>>({scope,initial,query,returnAnchor,invalidQuery,formatVersion:customerDeviceFormat,rowKey,request:requestCustomerDevices<T>,merge:mergeCustomerDeviceWindow<T>});
}
