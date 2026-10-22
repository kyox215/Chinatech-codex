import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
import {chromium,webkit} from '@playwright/test';

// This UI-only harness must never authenticate or create a real store.
// Add a temporary local /store-entry-preview route rendering MyStores before
// building. The route is excluded from the delivered source commit.
const origin=process.env.CT_STORE_ENTRY_ORIGIN;
assert(origin&&new URL(origin).hostname==='127.0.0.1');
const out=resolve(process.env.CT_STORE_ENTRY_EVIDENCE??'.local/store-entry-proof');
mkdirSync(out,{recursive:true});
const messages=JSON.parse(readFileSync('lib/i18n/structured.json'));
for(const file of ['errors','interface','public']){
 const exports={};runInContext(ts.transpileModule(readFileSync('lib/i18n/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,createContext({exports}));
 Object.assign(messages,...Object.values(exports));
}
const tr=(s,locale)=>locale==='zh-CN'?s:messages[s]?.[locale==='it'?0:1]??s;
const accountId='11111111-1111-4111-8111-111111111111',storeId='22222222-2222-4222-8222-222222222222';
const originalId='33333333-3333-4333-8333-333333333333';
const store={id:storeId,name:'ChinaTech Demo',role:'owner'};
const results=[];
async function setup(browser,locale,width,state={}){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 await context.addInitScript(({locale,recovered})=>{localStorage.setItem('chinatech.language',locale);if(recovered)sessionStorage.setItem('ct-store-intent:'+recovered.accountId,JSON.stringify(recovered.intent));},{locale,recovered:state.recovered});
 const page=await context.newPage(),posts=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth/logout',route=>route.fulfill({status:503,json:{message:'Synthetic logout failure'}}));
 await page.route('**/api/account/store-invitations',async route=>{
  if(route.request().method()==='POST')posts.push(route.request().postDataJSON());
  await route.fulfill({json:state.invitation??{hasInvitation:false}});
 });
 await page.route('**/api/account/stores*',async route=>{
  if(route.request().method()==='POST'){
   posts.push(route.request().postDataJSON());
   if(state.holdPost)await state.holdPost;
   return route.fulfill({status:503,json:{message:'请求结果尚未确认。请核对账号状态后重试，输入已保留。'}});
  }
  if(state.hold)await state.hold;
  if(state.networkError)return route.abort('internetdisconnected');
  if(state.failure)return route.fulfill({status:state.failure,json:{message:'暂时无法读取账号，请稍后重试。'}});
  return route.fulfill({json:{accountId,sessionId:'synthetic-session',stores:state.stores??[store],applications:state.applications??[],applicationPage:{totalCount:state.applications?.length??0,hasMore:false,nextCursor:null}}});
 });
 await page.goto(origin+'/store-entry-preview');
 await page.waitForFunction(locale=>document.documentElement.lang===locale,locale);
 const ready=()=>page.getByRole('button',{name:tr('重新检查',locale),exact:true}).waitFor({state:'visible'});
 return {context,page,posts,errors,ready};
}
async function settled(page){await page.waitForFunction(()=>!document.querySelector('[data-content-progress][data-active=true]'));await page.evaluate(()=>document.fonts.ready);}
async function geometry(page,width){
 await page.mouse.move(0,0);
 await page.locator('main .button').evaluateAll(elements=>Promise.all(elements.flatMap(element=>element.getAnimations()).filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
 const g=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,inputs:[...document.querySelectorAll('main input')].filter(x=>x.getClientRects().length).map(x=>parseFloat(getComputedStyle(x).fontSize)),buttons:[...document.querySelectorAll('main .button')].filter(x=>x.getClientRects().length).map(x=>({text:x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})),icons:[...document.querySelectorAll('main .lucide')].filter(x=>x.getClientRects().length).map(x=>({name:x.getAttribute('class'),w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height,paths:x.querySelectorAll('path,line,circle').length})),options:[...document.querySelectorAll('main button[aria-controls$="-store-form"]')].map(x=>({x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y,w:x.getBoundingClientRect().width})),cards:[...document.querySelectorAll('main article')].map(x=>({w:x.getBoundingClientRect().width,link:x.querySelector('a')?.getBoundingClientRect().width,icon:x.querySelector('.lucide-store')?.getBoundingClientRect().width})),background:getComputedStyle(document.querySelector('main')).backgroundColor}));
 assert(g.scroll<=width,'document overflow');for(const b of g.buttons)assert(b.w>=44&&b.h>=44,'touch target '+b.text);if(width<768)for(const px of g.inputs)assert(px>=16,'mobile input');for(const i of g.icons)assert(i.paths>0&&i.w>=16&&i.h>=16,'nonempty undistorted vector icon '+i.name);
 if(g.options.length===2){assert(Math.abs(g.options[0].y-g.options[1].y)<1,'optional actions remain side by side '+JSON.stringify(g.options));assert(g.options[1].x>g.options[0].x+g.options[0].w,'separate graphical targets');}
 for(const card of g.cards){assert.equal(card.icon,width<768?32:36,'responsive store glyph');if(width<768)assert(card.link>card.w-56,'mobile primary fills card '+JSON.stringify(card));}
 assert.equal(g.background,'rgb(246, 247, 249)','existing gray canvas token');
 return g;
}
for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.CT_STORE_ENGINE||name===process.env.CT_STORE_ENGINE)){
 const browser=await engine.launch({headless:true});
 try{
  for(const locale of ['zh-CN','it','en'])for(const width of [1440,1024,390,375]){
   const state={},h=await setup(browser,locale,width,state),{page}=h,key=engineName+'-'+locale+'-'+width;
   try{
    const joined=page.getByRole('region',{name:tr('已加入的门店',locale),exact:true});await joined.getByText(store.name,{exact:true}).waitFor();await settled(page);
    assert(await page.locator('#create-store-form').isHidden());assert(await page.locator('#join-store-form').isHidden());
    const enter=joined.getByRole('link',{name:tr('进入门店',locale),exact:true});assert.equal(await enter.getAttribute('href'),'/app/dashboard?storeId='+storeId);
    assert.equal(await page.locator('main .button--primary:visible').count(),1);
    assert((await joined.boundingBox()).y<(await page.getByRole('region',{name:tr('其他门店操作',locale)}).boundingBox()).y);
    await page.screenshot({path:resolve(out,key+'-default.png')});await geometry(page,width);
    const create=page.getByRole('button',{name:tr('创建新门店',locale),exact:true}),join=page.getByRole('button',{name:tr('通过邀请加入',locale),exact:true});
    await create.focus();await create.press('Enter');await page.locator('#new-store-name').fill('Synthetic draft');await page.screenshot({path:resolve(out,key+'-create-expanded.png')});await geometry(page,width);
    await join.click();assert(await page.locator('#create-store-form').isHidden());await page.locator('#store-invitation').fill('Synthetic invitation draft');
    await create.click();assert.equal(await page.locator('#new-store-name').inputValue(),'Synthetic draft');await create.press('Space');assert(await page.locator('#create-store-form').isHidden());
    await join.click();assert.equal(await page.locator('#store-invitation').inputValue(),'Synthetic invitation draft');await geometry(page,width);
    await page.screenshot({path:resolve(out,key+'-expanded.png')});await join.click();
    state.networkError=true;await page.getByRole('button',{name:tr('重新检查',locale),exact:true}).click();await page.locator('main [role=alert]').waitFor();assert(await joined.getByText(store.name,{exact:true}).isVisible());assert.equal(await page.getByText(tr('尚未加入门店',locale),{exact:true}).count(),0);
    state.networkError=false;await page.getByRole('button',{name:tr('重新检查',locale),exact:true}).click();await page.locator('main [role=alert]').waitFor({state:'hidden'});await settled(page);
    assert.equal(h.posts.length,0,'opening and refreshing must not create or apply');assert.deepEqual(h.errors,[]);
    results.push({engine:engineName,locale,width,checks:['single primary store entry','both forms collapsed','keyboard toggle and retained drafts','network failure retains store and manual recovery','44px/16px/overflow'],geometry:await geometry(page,width)});
    if(width===1440&&locale==='zh-CN'){
     await page.route('**/app/dashboard?storeId='+storeId,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local navigation fixture</title><main>Navigation verified</main>'}));
     await enter.click();await page.waitForURL('**/app/dashboard?storeId='+storeId);assert.equal(new URL(page.url()).searchParams.get('storeId'),storeId);
    }
    console.log('PASS '+key);
   }finally{await h.context.close();}
  }
  for(const variant of ['loading','empty','first-failure','unauthorized','multiple','invitation','unknown','submitting','logout-failure','settings']){
   let release;const state={};
   if(variant==='loading')state.hold=new Promise(r=>release=r);
   if(variant==='submitting')state.holdPost=new Promise(r=>release=r);
   if(variant==='empty')state.stores=[];
   if(variant==='first-failure')state.failure=503;
   if(variant==='unauthorized')state.failure=401;
   if(variant==='multiple')state.stores=[store,{...store,id:originalId,name:'Seconda sede con un nome molto lungo per verificare la disposizione',role:'technician'}];
   if(variant==='invitation')state.invitation={hasInvitation:true,storeName:'Invited Demo Store'};
   if(variant==='unknown')state.recovered={accountId,intent:{kind:'create',id:originalId,value:'Retained original draft'}};
   const h=await setup(browser,'zh-CN',375,state),{page}=h;
   try{
    if(variant==='loading'){
     await page.getByText('正在读取门店…',{exact:true}).waitFor();assert.equal(await page.getByText('尚未加入门店',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'创建新门店',exact:true}).count(),0);assert.equal(await page.locator('[data-content-progress][data-active=true]').count(),1);release();
    }
    if(variant==='first-failure'||variant==='unauthorized'){
     await page.locator('main [role=alert]').waitFor();assert.equal(await page.getByText('尚未加入门店',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'创建新门店',exact:true}).count(),0);state.failure=0;await page.getByRole('button',{name:'重新检查',exact:true}).click();
    }
    await page.getByRole('region',{name:'已加入的门店',exact:true}).waitFor();await settled(page);
    if(variant==='empty'){assert(await page.getByText('尚未加入门店',{exact:true}).isVisible());assert(await page.locator('#create-store-form').isHidden());assert(await page.locator('#join-store-form').isHidden());assert(await page.getByRole('region',{name:'创建或加入门店',exact:true}).isVisible());}
    if(variant==='multiple'){assert.equal(await page.getByRole('link',{name:'进入门店',exact:true}).count(),2);await geometry(page,375);}
    if(variant==='invitation'){assert(await page.locator('#join-store-form').isVisible());assert(await page.getByText('Invited Demo Store',{exact:true}).isVisible());assert.equal(h.posts.length,0);}
    if(variant==='unknown'){
     assert(await page.locator('#create-store-form').isVisible());assert.equal(await page.locator('#new-store-name').inputValue(),'Retained original draft');assert(await page.locator('#new-store-name').isDisabled());assert.equal(h.posts.length,0);
     await page.getByRole('button',{name:'重试原请求',exact:true}).click();await page.locator('main [role=alert]').waitFor();await settled(page);const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/stores'&&r.request().method()==='POST');await page.getByRole('button',{name:'重试原请求',exact:true}).click();await response;await settled(page);
     assert.equal(h.posts.length,2);assert(h.posts.every(p=>p.requestId===originalId&&p.name==='Retained original draft'));assert(await page.getByRole('button',{name:'创建新门店',exact:true}).isDisabled());
    }
    if(variant==='submitting'){
     await page.getByRole('button',{name:'创建新门店',exact:true}).click();await page.locator('#new-store-name').fill('Pending synthetic draft');await page.getByRole('button',{name:'创建并进入',exact:true}).click();
     await page.locator('#create-store-form [aria-busy=true]').waitFor();assert(await page.locator('#new-store-name').isDisabled());assert(await page.getByText(store.name,{exact:true}).isVisible());assert.equal(await page.locator('[data-content-progress][data-active=true]').count(),1);assert.equal(await page.getByRole('button',{name:'重新检查',exact:true}).getAttribute('aria-busy'),'false');await page.screenshot({path:resolve(out,engineName+'-submitting-pending.png')});release();await page.locator('main [role=alert]').waitFor();await settled(page);assert.equal(await page.locator('#new-store-name').inputValue(),'Pending synthetic draft');assert(await page.getByRole('button',{name:'重试原请求',exact:true}).isEnabled());
    }
    if(variant==='logout-failure'){
     await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.locator('main [role=alert]').waitFor();assert(await page.getByRole('button',{name:'退出登录',exact:true}).isEnabled());assert(await page.getByText(store.name,{exact:true}).isVisible());
    }
    if(variant==='settings'){
     await page.route('**/account/settings',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main>Local settings navigation fixture</main>'}));await page.getByRole('link',{name:'账号设置',exact:true}).click();await page.waitForURL('**/account/settings');assert.equal(new URL(page.url()).pathname,'/account/settings');
    }
    await page.screenshot({path:resolve(out,engineName+'-'+variant+'.png')});assert.deepEqual(h.errors,[]);results.push({engine:engineName,variant,checks:'passed; all API replies are explicit synthetic fixtures',posts:h.posts.length});
   }finally{release?.();await h.context.close();}
  }
 }finally{await browser.close();}
}
writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({origin,boundary:'Local production compilation with temporary fixture-rendering route. All account/store APIs intercepted; no authentication, DB calls, store creation or membership changes. Viewports emulate devices; no physical phone test.',results},null,2));
console.log('PASS '+results.length+' local UI cases');
