import {test,expect,type Page} from '@playwright/test';
import {createServer} from 'node:http';
import {buildInfiniteListFixture} from './helpers/infinite-list-fixture';

// Only Next's router/link boundary and the authenticated identity source are synthetic.
// The boundary follows installed next/dist/client/app-dir/link.js: onClick first,
// modified clicks stay native, onNavigate may cancel, then a real React transition.
// NavigationLink, language, navigation ownership and B feedback execute actual source.
const adapter=String.raw`
import React,{createContext,useContext,useSyncExternalStore,useTransition}from'react';
export const RouterContext=createContext(null),StatusContext=createContext({pending:false});
const listeners=new Set();let snapshot={storeId:'DEMO-STORE',read:{scope:{formatVersion:2,accountId:'DEMO-A',sessionId:'DEMO-S',storeId:'DEMO-STORE',memberId:'DEMO-M',memberRevision:1,permissions:['repairs.view']}}};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export const backendSnapshot=()=>snapshot;
export const useBackendState=()=>({snapshot:useSyncExternalStore(subscribe,()=>snapshot,()=>snapshot),formal:true,active:!!snapshot});
export const useRouter=()=>useContext(RouterContext).router;
export const usePathname=()=>useContext(RouterContext).pathname;
export const useLinkStatus=()=>useContext(StatusContext);
const api=window.navigationFixture={calls:[],completed:[],revision:0};window.addEventListener('pagehide',()=>sessionStorage.setItem('navigation-departed',JSON.stringify({calls:api.calls,completed:api.completed,source:location.href})));
api.liveOnly=()=>{snapshot={...snapshot,read:{scope:{...snapshot.read.scope,sessionId:'DEMO-S-STALE'}}};};
api.scope=()=>{snapshot={...snapshot,read:{scope:{...snapshot.read.scope,sessionId:'DEMO-S-NEW'}}};listeners.forEach(fn=>fn());};
export default function Link({href,children,onClick,onNavigate,replace,scroll,prefetch,onMouseEnter,onTouchStart,...props}){
 const router=useRouter(),[pending,start]=useTransition();
 return <a {...props} href={href} onClick={event=>{onClick?.(event);if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0||props.target&&props.target!=='_self'||props.download!==undefined)return;
  event.preventDefault();let cancelled=false;onNavigate?.({preventDefault:()=>{cancelled=true}});if(!cancelled)start(()=>router[replace?'replace':'push'](String(href),{scroll}));
 }}><StatusContext.Provider value={{pending}}>{children}</StatusContext.Provider></a>;
}
`;
const entry=String.raw`
import React,{Suspense,use,useInsertionEffect,useState}from'react';import{createRoot}from'react-dom/client';
import{NavigationLink}from'@/components/navigation-link';import{OperationFeedbackProvider,ContentProgress}from'@/components/operation-feedback';import{LanguageProvider}from'@/components/language-provider';import{RouterContext}from'virtual:adapter';
const api=window.navigationFixture;let hold=null;
api.hold=()=>{let release;const promise=new Promise(resolve=>release=resolve);hold={promise,release};};
api.release=()=>{hold?.release();};
function Target({destination}){if(destination.wait)use(destination.wait);useInsertionEffect(()=>{history[destination.replace?'replaceState':'pushState'](null,'',destination.href);},[destination]);return <div data-destination>{destination.href}</div>;}
function Case(){const[revision,rerender]=useState(0),[mode,setMode]=useState('resolved'),[destination,setDestination]=useState({href:location.href});
 api.rerender=()=>rerender(value=>value+1);api.mode=value=>setMode(value);
 const navigate=(href,options,replace)=>{api.calls.push({href,options,replace});setDestination({href,replace,wait:hold?.promise});};
 const router={push:(href,options)=>navigate(href,options,false),replace:(href,options)=>navigate(href,options,true)};
 return <RouterContext.Provider value={{router,pathname:new URL(destination.href,location.origin).pathname}}><LanguageProvider><OperationFeedbackProvider><ContentProgress/>
 <div data-revision={revision}><NavigationLink href='/app/repairs/DEMO?storeId=DEMO-STORE' resolveHref={mode==='default'?undefined:()=>{if(api.throwResolver)throw Error('DEMO resolver failure');return Object.hasOwn(api,'href')?api.href:'/app/repairs/DEMO?returnTo=%2Fapp%2Fcustomer-devices%3Frecord%3DDEMO-CLICK';}} onClick={event=>{api.clicks=(api.clicks??0)+1;if(api.cancelClick)event.preventDefault();}} onNavigate={event=>{if(api.cancelNavigate)event.preventDefault();}} onNavigationComplete={()=>api.completed.push(revision)} scroll={false}>DEMO record</NavigationLink></div>
 <input aria-label='DEMO note'/><Suspense fallback={<span>DEMO initial</span>}><Target destination={destination}/></Suspense>
 </OperationFeedbackProvider></LanguageProvider></RouterContext.Provider>;
}createRoot(document.getElementById('root')).render(<Case/>);
`;
type Fixture={hold:()=>void;release:()=>void;rerender:()=>void;scope:()=>void;mode:(mode:string)=>void;calls:unknown[];completed:number[];href?:string|null;cancelClick?:boolean;cancelNavigate?:boolean;throwResolver?:boolean;liveOnly:()=>void};
type FixtureWindow=Window&{navigationFixture:Fixture};
let origin='',initial='';
const server=createServer((request,response)=>{response.setHeader('Content-Type','text/html');const path=new URL(request.url??'/', 'http://fixture.invalid').pathname;if(path==='/__navigation-fixture')response.end('<div id="root"></div>');else if(path==='/__native-control')response.end('<a href="/app/repairs/DEMO?returnTo=%2Fapp%2Fcustomer-devices%3Frecord%3DDEMO-CLICK&amp;storeId=DEMO-STORE">DEMO neutral</a>');else if(path==='/app/repairs/DEMO')response.end('<h1>DEMO new document</h1>');else{response.statusCode=404;response.end();}});
test.beforeAll(async()=>{await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Missing fixture address');origin='http://127.0.0.1:'+address.port;initial=origin+'/__navigation-fixture';});
test.afterAll(async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
async function state(page:Page){return page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;return{calls:api.calls,completed:api.completed,url:location.href};});}
async function mount(page:Page){
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(initial);await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter,entry,seams:['next/link','components/backend-snapshot','lib/backend/client']})});
 await expect(page.getByRole('link',{name:'DEMO record',exact:true})).toBeVisible();return errors;
}
const link=(page:Page)=>page.getByRole('link',{name:'DEMO record',exact:true});
const progress=(page:Page)=>page.locator('[data-content-progress]');
test('resolved navigation retains real pending through unrelated parent rerenders and completes once',async({page})=>{
 const errors=await mount(page);await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.hold());await link(page).click();await expect(link(page).locator('[data-pending=true]')).toHaveCount(1);await expect(progress(page)).toHaveAttribute('data-active','true');expect((await state(page)).url).toBe(initial);
 await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.rerender());await expect(page.locator('[data-revision]')).toHaveAttribute('data-revision','1');await expect(link(page).locator('[data-pending=true]')).toHaveCount(1);await expect(progress(page)).toHaveAttribute('data-active','true');expect((await state(page)).completed).toEqual([]);
 await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.release());await expect(progress(page)).toHaveAttribute('data-active','false');await expect.poll(()=>state(page).then(value=>value.completed)).toEqual([1]);const result=await state(page);expect(result.calls).toEqual([{href:origin+'/app/repairs/DEMO?returnTo=%2Fapp%2Fcustomer-devices%3Frecord%3DDEMO-CLICK&storeId=DEMO-STORE',options:{scroll:false},replace:false}]);expect(result.url).toContain('record%3DDEMO-CLICK');expect(errors).toEqual([]);
});
test('default navigation, keyboard activation, explicit cancellation and same-URL refresh keep their original semantics',async({page})=>{
 await mount(page);await page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;api.mode('default');api.cancelClick=true;});await link(page).click();expect((await state(page)).calls).toHaveLength(0);
 await page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;api.cancelClick=false;api.cancelNavigate=true;});await link(page).click();expect((await state(page)).calls).toHaveLength(0);
 await page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;api.cancelNavigate=false;api.hold();});await link(page).focus();await page.keyboard.press('Enter');await expect(progress(page)).toHaveAttribute('data-active','true');await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.release());await expect(progress(page)).toHaveAttribute('data-active','false');await expect.poll(()=>state(page).then(value=>value.completed.length)).toBe(1);
 await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.hold());await link(page).click();await expect(progress(page)).toHaveAttribute('data-active','true');expect((await state(page)).completed).toHaveLength(1);await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.release());await expect(progress(page)).toHaveAttribute('data-active','false');await expect.poll(()=>state(page).then(value=>value.completed.length)).toBe(2);
});
test('resolver failures, unsafe URLs, wrong store and a stale identity never dispatch navigation',async({page})=>{
 const errors=await mount(page);
 for(const href of[null,'https://example.invalid/private','//example.invalid/private','/\\example.invalid/private','/app/repairs/DEMO?storeId=OTHER']){await page.evaluate(value=>{(window as unknown as FixtureWindow).navigationFixture.href=value;},href);await link(page).click();expect((await state(page)).calls).toHaveLength(0);expect((await state(page)).url).toBe(initial);}
 await page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;delete api.href;api.throwResolver=true;});await link(page).click();expect((await state(page)).calls).toHaveLength(0);
 await page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;api.throwResolver=false;api.cancelNavigate=true;});await link(page).click();expect((await state(page)).calls).toHaveLength(0);await expect(progress(page)).toHaveAttribute('data-active','false');await page.evaluate(()=>{const api=(window as unknown as FixtureWindow).navigationFixture;api.cancelNavigate=false;api.liveOnly();});await link(page).click();expect((await state(page)).calls).toHaveLength(0);expect(errors).toEqual([]);
});
test('changing authenticated owner clears presentation and cannot invoke an old completion',async({page})=>{
 await mount(page);await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.hold());await link(page).click();await expect(progress(page)).toHaveAttribute('data-active','true');await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.scope());await expect(progress(page)).toHaveAttribute('data-active','false');await page.evaluate(()=>(window as unknown as FixtureWindow).navigationFixture.release());await expect.poll(()=>page.locator('[data-destination]').innerText()).toContain('/app/repairs/DEMO');expect((await state(page)).completed).toEqual([]);
});
type NativeOutcome={mode:'popup'|'source';target:Page};
async function nativeDestination(page:Page,click:()=>Promise<void>):Promise<NativeOutcome>{
 const context=page.context();let timer:ReturnType<typeof setTimeout>|undefined;
 let newPage:(page:Page)=>void=()=>{},navigated:()=>void=()=>{};
 const destination=new Promise<NativeOutcome>((resolve,reject)=>{
  timer=setTimeout(()=>reject(new Error('Native click did not commit a target document')),10000);
  newPage=target=>{void target.waitForURL(url=>url.pathname==='/app/repairs/DEMO').then(()=>resolve({mode:'popup',target}),reject);};
  navigated=()=>{if(new URL(page.url()).pathname==='/app/repairs/DEMO')resolve({mode:'source',target:page});};
  context.on('page',newPage);page.on('framenavigated',navigated);
 });
 try{await click();const result=await destination;await expect(result.target.getByRole('heading',{name:'DEMO new document',exact:true})).toBeVisible();return result;}
 finally{clearTimeout(timer);context.off('page',newPage);page.off('framenavigated',navigated);}
}
test('native modified mouse navigation keeps the resolved href without custom dispatch',async({browser,browserName})=>{
 const context=await browser.newContext({viewport:{width:1024,height:900},isMobile:false,hasTouch:false}),conditions:unknown[]=[];
 try{
  for(const middle of[false,true]){
   const options=middle?{button:'middle' as const}:{modifiers:[process.platform==='darwin'?'Meta' as const:'Control' as const]};
   // Measure a neutral native <a> in this exact OS/browser/mouse context.
   // WebKit middle-button automation differs between macOS and Linux; it is
   // neither an application dispatch nor a physical Safari preference claim.
   const neutral=await context.newPage();await neutral.goto(origin+'/__native-control');
   const control=await nativeDestination(neutral,()=>neutral.getByRole('link',{name:'DEMO neutral',exact:true}).click(options));
   const controlUrl=control.target.url();if(control.target!==neutral)await control.target.close();await neutral.close();
   const page=await context.newPage();const errors=await mount(page);
   const result=await nativeDestination(page,()=>link(page).click(options));
   expect(result.mode).toBe(control.mode);expect(result.target.url()).toBe(controlUrl);
   expect(result.target.url()).toContain('record%3DDEMO-CLICK');expect(new URL(result.target.url()).searchParams.get('storeId')).toBe('DEMO-STORE');
   if(result.mode==='source'){
    const departed=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('navigation-departed')!));expect(departed).toEqual({calls:[],completed:[],source:initial});
   }else{
    expect((await state(page)).calls).toHaveLength(0);expect((await state(page)).completed).toHaveLength(0);expect((await state(page)).url).toBe(initial);await expect(progress(page)).toHaveAttribute('data-active','false');
   }
   expect(errors).toEqual([]);conditions.push({middle,neutral:control.mode,actual:result.mode,targetUrl:result.target.url(),sourceUrl:page.url()});
   if(result.target!==page)await result.target.close();await page.close();
  }
  await test.info().attach('native-condition',{body:JSON.stringify({browserName,platform:process.platform,isMobile:false,hasTouch:false,conditions,condition:'Task-owned ephemeral HTTP; exact neutral native-link differential, not a physical Safari mouse preference assertion'}),contentType:'application/json'});
 }finally{await context.close();}
});
