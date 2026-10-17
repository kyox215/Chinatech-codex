import {test,expect} from '@playwright/test';
import {readFileSync}from'node:fs';
import {buildInfiniteListFixture}from'./helpers/infinite-list-fixture';
const adapter=String.raw`
import React from 'react';
const scope={formatVersion:2,accountId:'DEMO-account',sessionId:'DEMO-session',storeId:'DEMO-store',memberId:'DEMO-member',memberRevision:1,permissions:['repairs.view','customers.view']};
const member={id:scope.memberId,role:'technician',revision:1,permissions:scope.permissions,accountStatus:'active',membershipStatus:'active'};
const snapshot={storeId:scope.storeId,procurementListEnabled:true,customerListEnabled:true,read:{scope},staff:{currentId:member.id,members:[member]}};
window.readFixture={calls:0,fail:true};
export const backendSnapshot=()=>snapshot,clearBackend=()=>{},subscribeBackend=()=>()=>{};
export const useBackendState=()=>({formal:true,active:true,snapshot});
export const useStaff=()=>({member,can:permission=>member.permissions.includes(permission)});
export const useRouter=()=>({refresh:()=>{throw new Error('Expected local retry')}});
export const NavigationLink=({href,children,icon,iconPosition,...props})=><a href={href} {...props}>{children}{icon}</a>;
export const PageTitle=({title})=><h1>{title}</h1>;
export const SupplierBatchDialog=()=>null;
`;
const entry=String.raw`
import React from 'react';import{createRoot}from'react-dom/client';
import{LanguageProvider}from'@/components/language-provider';
import{ContentProgress,OperationFeedbackProvider}from'@/components/operation-feedback';
import{ProcurementListBody}from'@/components/procurement/procurement-list-body';
import{useProcurementListPage}from'@/components/procurement/use-procurement-list-page';
import'virtual:adapter';
const api=window.readFixture;
window.fetch=async()=>{api.calls++;if(api.fail)return new Response(JSON.stringify({message:'后台资料暂不可用。'}),{status:503});return new Response(JSON.stringify({formatVersion:1,scope:{formatVersion:2,accountId:'DEMO-account',sessionId:'DEMO-session',storeId:'DEMO-store',memberId:'DEMO-member',memberRevision:1,permissions:['repairs.view','customers.view']},generation:'1',stateToken:'demo',query:{q:'',filter:'all',repairId:'',groupBy:'supplier'},total:1,groupTotal:1,stats:{all:1,draft:0,open:1,complete:0},items:[{id:'DEMO-PO-1',repairId:'DEMO-R-1',repairModel:'DEMO Model',item:'DEMO part',supplier:'DEMO Supplier',quantity:3,arrived:0,status:'ordered',expectedAt:'',ledgerRevision:1,groupKey:'DEMO Supplier',groupFirst:'DEMO-PO-1',groupCount:1}],startIndex:0,previousCursor:null,nextCursor:null}));};
function Case(){const query={q:'',filter:'all',repairId:'',groupBy:'supplier'},list=useProcurementListPage(query);return <ProcurementListBody query={query} update={()=>{}} items={list.page?.items??[]} stats={list.page?.stats} total={list.page?.total??0} groupTotal={list.page?.groupTotal??0} ready={Boolean(list.page)} pending={list.pending} error={list.error} retry={list.retry} hasMore={false} loadMore={()=>{}} resetKey={list.resetKey} repairFilter={null}/>;}
createRoot(document.getElementById('root')).render(<LanguageProvider><OperationFeedbackProvider><ContentProgress/><Case/></OperationFeedbackProvider></LanguageProvider>);
`;
test('first bounded read503 becomes idle error then explicit retry succeeds',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync('app/globals.css','utf8')}</style><div id="root"></div>`);
 await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter,entry,seams:['components/backend-snapshot','components/staff/use-staff','lib/backend/client','components/navigation-link','components/page-title','components/procurement/supplier-batch-dialog']})});
 await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.read-pending')).toHaveCount(0);await expect(page.locator('[data-content-progress]')).toHaveAttribute('data-active','false');await expect(page.getByRole('button',{name:'重试加载',exact:true})).toBeEnabled();
 await page.evaluate(()=>{(window as unknown as {readFixture:{fail:boolean}}).readFixture.fail=false;});await page.getByRole('button',{name:'重试加载',exact:true}).click();await expect(page.locator('.procurement-row')).toContainText('DEMO part');await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('[data-content-progress]')).toHaveAttribute('data-active','false');expect(errors).toEqual([]);
});
const keyboardEntry=String.raw`
import React,{useEffect,useRef,useState}from'react';import{createRoot}from'react-dom/client';import{WindowedListRows}from'@/components/windowed-list-rows';
const items=Array.from({length:500},(_,i)=>({id:'DEMO-'+i,index:i}));
function Case(){const root=useRef(null),[version,setVersion]=useState('one');window.windowFixture={version:()=>setVersion('two')};return <div ref={root} data-scroll-root style={{height:420,overflow:'auto'}}><WindowedListRows scrollRoot={root} items={items} total={1200} rowKey={row=>row.id} version={version} render={(row,props)=><article {...props} tabIndex={-1} style={{height:version==='one'?120:180}}><input type="checkbox" data-control="checkbox" aria-label={'DEMO select '+row.index}/><a href={'#DEMO-'+row.index}>DEMO relation {row.index}</a><input type="number" data-control="quantity" aria-label={'DEMO quantity '+row.index} defaultValue="1"/></article>}/></div>;}
createRoot(document.getElementById('root')).render(<Case/>);
`;
test('dialog scroll window Tab and Shift+Tab mount and focus real row controls',async({page})=>{
 await page.setContent('<div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry:keyboardEntry,seams:[]})});await expect.poll(()=>page.locator('[data-window-key]').count()).toBeGreaterThan(2);await page.waitForTimeout(100);
 const last=page.locator('[data-window-key]').last(),index=Number(await last.getAttribute('data-window-index'));await last.locator('[data-control="quantity"]').evaluate(node=>(node as HTMLElement).focus({preventScroll:true}));await page.keyboard.press('Tab');await expect(page.locator(`[data-window-index="${index+1}"] [data-control="checkbox"]`)).toBeFocused();
 await page.locator('[data-scroll-root]').evaluate(node=>node.scrollTop=4000);await expect.poll(()=>page.locator('[data-window-key]').first().getAttribute('data-window-index')).not.toBe('0');const first=page.locator('[data-window-key]').first(),before=Number(await first.getAttribute('data-window-index'));await first.locator('[data-control="checkbox"]').evaluate(node=>(node as HTMLElement).focus({preventScroll:true}));await page.keyboard.press('Shift+Tab');await expect(page.locator(`[data-window-index="${before-1}"] [data-control="quantity"]`)).toBeFocused();
 const focused=page.locator(':focus'),key=await focused.locator('xpath=ancestor::article').getAttribute('data-window-key'),top=await focused.evaluate(node=>node.getBoundingClientRect().top);await page.evaluate(()=>(window as unknown as {windowFixture:{version:()=>void}}).windowFixture.version());await expect.poll(()=>page.locator(`[data-window-key="${key}"] [data-control="quantity"]`).evaluate((node,top)=>Math.abs(node.getBoundingClientRect().top-top),top)).toBeLessThan(1.5);expect(await page.locator('[data-window-key]').count()).toBeLessThan(50);
});
const groupedWindowEntry=String.raw`
import React from'react';import{createRoot}from'react-dom/client';import{WindowedListRows}from'@/components/windowed-list-rows';
window.groupSeekFixture={A:[],B:[]};const rows=Array.from({length:50},(_,i)=>({id:'DEMO-'+(50+i)}));
function Case(){return <>{['A','B'].map(group=><section data-group={group} key={group}><h2>{'DEMO '+group}</h2><WindowedListRows items={rows} startIndex={50} extent={100} total={100} thresholdTotal={300} estimate={80} rowKey={row=>row.id} onSeek={rank=>window.groupSeekFixture[group].push(rank)} render={(row,props)=><article {...props} style={{height:80}}><a href={'#'+group+row.id}>{group+row.id}</a></article>}/></section>)}</>;}
createRoot(document.getElementById('root')).render(<Case/>);
`;
test('offscreen grouped windows never seek first or last rows of another visible group',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.setContent('<div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry:groupedWindowEntry,seams:[]})});await expect.poll(()=>page.evaluate(()=>(window as unknown as {groupSeekFixture:{A:number[];B:number[]}}).groupSeekFixture.A.length)).toBe(1);expect(await page.evaluate(()=>(window as unknown as {groupSeekFixture:{B:number[]}}).groupSeekFixture.B)).toEqual([]);
 await page.locator('[data-group="B"]').evaluate(node=>scrollTo({top:node.getBoundingClientRect().top+scrollY+100,behavior:'instant'}));await expect.poll(()=>page.evaluate(()=>(window as unknown as {groupSeekFixture:{B:number[]}}).groupSeekFixture.B.length)).toBe(1);await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as unknown as {groupSeekFixture:{A:number[];B:number[]}}).groupSeekFixture)).toEqual({A:[0],B:[0]});
});
