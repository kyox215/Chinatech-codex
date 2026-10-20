import{test,expect}from'@playwright/test';import{buildInfiniteListFixture}from'./helpers/infinite-list-fixture';
const adapter=String.raw`
import React,{createContext}from'react';
const scope={formatVersion:2,accountId:'DEMO-account',sessionId:'DEMO-session',storeId:'DEMO-store',memberId:'DEMO-member',memberRevision:1,permissions:['repairs.view']};
const snapshot={storeId:scope.storeId,staff:{currentId:scope.memberId,members:[{id:scope.memberId,revision:1,role:'owner'}]},read:{scope,plan:{kind:'repairs'}}};
const listeners=new Set();let recovery={receipt:null};
export const api=window.ownerFixture={saved:0,closed:0,reads:0,emit:receipt=>{recovery={receipt};listeners.forEach(fn=>fn());}};
export const BackendSnapshotContext=createContext(null),parent={read:()=>snapshot,server:()=>snapshot,subscribe:()=>()=>{},isActive:()=>true,hydrated:true};
export const useBackendState=()=>({snapshot,formal:true,active:true}),backendRecovery=()=>recovery,subscribeRecovery=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const requestBackendEntityPage=async plan=>{api.reads++;return{...snapshot,stateToken:'DEMO-target',read:{scope,plan}};};
export const ProcurementProvider=({children})=><>{children}</>,useRepairDirectory=()=>[{id:'LOCAL-B000000000000001',device:{model:'DEMO B'}}];
export const RepairProcurementDialog=({onClose,onConfirmed,readFailure})=><section role="dialog" aria-label="DEMO parts B">{readFailure}<button onClick={()=>onConfirmed?.('DEMO-OWN-B')}>DEMO confirm B</button><button onClick={onClose}>DEMO close B</button></section>;
export const RepairStageDialog=()=>null,RepairContactDialog=()=>null;
export const useRouter=()=>({refresh:()=>{}});
export const NavigationLink=({href,children})=><a href={href}>{children}</a>;
`;
const entry=String.raw`
import React from'react';import{createRoot}from'react-dom/client';import{RepairEntityOperation}from'@/components/repairs/repair-entity-operation';import{LanguageProvider}from'@/components/language-provider';import{OperationFeedbackProvider}from'@/components/operation-feedback';import{api,parent,BackendSnapshotContext}from'virtual:adapter';
createRoot(document.getElementById('root')).render(<LanguageProvider><OperationFeedbackProvider><BackendSnapshotContext.Provider value={parent}><RepairEntityOperation id="LOCAL-B000000000000001" kind="parts" onSaved={()=>api.saved++} onClose={()=>api.closed++}/></BackendSnapshotContext.Provider></OperationFeedbackProvider></LanguageProvider>);
`;
for(const own of[false,true])test(`actual entity owner ${own?'accepts its own confirmation':'ignores another repair recovered receipt on close'}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setContent('<div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter,entry,seams:['components/backend-snapshot','components/navigation-link','lib/backend/client','lib/backend/page-read-client','components/procurement/procurement-provider','components/procurement/repair-procurement-shortcut','components/repairs/local-intake-store','components/repairs/repair-stage-control','components/repairs/repair-contact-control']})});
 await expect(page.getByRole('dialog',{name:'DEMO parts B',exact:true})).toBeVisible();await page.evaluate(()=>(window as unknown as {ownerFixture:{emit:(value:object)=>void}}).ownerFixture.emit({requestId:'DEMO-OTHER-A',kind:'repair.workflow'}));await expect.poll(()=>page.evaluate(()=>(window as unknown as {ownerFixture:{reads:number}}).ownerFixture.reads)).toBeGreaterThan(1);if(own)await page.getByRole('button',{name:'DEMO confirm B',exact:true}).click();await page.getByRole('button',{name:'DEMO close B',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {ownerFixture:{closed:number}}).ownerFixture.closed)).toBe(1);expect(await page.evaluate(()=>(window as unknown as {ownerFixture:{saved:number}}).ownerFixture.saved)).toBe(own?1:0);expect(errors).toEqual([]);
});
