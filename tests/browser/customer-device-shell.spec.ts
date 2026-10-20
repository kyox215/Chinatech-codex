import{test,expect,type Page}from'@playwright/test';
import{buildInfiniteListFixture}from'./helpers/infinite-list-fixture';
const adapter=String.raw`
import React,{useSyncExternalStore}from'react';
const listeners=new Set();let route='/app/customer-devices',permissions=['repairs.view'],flag=true;
let member={id:'DEMO-M',name:'DEMO Member',role:'viewer',revision:1,permissions,accountStatus:'active',membershipStatus:'active'};
let snapshot={customerDeviceEnabled:flag,storeId:'DEMO-STORE',read:{scope:{formatVersion:2,accountId:'DEMO-A',sessionId:'DEMO-S',storeId:'DEMO-STORE',memberId:member.id,memberRevision:1,permissions}}};
let staff={member,data:{currentId:member.id,members:[member]},ready:true,error:'',can:permission=>permissions.includes(permission)};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
const initial=()=>{snapshot={...snapshot,staff:staff.data,customerDevices:{formatVersion:1,scope:snapshot.read.scope,generation:'1',stateToken:'DEMO-'+member.revision,query:{kind:'devices',q:'',deviceId:''},total:1,startIndex:0,previousCursor:null,nextCursor:null,items:[{id:'a'.repeat(64),category:'phone',model:'DEMO physical model',serial:'DEMO-SN',recordCount:1,latestAt:'2026-10-17',previews:[]}]}};};initial();
const api=window.deviceShell={calls:[],set:(nextPermissions,nextFlag=true,nextRoute='/app/customer-devices')=>{permissions=nextPermissions;flag=nextFlag;route=nextRoute;member={...member,revision:member.revision+1,permissions};snapshot={...snapshot,customerDeviceEnabled:flag,read:{scope:{...snapshot.read.scope,memberRevision:member.revision,permissions}}};staff={...staff,member,data:{currentId:member.id,members:[member]}};initial();listeners.forEach(fn=>fn());}};
export const useBackendState=()=>({snapshot:useSyncExternalStore(subscribe,()=>snapshot,()=>snapshot),active:true});
export const useStaff=()=>useSyncExternalStore(subscribe,()=>staff,()=>staff);
export const useBackendMode=()=>true;export const usePathname=()=>route;export const useSearchParams=()=>new URLSearchParams();
export const backendSnapshot=()=>snapshot;export const subscribeBackend=subscribe;export const backendReadGeneration=()=>0;export const replaceBackendDocumentUrl=()=>{};export const clearBackend=()=>{};
export const useRepairDirectory=()=>[];export const useLocalIntakes=()=>({ready:true});export const useRetail=()=>({units:[],ready:true});
window.fetch=async url=>{const params=new URL(url,'https://fixture.invalid').searchParams,kind=params.get('kind'),query={kind,q:params.get('q')??'',deviceId:params.get('deviceId')??''};api.calls.push({kind,permissions:[...permissions]});if(kind!=='records')throw Error('Unexpected metadata read');return new Response(JSON.stringify({formatVersion:1,scope:snapshot.read.scope,generation:'1',stateToken:'DEMO-'+member.revision,query,total:1,startIndex:0,previousCursor:null,nextCursor:null,items:[{id:'DEMO-record',type:permissions.includes('repairs.view')?'repair':'sale',displayId:'DEMO-RECORD',phone:'+39000000001',time:'2026-10-17',href:permissions.includes('repairs.view')?'/app/repairs/DEMO-RECORD':'/app/retail/DEMO-UNIT'}]}),{headers:{'Content-Type':'application/json'}});};
export const NavigationLink=({children,icon,iconPosition,iconClassName,onNavigationComplete,focusTargetId,resolveHref,prefetch,...props})=>React.createElement('a',props,children);
export const selectPreviewMember=()=>{throw Error('Preview identity writes forbidden');};
export const LogoutButton=()=>React.createElement('button',null,'DEMO Logout');
`;
const entry=String.raw`
import React from'react';import{createRoot}from'react-dom/client';import{LanguageProvider}from'@/components/language-provider';import{OperationFeedbackProvider}from'@/components/operation-feedback';import{AppShell}from'@/components/dashboard/app-shell';import'virtual:adapter';
createRoot(document.getElementById('root')).render(<LanguageProvider><OperationFeedbackProvider><AppShell><div data-owned-content>DEMO authorized device content</div></AppShell></OperationFeedbackProvider></LanguageProvider>);
`;
const recordsEntry=entry.replace("import'virtual:adapter';","import{CustomerDevices}from'@/components/customers/customer-devices';import'virtual:adapter';").replace('<div data-owned-content>DEMO authorized device content</div>','<CustomerDevices/>');
async function mount(page:Page,records=false){await page.setContent('<div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter,entry:records?recordsEntry:entry,seams:['components/backend-snapshot','components/staff/use-staff','components/navigation-link','lib/staff-client','lib/backend/client','components/dashboard/logout-button','components/repairs/local-intake-store','components/retail/retail-provider']})});}
async function set(page:Page,permissions:string[],flag=true,route='/app/customer-devices'){await page.evaluate(({permissions,flag,route})=>(window as unknown as{deviceShell:{set:(permissions:string[],flag:boolean,route:string)=>void}}).deviceShell.set(permissions,flag,route),{permissions,flag,route});}
const content=(page:Page)=>page.locator('[data-owned-content]'),navigation=(page:Page)=>page.getByRole('navigation').getByRole('link',{name:'客户设备',exact:true});
test('bounded device route and menu use only either authorized source domain; legacy and unrelated routes retain their policy',async({page})=>{
 await mount(page);await expect(content(page)).toBeVisible();await expect(navigation(page)).toBeVisible();
 await set(page,['retail.view']);await expect(content(page)).toBeVisible();await expect(navigation(page)).toBeVisible();
 for(const permissions of[['customers.view'],[]]){await set(page,permissions);await expect(content(page)).toHaveCount(0);await expect(navigation(page)).toHaveCount(0);await expect(page.getByText('当前账号无法访问此页面',{exact:true})).toBeVisible();}
 await set(page,['customers.view'],false);await expect(content(page)).toBeVisible();await expect(navigation(page)).toBeVisible();
 await set(page,['repairs.view'],false);await expect(content(page)).toHaveCount(0);await expect(navigation(page)).toHaveCount(0);
 await set(page,['repairs.view'],true,'/app/customers');await expect(content(page)).toHaveCount(0);
 await set(page,['customers.view'],true,'/app/customers');await expect(content(page)).toBeVisible();
});
test('same-session member permission revocation removes previously rendered device content and menu',async({page})=>{
 await mount(page);await expect(content(page)).toBeVisible();await set(page,[]);await expect(content(page)).toHaveCount(0);await expect(navigation(page)).toHaveCount(0);await set(page,['retail.view']);await expect(content(page)).toBeVisible();await expect(navigation(page)).toBeVisible();
});
test('single-domain device records keep readable phone facts and offer customer navigation only with customers.view',async({page})=>{
 await mount(page,true);
 for(const permissions of[['repairs.view'],['retail.view']]){
  await set(page,permissions);await expect(page.locator('[data-device-id]')).toHaveCount(1);await page.locator('.customer-device-card summary').click();await expect(page.locator('.customer-device-record')).toHaveCount(1);
  await expect(page.locator('.customer-device-record')).toContainText('+39000000001');await expect(page.locator('.customer-device-record [data-device-target=record]')).toBeVisible();
  await expect(page.locator('.customer-device-record [data-device-target=customer]')).toHaveCount(0);await expect(page.locator('main .module-heading a[href="/app/customers"]')).toHaveCount(0);
 }
 await set(page,['repairs.view','customers.view']);await page.locator('.customer-device-card summary').click();await expect(page.locator('.customer-device-record [data-device-target=customer]')).toBeVisible();await expect(page.locator('main .module-heading a[href="/app/customers"]')).toBeVisible();
});
