import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium,webkit,expect} from '@playwright/test';
const root='.company-tmp/multistore-pilot-20261017',f=JSON.parse(fs.readFileSync(root+'/fixture.private.json')),repair=JSON.parse(fs.readFileSync(root+'/storage-api.json')),retail=JSON.parse(fs.readFileSync(root+'/retail-storage-api.json')),origin=process.env.MULTISTORE_ORIGIN||'http://127.0.0.1:3117',checks=[];
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Photo browser tests require loopback');
for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});try{
  const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(f.owner.jar.map(([name,value])=>({name,value,domain:new URL(origin).hostname,path:'/',httpOnly:true,sameSite:'Lax'})));
  const page=await context.newPage(),responses=[];page.on('response',r=>{if(r.url().includes('/api/backend/intake-photo'))responses.push({url:r.url(),status:r.status()});});
  await page.goto(origin+'/app/repairs/'+repair.id+'?storeId='+f.storeId);await page.locator('[role="tab"][aria-controls$="-panel-photos"]').click();
  const image=page.locator('[role="tabpanel"]:visible img[src*="/api/backend/intake-photo"]').first();await expect(image).toBeVisible();
  const imageUrl=new URL(await image.getAttribute('src'),origin);assert.equal(imageUrl.searchParams.get('storeId'),f.storeId,'Rendered repair original must carry current document scope');await expect.poll(()=>image.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);assert(responses.some(r=>r.status===200&&new URL(r.url).searchParams.get('storeId')===f.storeId));
  const noScope=new URL(imageUrl);noScope.searchParams.delete('storeId');assert.equal((await context.request.get(noScope.href)).status(),400);const otherScope=new URL(imageUrl);otherScope.searchParams.set('storeId',f.secondStoreId);assert.equal((await context.request.get(otherScope.href)).status(),404);checks.push(name+' actual saved repair photo loads with explicit store; missing/other store denied');
  await page.goto(origin+'/app/retail/units/'+retail.unitId+'?storeId='+f.storeId);const retailImage=page.locator('img[src*="/api/backend/retail-photo"]').first();await expect(retailImage).toBeVisible();assert.equal(new URL(await retailImage.getAttribute('src'),origin).searchParams.get('storeId'),f.storeId);await expect.poll(()=>retailImage.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);checks.push(name+' actual saved retail private original loads with explicit store');await context.close();
 }finally{await browser.close();}
}
fs.writeFileSync(root+'/photo-browser.json',JSON.stringify({checks},null,2));console.log('PASS '+checks.length+' actual photo browser scope checks');
