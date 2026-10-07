import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit, expect } from '@playwright/test';
export async function browserProof(owner,staff,storeId,pass,origin=process.env.LOGIN_DEVICES_ORIGIN || 'http://localhost:3117') {
 mkdirSync('.local/login-devices/screenshots',{recursive:true});const results=[];
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await engine.launch({headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'ct_store',value:storeId,domain:'localhost',path:'/'}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);writeFileSync('.local/login-devices/browser-error.json',JSON.stringify({message:e.message,stack:e.stack,path:new URL(page.url()).pathname},null,2));});
 await page.goto(origin+'/login');
 const checkbox=page.getByRole('checkbox',{name:'在此设备保持登录'});await expect(checkbox).toBeEnabled();await checkbox.check();
 for(const width of [1440,1024,390,375]) {await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok((await checkbox.locator('..').boundingBox()).height>=44);}
 await page.locator('#email').fill(staff.email);await page.locator('#password').fill(staff.password);
 await page.locator('.auth-submit').click();await page.waitForURL('**/app/dashboard');
 const other=await browser.newContext();const another=await other.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:staff.email,password:staff.password,remember:false}});assert.equal(another.status(),200);
 await page.setViewportSize({width:1440,height:1000});await page.getByLabel('账号菜单').click();await page.getByRole('link',{name:'账号设置',exact:true}).click();
 const protocol=await (await page.request.get(origin+'/api/auth/account/sessions')).json();assert.ok(protocol.actionableCount>0,'Final device-list protocol must count other sessions');
 await expect(page.getByRole('heading',{name:'登录设备',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'退出其他所有设备'})).toBeEnabled();
 const stored=(await context.cookies()).filter(cookie=>/^ct_rebuild_auth(?:\.\d+)?$/.test(cookie.name));
 const whole=stored.find(cookie=>cookie.name==='ct_rebuild_auth')?.value||stored.sort((a,b)=>Number(a.name.split('.')[1])-Number(b.name.split('.')[1])).map(cookie=>cookie.value).join('');
 const envelope=JSON.parse(Buffer.from(whole.slice(7),'base64url').toString()),parts=envelope.access_token.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());claims.exp=1;parts[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');envelope.access_token=parts.join('.');envelope.expires_at=1;envelope.expires_in=0;
 await context.clearCookies({name:/^ct_rebuild_auth(?:\.\d+)?$/});await context.addCookies([{name:'ct_rebuild_auth',value:'base64-'+Buffer.from(JSON.stringify(envelope)).toString('base64url'),domain:'localhost',path:'/',httpOnly:true,expires:Date.now()/1000+86400}]);
 await page.clock.setFixedTime(new Date(Date.now()+61000));
 const needsRefresh=page.waitForResponse(r=>r.url().endsWith('/api/auth/activity')&&r.status()===409);
 const refreshed=page.waitForResponse(r=>r.url().endsWith('/api/auth/account/session')&&r.status()===200);
 const renewed=page.waitForResponse(r=>r.url().endsWith('/api/auth/activity')&&r.status()===200);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await needsRefresh;await refreshed;await renewed;assert.equal(new URL(page.url()).pathname,'/account/settings');
 for(const locale of ['it','en','zh-CN']) {
 await page.getByLabel('语言 / Lingua / Language').selectOption(locale,{force:true});
 for(const width of [1440,1024,390,375]) {await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 }
 await page.screenshot({path:`.local/login-devices/screenshots/${name}-account-375.png`,fullPage:true});
 // Another tab shares cookies, while this page retains its old draft/confirmation.
 const switcher=await context.newPage();
 const signIn=async user=>{const response=await switcher.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:user.email,password:user.password,remember:true}});assert.equal(response.status(),200);};
 const focusAccount=async(event='focus')=>{await page.bringToFront();await page.evaluate(event=>window.dispatchEvent(new Event(event)),event);await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByText('当前设备',{exact:true})).toHaveCount(1);};
 const assertOldScope=async(previous,target)=>{
   const response=await switcher.request.post(origin+'/api/auth/account/sessions/revoke',{headers:{Origin:origin,'X-CT-Account-ID':previous.accountId,'X-CT-Session-ID':previous.sessionId},data:{requestId:crypto.randomUUID(),scope:'one',sessionId:target.id,revision:target.revision}});
   assert.equal(response.status(),409,'Old page scope must not revoke or sign out the replacement session');
   assert.equal((await switcher.request.get(origin+'/api/auth/account/session')).status(),200);
 };
 let previous=await (await page.request.get(origin+'/api/auth/account/sessions')).json();
 let target=previous.devices.find(device=>device.current);
 await expect(page.getByRole('textbox',{name:'新邮箱地址',exact:true})).toHaveCount(1);
 await page.getByRole('textbox',{name:'新邮箱地址',exact:true}).fill('unsubmitted@example.test');
 await page.locator(`[data-session-id="${target.id}"]`).getByRole('button',{name:'退出此设备',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await signIn(owner);await focusAccount();
 await expect(page.getByRole('textbox',{name:'新邮箱地址',exact:true})).toHaveCount(1);await expect(page.getByRole('textbox',{name:'新邮箱地址',exact:true})).toHaveValue('');await expect(page.getByText(owner.email,{exact:true}).first()).toBeVisible();
 const replacement=await (await page.request.get(origin+'/api/auth/account/sessions')).json();assert.equal(replacement.accountId,owner.id);
 await expect(page.locator(`[data-session-id="${replacement.sessionId}"]`).getByText('当前设备',{exact:true})).toBeVisible();await assertOldScope(previous,target);
 await signIn(staff);await focusAccount();await expect(page.getByText(staff.email,{exact:true}).first()).toBeVisible();
 previous=await (await page.request.get(origin+'/api/auth/account/sessions')).json();target=previous.devices.find(device=>device.current);
 await page.getByRole('textbox',{name:'新邮箱地址',exact:true}).fill('same-user-draft@example.test');
 await page.locator(`[data-session-id="${target.id}"]`).getByRole('button',{name:'退出此设备',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await signIn(staff);await focusAccount('online');await expect(page.getByRole('textbox',{name:'新邮箱地址',exact:true})).toHaveCount(1);await expect(page.getByRole('textbox',{name:'新邮箱地址',exact:true})).toHaveValue('');
 const relogin=await (await page.request.get(origin+'/api/auth/account/sessions')).json();assert.equal(relogin.accountId,previous.accountId);assert.notEqual(relogin.sessionId,previous.sessionId);
 await expect(page.locator(`[data-session-id="${relogin.sessionId}"]`).getByText('当前设备',{exact:true})).toBeVisible();await assertOldScope(previous,target);
 await switcher.close();
 // Personal remote logout, with a real confirmation dialog and reload.
 const attempts=[];
 await page.route('**/api/auth/account/sessions/revoke',async route=>{attempts.push(route.request().postDataJSON());if(attempts.length===1)await route.abort('failed');else await route.continue();});
 await page.getByRole('button',{name:'退出其他所有设备'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
 await focusAccount('online');await expect(page.getByRole('button',{name:'退出其他所有设备'})).toBeEnabled();
 await page.getByRole('button',{name:'退出其他所有设备'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByText('已退出所选登录设备', {exact:true})).toBeVisible();
 assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId,'Unknown network result retries the same operation within the verified session');await page.unroute('**/api/auth/account/sessions/revoke');
 await page.reload();await expect(page.getByText('当前设备',{exact:true})).toHaveCount(1);
 const saved=await context.storageState();const auth=saved.cookies.filter(c=>/^ct_rebuild_auth(?:\.\d+)?$/.test(c.name));assert.ok(auth.length);assert.ok(auth.every(c=>c.expires>Date.now()/1000));
 // A new browser context with persistent cookies represents reopening the browser.
 const reopened=await browser.newContext({storageState:saved});const again=await reopened.newPage();await again.goto(origin+'/account/settings');await expect(again.getByRole('heading',{name:'登录设备',exact:true})).toBeVisible();await reopened.close();
 // The replacement staff session must actually visit this store before its
 // owner can manage store-scoped access. Account activity alone is not a visit.
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin+'/app/dashboard');await page.waitForURL('**/app/dashboard');
 assert.equal((await page.request.get(origin+'/api/backend/state')).status(),200);
 assert.equal((await page.request.post(origin+'/api/auth/activity',{headers:{Origin:origin},data:{store:true}})).status(),200);
 await page.getByLabel('账号菜单').click();await page.getByRole('link',{name:'账号设置',exact:true}).click();
 await expect(page.getByRole('heading',{name:'登录设备',exact:true})).toBeVisible();
 const oc=await browser.newContext({viewport:{width:1440,height:1000}});const op=await oc.newPage();op.on('pageerror',e=>{errors.push(e.message);writeFileSync('.local/login-devices/browser-owner-error.json',JSON.stringify({message:e.message,stack:e.stack,path:new URL(op.url()).pathname},null,2));});await op.goto(origin+'/login');await expect(op.locator('#email')).toBeEnabled();await op.locator('#email').fill(owner.email);await op.locator('#password').fill(owner.password);await op.locator('.auth-submit').click();await op.waitForURL('**/app/dashboard');
 await oc.addCookies([{name:'ct_store',value:storeId,domain:'localhost',path:'/'}]);
 await op.getByLabel('账号菜单').click();await op.getByRole('link',{name:'门店设置',exact:true}).click();await op.getByRole('button',{name:'员工设置',exact:true}).click();await expect(op.getByRole('heading',{name:'员工登录设备',exact:true})).toBeVisible();
 const region=op.getByRole('region',{name:'员工登录设备'});await region.locator('select').selectOption({label:'Synthetic staff'},{force:true});await expect(region.getByRole('button',{name:'撤销该员工所有设备的本店访问'})).toBeEnabled();
 for(const locale of ['it','en','zh-CN']) {await op.getByLabel('语言 / Lingua / Language').selectOption(locale,{force:true});for(const width of [1440,1024,390,375]){await op.setViewportSize({width,height:1000});assert.equal(await op.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}}
 await op.setViewportSize({width:1440,height:1000});await op.screenshot({path:`.local/login-devices/screenshots/${name}-owner-1440.png`,fullPage:true});
 const employee=(await (await op.request.get(origin+'/api/backend/staff/sessions?memberId='+await region.locator('select').inputValue())).json());
 await region.getByRole('button',{name:'撤销该员工所有设备的本店访问'}).click();await expect(op.getByRole('dialog')).toBeVisible();
 const ownerTab=await oc.newPage();const ownerAgain=await ownerTab.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:owner.email,password:owner.password,remember:false}});assert.equal(ownerAgain.status(),200);
 await op.bringToFront();await op.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(op.getByRole('dialog')).not.toBeVisible();await expect(region.getByRole('button',{name:'撤销该员工所有设备的本店访问'})).toBeEnabled();
 const currentOwner=(await (await op.request.get(origin+'/api/backend/staff/sessions?memberId='+await region.locator('select').inputValue())).json());assert.notEqual(currentOwner.sessionId,employee.sessionId);
 const staleStore=await ownerTab.request.post(origin+'/api/backend/staff/sessions/revoke',{headers:{Origin:origin,'X-CT-Account-ID':employee.accountId,'X-CT-Session-ID':employee.sessionId},data:{requestId:crypto.randomUUID(),scope:'all',memberId:await region.locator('select').inputValue()}});assert.equal(staleStore.status(),409);await ownerTab.close();
 await region.getByRole('button',{name:'撤销该员工所有设备的本店访问'}).click();await op.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();await expect(op.getByRole('dialog')).not.toBeVisible();await expect(op.getByText('已撤销本门店访问',{exact:true}).first()).toBeVisible();
 await page.goto(origin+'/app/dashboard');await page.waitForURL('**/account/pending');
 await page.goto(origin+'/account/settings');await expect(page.getByRole('heading',{name:'登录设备',exact:true})).toBeVisible();
 // Self-store logout must leave the personal account session usable.
 await region.locator('select').selectOption({label:'Synthetic owner'},{force:true});
 await expect(region.getByText('当前设备',{exact:true})).toHaveCount(1);
 const ownList=await (await op.request.get(origin+'/api/backend/staff/sessions?memberId='+await region.locator('select').inputValue())).json();
 assert.ok(ownList.devices.filter(device=>!device.revoked).length>1,'Self revoke must include multiple already-visited owner store sessions');
 await region.getByRole('button',{name:'撤销该员工所有设备的本店访问'}).click();await expect(op.getByRole('dialog')).toBeVisible();
 const ownRevocation=op.waitForResponse(response=>response.url().endsWith('/api/backend/staff/sessions/revoke')&&response.request().method()==='POST');
 await op.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();
 const ownResult=await ownRevocation;assert.equal(ownResult.status(),200);assert.equal((await ownResult.json()).currentStoreRevoked,true);
 await op.waitForURL('**/account/pending');
 assert.equal((await op.request.get(origin+'/api/auth/account/session')).status(),200);assert.equal((await op.request.get(origin+'/api/backend/state')).status(),403);
 await op.goto(origin+'/account/settings');await expect(op.getByRole('heading',{name:'登录设备',exact:true})).toBeVisible();await expect(op.getByText('当前设备',{exact:true})).toHaveCount(1);
 assert.deepEqual(errors,[]);results.push(name);await oc.close();await other.close();await context.close();
 } finally {await browser.close();}
 }
 writeFileSync('.local/login-devices/browser.json',JSON.stringify({engines:results,widths:[1440,1024,390,375],languages:['zh-CN','it','en'],actualPhysicalDevice:false},null,2));pass('real Chromium/WebKit UI: four widths, three languages, browser reopen, personal logout, owner store-only revoke, cross-tab identity/session reset, stale-scope rejection and owner self-store logout');
}
