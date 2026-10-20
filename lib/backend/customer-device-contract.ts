import type{BackendReadScope}from'./read-plan';
export const customerDeviceVersionChangedCode="READ_VERSION_CHANGED";
import{listSearchInput}from'./list-search';
import{customerDeviceFormat}from'./customer-device-version';
export type CustomerDeviceQuery={kind:'devices'|'records'|'original';q:string;deviceId:string};
export type CustomerDeviceSummary={id:string;category:string;model:string;serial:string;recordCount:number;latestAt:string;previews:string[]};
export type CustomerDeviceRecordSummary={id:string;displayId:string;phone:string;time:string;type:'repair'|'sale';href:string};
export type CustomerDevicePage<Item=CustomerDeviceSummary|CustomerDeviceRecordSummary>={formatVersion:typeof customerDeviceFormat;scope:BackendReadScope;generation:string;query:CustomerDeviceQuery;stateToken:string;total:number;items:Item[];startIndex:number;previousCursor:string|null;nextCursor:string|null;windowBatches?:{startIndex:number;size:number}[];windowExtent?:number};
export function customerDeviceQuery(raw:Partial<CustomerDeviceQuery>):CustomerDeviceQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['kind','q','deviceId'].includes(key)))throw new Error('请求资料无效。');
 const{kind='devices',q='',deviceId=''}=raw;
 if(!['devices','records','original'].includes(kind)||typeof deviceId!=='string'||(kind!=='devices'?!/^[a-f0-9]{64}$/.test(deviceId):deviceId!==''))throw new Error('请求资料无效。');
 const query=listSearchInput(q);if(kind!=='devices'&&query!=='')throw new Error('请求资料无效。');
 return{kind,q:query,deviceId};
}
export function customerDeviceCursor(token:string,id:string,direction:'before'|'after'){
 const bytes=new TextEncoder().encode(JSON.stringify([token,id,direction]));return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
