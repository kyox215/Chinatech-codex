import {test,expect} from '@playwright/test';
import {openCatalogPicker,pickerRoot,expectCatalogValue,activatePicker,fillCatalogQuery,pressCatalogKey} from './catalog-picker';
async function login(page:import('@playwright/test').Page){expect((await page.request.post('/api/preview-session',{data:{email:'demo@chinatech.local',password:'Preview2026!'}})).status()).toBe(200);}
async function device(page:import('@playwright/test').Page){await page.getByRole('combobox',{name:'联系电话',includeHidden:true}).fill('+393200001234');await page.getByRole('button',{name:'下一步',exact:true}).click();return page.locator('form.intake-form').getByRole('combobox',{name:'品牌',exact:true,includeHidden:true});}
test('native IndexedDB stores one complete public version and reload uses it with zero directory GETs',async({page},info)=>{
 await login(page);const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/device-directory/'))calls.push(r.url());});
 const start=Date.now();await page.goto('/app/repairs/new');const brand=await device(page),root=await openCatalogPicker(page,brand);await expect(root.getByRole('option',{name:'Apple',exact:true})).toBeVisible();
 const readyMs=Date.now()-start;expect(calls).toHaveLength(2);expect(calls[0]).toContain('/manifest');expect(calls[1]).toContain('/package');
 await expect.poll(()=>page.evaluate(()=>new Promise<number>(resolve=>{const request=indexedDB.open('chinatech-public-device-directory-v1',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('snapshots');const read=tx.objectStore('snapshots').get('active');read.onsuccess=()=>{const pack=read.result;resolve(pack?JSON.parse(pack.manifest).shards.reduce((sum:number,row:{count:number})=>sum+row.count,0):0);db.close();};};}))).toBe(3476);
 const initialCalls=calls.length;await page.route('**/api/device-directory/**',route=>route.abort());await page.reload();const cached=await device(page),cachedRoot=await openCatalogPicker(page,cached);await expect(cachedRoot.getByRole('option',{name:'Apple',exact:true})).toBeVisible();expect(calls.length).toBe(initialCalls);
 await activatePicker(cachedRoot.getByRole('option',{name:'Apple',exact:true}));await expectCatalogValue(cached,'Apple');
 await info.attach('native-cache',{body:JSON.stringify({readyMs,directoryRequests:initialCalls,cacheReloadRequests:calls.length-initialCalls,models:3476,source:'local preview packaged reference data; real engine IndexedDB; no production Auth'}),contentType:'application/json'});
});
test('cold deadline ends the busy state, preserves manual query, and explicit retry can recover',async({page})=>{
 test.setTimeout(30000);await login(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r);let blocked=true;
 await page.route('**/api/device-directory/manifest*',async route=>{if(blocked)await gate;await route.continue().catch(()=>{});});
 try{await page.goto('/app/repairs/new');const brand=await device(page),root=await openCatalogPicker(page,brand);await fillCatalogQuery(page,brand,'保留原文');
 await expect(root.getByRole('alert')).toContainText('设备目录查询超时',{timeout:12000});await expect(brand).not.toHaveAttribute('aria-busy','true');
 await pressCatalogKey(page,brand,'Escape');await expectCatalogValue(brand,'');blocked=false;release();
 await openCatalogPicker(page,brand);await activatePicker(root.getByRole('button',{name:'重新查询目录',exact:true}));await fillCatalogQuery(page,brand,'Apple');await expect(root.getByRole('option',{name:'Apple',exact:true})).toBeVisible();
 }finally{release();}
});
test('background preload is silent and global reference requests are anonymous without scope headers',async({page})=>{
 await login(page);const requests:import('@playwright/test').Request[]=[];page.on('request',r=>{if(r.url().includes('/api/device-directory/'))requests.push(r);});
 await page.goto('/app/repairs/new');const brand=await device(page);await openCatalogPicker(page,brand);await expect(pickerRoot(brand).getByRole('option',{name:'Apple',exact:true})).toBeVisible();
 for(const request of requests){const headers=await request.allHeaders();expect(headers.cookie).toBeUndefined();expect(headers.authorization).toBeUndefined();expect(headers['x-ct-store-id']).toBeUndefined();expect(headers['x-ct-catalog-scope']).toBeUndefined();}
 expect(requests).toHaveLength(2);
});
