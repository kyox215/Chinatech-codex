import{buildInfiniteListFixture}from'./infinite-list-fixture';
export function buildSettingsRecoveryFixture(){return buildInfiniteListFixture(process.cwd(),{actualIcons:true,seams:['components/backend-snapshot','components/staff/use-staff','lib/backend/client','components/page-title','components/navigation-link','components/account/login-devices','components/settings/settings-store','components/repairs/local-intake-store','components/retail/retail-provider'],adapter:String.raw`
import React,{useSyncExternalStore}from'react';
import{allPermissions}from'@/lib/staff';import{settingsSectionQuery}from'@/lib/backend/settings-section-contract';
import{draftScope,saveDeviceDraft,listDeviceDrafts}from'@/lib/backend/recovery-store';
const listeners=new Set();let epoch=1;
const member={id:'DEMO-member',name:'DEMO Owner',email:'owner@example.test',role:'owner',accountStatus:'active',membershipStatus:'active',permissions:allPermissions,revision:1};
function state(){return{revision:1,storeId:'DEMO-store-'+epoch,settingsSectionsEnabled:true,staff:{currentId:member.id,revision:1,members:[member],audit:[]},read:{scope:{formatVersion:2,accountId:'DEMO-account',sessionId:'DEMO-session-'+epoch,storeId:'DEMO-store-'+epoch,memberId:member.id,memberRevision:epoch,permissions:allPermissions}}};}
let snapshot=state();const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const api=window.settingsFixture={reads:[],commands:[],releases:[],inflight:[],completed:[],watermark:'1',malformedGeneration:false,ready:false};
export function useBackendState(){const current=useSyncExternalStore(subscribe,()=>snapshot,()=>snapshot);return{snapshot:current,formal:true,active:true};}
export const useBackendMode=()=>true;export const backendSnapshot=()=>snapshot;export const subscribeBackend=subscribe;export const isBackendClient=()=>true;export const backendReadGeneration=()=>epoch;
export function useStaff(){const{snapshot}=useBackendState();return{ready:true,error:'',data:snapshot.staff,member,can:permission=>member.permissions.includes(permission)};}
export function useBackendStore(_a,_b,_c,project,domain){const{snapshot}=useBackendState();if(domain==='settings')throw Error('Legacy full settings hook mounted');return project(snapshot);}
export function useStoreSettings(){throw Error('Legacy full settings mounted');}export const saveStoreSettings=()=>{throw Error('Legacy full settings save');};export const settingsPatchDraft=()=>{throw Error('Legacy patch adapter');};
export const useRepairDirectory=()=>{throw Error('Legacy repairs mounted');};export const useRetail=()=>{throw Error('Legacy retail mounted');};
const recovery={pending:null,receipt:null,resolution:null,busy:false,message:''};export const backendRecovery=()=>recovery;export const subscribeRecovery=()=>()=>{};export const loadRecovery=async()=>{};export const recoverOperation=async()=>{};export const clearBackend=()=>{throw Error('Unexpected identity reset');};
export const backendCommand=(kind,payload,requestId)=>{api.commands.push({kind,payload,requestId,storeId:snapshot.storeId});const promise=(async()=>{await new Promise(resolve=>api.releases.push(resolve));api.completed.push(requestId);})();api.inflight.push(promise);return promise;};
export const NavigationLink=({children,icon:Icon,iconPosition:_i,resolveHref:_r,onNavigationComplete:_c,...props})=><a {...props}>{Icon?<Icon/>:null}{children}</a>;export const PageTitle=({title})=><h1>{title}</h1>;export const LoginDevicesPanel=()=>null;
export const usePathname=()=>'/app/settings';export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({replace:()=>{},refresh:()=>{},push:()=>{throw Error('Unexpected navigation');}});
api.changeScope=()=>{epoch++;snapshot=state();listeners.forEach(fn=>fn());};api.release=async()=>{api.releases.splice(0).forEach(fn=>fn());await Promise.all(api.inflight);};
api.seedOldVoid=async()=>{const data={kind:'expense',amount:'99',purpose:'DEMO original purpose',relatedId:'DEMO repair',note:'DEMO original note',identity:'DEMO-original-entry',voidId:'DEMO-void-target',voidReason:'DEMO keep original reason'};const draft={id:'DEMO-old-void-draft',scope:draftScope(snapshot),form:'finance-entry',version:1,updatedAt:1700000000000,data};await saveDeviceDraft(draft);return draft;};api.drafts=()=>listDeviceDrafts(draftScope(snapshot),'finance-entry');
const choices=Array.from({length:61},(_,i)=>({id:'DEMO-repair-'+String(i).padStart(3,'0'),key:'repair:DEMO-repair-'+String(i).padStart(3,'0'),source:'repair',label:'DEMO association '+String(i).padStart(3,'0')+(i===60?' END-UNLOADED':''),previews:[]}));
api.fetch=async(url,options={})=>{const parsed=new URL(url,location.origin);if(parsed.pathname!=='/api/backend/v2/settings')throw Error('Unexpected request '+parsed.pathname);const query=settingsSectionQuery(Object.fromEntries(['kind','q','filter','key','id'].map(key=>[key,parsed.searchParams.get(key)??undefined]))),scope=snapshot.read.scope;api.reads.push({query,storeId:scope.storeId});if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');let items=[],total=0,startIndex=0,extras={};
if(query.kind==='general')items=[{revision:7,shopName:'DEMO shop '+epoch,address:'DEMO address',phone:'',repairWarrantyMonths:6,retailWarrantyMonths:12}];
else if(query.kind==='printing')items=[{revision:7,paper:'a5'}];
else if(query.kind==='finance'){items=[{id:'b'.repeat(64),kind:'income',amountCents:1,purpose:'DEMO existing entry',relatedId:'',note:'',time:'2026-10-17 10:00:00',previews:[]}];extras.totals={income:1,expense:0,balance:1};}
else if(query.kind==='association'){let matches=choices.filter(row=>(!query.id||row.id===query.id)&&(!query.q||row.label.toLowerCase().includes(query.q.toLowerCase())));total=matches.length;if(parsed.searchParams.has('cursor'))startIndex=50;items=matches.slice(startIndex,startIndex+50);}
else if(query.kind==='staff'){items=Array.from({length:110},(_,i)=>({...member,id:'DEMO-staff-'+i,name:'DEMO staff '+i,previews:[]})).slice(0,50);total=110;extras.auditTotal=120;}
else if(query.kind==='member')items=[{...member,id:query.id}];
else throw Error('Unexpected section '+query.kind);
if(query.kind!=='association'&&query.kind!=='staff')total=items.length;
const generation=api.malformedGeneration?'not json':JSON.stringify([api.watermark,'7','',...(query.kind==='association'?['[null,null]']:[])]),token=(query.q?'c':'a').repeat(64);
return new Response(JSON.stringify({formatVersion:1,scope,generation,stateToken:token,query,revision:7,items,total,startIndex,previousCursor:null,nextCursor:startIndex+items.length<total?'DEMO-next':null,...extras}),{headers:{'Content-Type':'application/json'}});};
`,entry:String.raw`
import React,{useEffect}from'react';import{createRoot}from'react-dom/client';import{SettingsPage}from'@/components/settings/settings-page';import{LanguageProvider,useLanguage}from'@/components/language-provider';import{ContentProgress,OperationFeedbackProvider}from'@/components/operation-feedback';import{RecoveryPresentationProvider}from'@/components/use-operation-receipt';import'virtual:adapter';
const api=window.settingsFixture;window.fetch=api.fetch;let root;
function Locale({children}){const{setLocale}=useLanguage();useEffect(()=>setLocale('zh-CN'),[setLocale]);return children;}
api.mount=(tab='general')=>{root?.unmount();root=createRoot(document.getElementById('root'));root.render(<LanguageProvider><Locale><OperationFeedbackProvider><RecoveryPresentationProvider><ContentProgress/><SettingsPage bounded initialTab={tab}/></RecoveryPresentationProvider></OperationFeedbackProvider></Locale></LanguageProvider>);};api.ready=true;
`});}
