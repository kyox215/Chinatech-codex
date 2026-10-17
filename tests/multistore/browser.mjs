import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium,webkit,expect} from '@playwright/test';
const f=JSON.parse(fs.readFileSync('.company-tmp/multistore-pilot-20261017/fixture.private.json','utf8')),origin=process.env.MULTISTORE_ORIGIN||'http://127.0.0.1:3117',evidence='.company-tmp/multistore-pilot-20261017';const checks=[];
for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
 assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Browser tests require loopback');
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  await context.addCookies(f.owner.jar.map(([key,value])=>({name:key,value,domain:new URL(origin).hostname,path:'/',httpOnly:true,sameSite:'Lax'})));
  let phase='initial';const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);fs.writeFileSync(evidence+'/'+name+'-pageerrors.json',JSON.stringify({phase,message:e.message,stack:e.stack,url:page.url()},null,2));});
  for(const locale of ['zh-CN','it','en']){
   await page.goto(origin+'/account/stores');await expect(page.locator('form').first().getByRole('button').last()).toBeEnabled();await page.evaluate(value=>localStorage.setItem('chinatech.language',value),locale);
   for(const width of [1440,1024,390,375]){phase=locale+' '+width;
    await page.setViewportSize({width,height:1000});await page.goto(origin+'/account/stores');await expect(page.locator('#new-store-name')).toBeVisible();await expect(page.getByRole('heading',{level:1,name:({'zh-CN':'我的门店',it:'I miei negozi',en:'My stores'})[locale],exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Synthetic pilot A',exact:true})).toBeVisible();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const size=await page.locator('#new-store-name').evaluate(e=>getComputedStyle(e).fontSize);if(width<768)assert(Number.parseFloat(size)>=16);
    await page.goto(origin+'/app/settings/store?storeId='+f.storeId);await expect(page.locator('progress')).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(locale==='zh-CN')await page.screenshot({path:evidence+'/'+name+'-'+width+'.png',fullPage:true});
    checks.push(name+' '+locale+' '+width+' stores/usage/overflow/input');
   }
  }
  await page.route('**/api/backend/store-usage',async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.continue();});await page.goto(origin+'/app/settings/store?storeId='+f.storeId);const line=page.locator('[data-content-progress][data-active="true"]');await expect(line).toBeVisible();assert.equal(await line.evaluate(element=>getComputedStyle(element).height),'2px');await expect(page.locator('progress')).toBeVisible();await page.unroute('**/api/backend/store-usage');checks.push(name+' compiled CSS first-read feedback is actual 2px progress');
  phase='two tabs';const other=await context.newPage();await page.goto(origin+'/app/dashboard?storeId='+f.storeId);await other.goto(origin+'/app/dashboard?storeId='+f.secondStoreId);
  const a=await page.evaluate(()=>Array.from(document.querySelectorAll('a[href^="/app/"]')).map(a=>a.href));assert(a.length>0&&a.every(href=>new URL(href).searchParams.get('storeId')===f.storeId));
  const b=await other.evaluate(()=>Array.from(document.querySelectorAll('a[href^="/app/"]')).map(a=>a.href));assert(b.length>0&&b.every(href=>new URL(href).searchParams.get('storeId')===f.secondStoreId));checks.push(name+' two tabs pin all internal navigation to their own stores');
  phase='unknown first load';await page.goto(origin+'/account/stores');await expect(page.getByRole('link',{name:'Synthetic pilot A',exact:true})).toBeVisible();await page.locator('#new-store-name').fill('Unknown synthetic store');let requestId;
  await page.route('**/api/account/stores',route=>{if(route.request().method()==='POST'){requestId=route.request().postDataJSON().requestId;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'暂时无法完成操作，请保留原请求后重试。'})});}return route.continue();});
  await page.locator('#new-store-name').press('Enter');await expect(page.locator('#new-store-name')).toBeDisabled();await expect(page.locator('main p[role=alert]')).toBeVisible();await expect(page.getByRole('button',{name:/重试原请求|Retry original request|Riprova la richiesta originale/})).toBeEnabled();phase='unknown reload';await page.reload();await expect(page.locator('#new-store-name')).toHaveValue('Unknown synthetic store');await expect(page.locator('#new-store-name')).toBeDisabled();
  phase='unknown retry';let retryId;await page.unroute('**/api/account/stores');await page.route('**/api/account/stores',route=>{if(route.request().method()==='POST'){retryId=route.request().postDataJSON().requestId;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'暂时无法完成操作，请保留原请求后重试。'})});}return route.continue();});
  await page.getByRole('button',{name:/重试原请求|Retry original request|Riprova la richiesta originale/}).click();await expect.poll(()=>retryId).toBe(requestId);await expect(page.locator('main p[role=alert]')).toBeVisible();await expect(page.getByRole('button',{name:/重试原请求|Retry original request|Riprova la richiesta originale/})).toBeEnabled();checks.push(name+' unknown create locks draft/restores and retries original ID');
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
}
fs.writeFileSync(evidence+'/browser.json',JSON.stringify({checks},null,2));console.log('PASS '+checks.length+' real browser scenarios');
