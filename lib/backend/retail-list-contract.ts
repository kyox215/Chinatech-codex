import type{BackendReadScope}from'./read-plan';
import type{RetailUnit}from'../retail';
import{defaultRetailListSort,resolveRetailListSort,type RetailView,type RetailListSort}from'../retail-list-model';
import{listSearchInput}from'./list-search';
export const retailReadVersionChangedCode='READ_VERSION_CHANGED';
export type RetailListQuery={view:RetailView;q:string;condition:'all'|'新机'|'翻新机';category:string;status:string;review:boolean;sort:RetailListSort};
export type RetailSpecificationFacts=Pick<RetailUnit,'category'|'ramGb'|'bodyStorage'|'disks'|'edition'>;
export type RetailListSummary={key:string;id:string;source:'unit'|'history';view:RetailView;code:string;title:string;condition:'新机'|'翻新机';category:string;color:string|null;specification:string|null;specificationFacts:RetailSpecificationFacts|null;identifier:string|null;phone:string|null;intakeDate:string;pickupDate:string|null;saleSortDate:string|null;priceCents:number|null;salePriceCents:number|null;status:string;reviewCount:number;previews?:string[]};
export type RetailListPage={formatVersion:1;scope:BackendReadScope;generation:string;query:RetailListQuery;stateToken:string;total:number;viewCounts:Record<RetailView,number>;conditionCounts:{all:number;新机:number;翻新机:number};selectedFacets?:{category?:RetailFacet;status?:RetailFacet};items:RetailListSummary[];startIndex:number;previousCursor:string|null;nextCursor:string|null;windowBatches?:{startIndex:number;size:number}[];windowExtent?:number};
export type RetailFacetQuery={view:RetailView;kind:'category'|'status';q:string;key:string};
export type RetailFacet={key:string;label:string;preview:boolean;count:number};
export type RetailFacetPage={formatVersion:1;scope:BackendReadScope;generation:string;query:RetailFacetQuery;stateToken:string;total:number;items:RetailFacet[]};
const facetKey=(value:unknown):value is string=>typeof value==='string'&&(value==='all'||/^[0-9a-f]{64}$/.test(value));
export function retailListQuery(raw:Partial<RetailListQuery>={}):RetailListQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['view','q','condition','category','status','review','sort'].includes(key)))throw new Error('请求资料无效。');
 const{view='available',q='',condition='all',category='all',status='all',review=false,sort=defaultRetailListSort(view)}=raw;
 if(!['available','sold','other'].includes(view)||!['all','新机','翻新机'].includes(condition)||!facetKey(category)||!facetKey(status)||typeof review!=='boolean'||resolveRetailListSort(view,sort)!==sort)throw new Error('请求资料无效。');
 return{view,q:listSearchInput(q),condition,category,status:view==='other'?status:'all',review,sort};
}
export function retailFacetQuery(raw:Partial<RetailFacetQuery>={}):RetailFacetQuery{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['view','kind','q','key'].includes(key)))throw new Error('请求资料无效。');
 const{view='available',kind='category',q='',key='all'}=raw;
 if(!['available','sold','other'].includes(view)||!['category','status'].includes(kind)||!facetKey(key))throw new Error('请求资料无效。');
 return{view,kind,q:listSearchInput(q),key};
}
export function retailListCursor(token:string,key:string,direction:'before'|'after'){
 const bytes=new TextEncoder().encode(JSON.stringify([token,key,direction]));
 return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
