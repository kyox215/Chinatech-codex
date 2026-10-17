"use client";
import{useEffect,useEffectEvent,useMemo,useRef}from'react';
import{useBackendState}from'@/components/backend-snapshot';
import{useSummaryListPage}from'@/components/use-summary-list-page';
import{requestScopedList}from'@/lib/backend/scoped-read-client';
import{backendScopeKey,type BackendReadScope}from'@/lib/backend/read-plan';
import{mergeSummaryBatches}from'@/lib/backend/summary-window';
import{settingsSectionFormat,settingsSectionQuery,type SettingsSectionQuery,type SettingsSectionPage,type SettingsSectionItem}from'@/lib/backend/settings-section-contract';
import{settingsSectionResponse}from'@/lib/backend/settings-section-client';
type Row={id:string;value:SettingsSectionItem};type Page=Omit<SettingsSectionPage,'items'>&{items:Row[]};
const rowKey=(row:Row)=>row.id;
function wrap(page:SettingsSectionPage):Page{return{...page,items:page.items.map(value=>({id:page.query.kind==='association'&&'key'in value?String(value.key):'id'in value?String(value.id):page.query.kind,value}))};}
function merge(current:Page,incoming:Page,direction:'before'|'after'):Page{
 if(current.stateToken!==incoming.stateToken||current.formatVersion!==incoming.formatVersion||backendScopeKey(current.scope)!==backendScopeKey(incoming.scope)||JSON.stringify(current.query)!==JSON.stringify(incoming.query))throw new Error('资料已更新，请刷新后重试。');
 const window=mergeSummaryBatches(current,incoming,direction),cursor=(offset:number,side:'before'|'after')=>btoa(JSON.stringify([incoming.stateToken,offset,side])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 return{...incoming,...window,previousCursor:window.startIndex>0?cursor(window.startIndex,'before'):null,nextCursor:window.startIndex+window.items.length<incoming.total?cursor(window.startIndex+window.items.length,'after'):null};
}
export async function requestSettingsSection(scope:BackendReadScope,query:SettingsSectionQuery,options:{cursor?:string;known?:string;anchor?:string;seek?:number;signal?:AbortSignal}={}){
 const params=new URLSearchParams(query);for(const key of['cursor','known','anchor']as const)if(options[key])params.set(key,options[key]!);if(options.seek!==undefined)params.set('seek',String(options.seek));
 const value=settingsSectionResponse(await requestScopedList(scope,'/api/backend/v2/settings?'+params,options),scope,query,options.known);
 return 'unchanged'in value?value:wrap(value);
}
export function useSettingsSection(raw:Partial<SettingsSectionQuery>&{kind:SettingsSectionQuery['kind']},enabled=true){
 const backend=useBackendState(),{kind,q,filter,key,id}=raw,invalidQuery=(q?.length??0)>160,query=useMemo(()=>settingsSectionQuery({kind,q:invalidQuery?'':q,filter,key,id}),[kind,q,filter,key,id,invalidQuery]),scope=enabled&&backend.snapshot?.settingsSectionsEnabled?backend.snapshot.read?.scope:undefined,first=backend.snapshot?.settingsSection;
 const initial=useMemo(()=>first&&scope&&backendScopeKey(first.scope)===backendScopeKey(scope)&&JSON.stringify(first.query)===JSON.stringify(query)?wrap(first):undefined,[first,scope,query]);
 const current=useSummaryListPage<SettingsSectionQuery,Row,Page>({scope,query,initial,invalidQuery,formatVersion:settingsSectionFormat,rowKey,request:requestSettingsSection,merge});
 const page=useMemo(()=>current.page?{...current.page,items:current.page.items.map(row=>row.value)}:null,[current.page]);
 return{...current,page};
}
export function useSettingsRefresh(retry:()=>void){const revision=useBackendState().snapshot?.revision,previous=useRef(revision),refresh=useEffectEvent(retry);useEffect(()=>{if(previous.current!==revision){previous.current=revision;refresh();}},[revision]);}
