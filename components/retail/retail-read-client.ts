"use client";
import type{BackendReadScope}from'@/lib/backend/read-plan';
import{requestScopedList}from'@/lib/backend/scoped-read-client';
import{retailFacetQuery,type RetailListQuery,type RetailListPage,type RetailFacetQuery,type RetailFacetPage}from'@/lib/backend/retail-list-contract';
import type{RetailScanQuery,RetailScanPage}from'@/lib/backend/retail-scan-contract';
export async function requestRetailList(scope:BackendReadScope,query:RetailListQuery,options:{cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal}={}){
 const params=new URLSearchParams(Object.entries(query).map(([key,value])=>[key,String(value)]));
 for(const key of['cursor','known','anchor']as const)if(options[key])params.set(key,options[key]!);if(options.seek!==undefined)params.set('seek',String(options.seek));
 const value=await requestScopedList(scope,'/api/backend/v2/retail?'+params,options);
 if(!value.unchanged&&(value.formatVersion!==1||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>50))throw new Error('后台资料暂不可用。');
 return value as RetailListPage|{unchanged:true;stateToken:string};
}
export async function requestRetailFacets(scope:BackendReadScope,raw:RetailFacetQuery,options:{signal?:AbortSignal}={}){
 const query=retailFacetQuery(raw);
 const value=await requestScopedList(scope,'/api/backend/v2/retail/facets?'+new URLSearchParams(query),options);
 if(value.formatVersion!==1||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>12)throw new Error('后台资料暂不可用。');
 return value as RetailFacetPage;
}
export async function requestRetailScan(scope:BackendReadScope,query:RetailScanQuery,options:{cursor?:string;seek?:number;signal?:AbortSignal}={}){
 const params=new URLSearchParams({raw:JSON.stringify(query)});if(options.cursor)params.set('cursor',options.cursor);if(options.seek!==undefined)params.set('seek',String(options.seek));
 const value=await requestScopedList(scope,'/api/backend/v2/retail/scan?'+params,options);
 if(value.formatVersion!==1||JSON.stringify(value.query)!==JSON.stringify(query)||value.items.length>50)throw new Error('后台资料暂不可用。');
 return value as RetailScanPage;
}
