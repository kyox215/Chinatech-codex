import assert from 'node:assert/strict';import{readFileSync,mkdirSync,writeFileSync}from'node:fs';import{randomUUID}from'node:crypto';import{chromium,webkit,expect}from'@playwright/test';
const f=JSON.parse(readFileSync('.local/office-desktop/fixture.private.json'));if(f.origin!=='http://127.0.0.1:3162')throw Error('Local fixture required');const suffix=randomUUID().slice(0,8);const user=f.users.find(x=>x.role==='admin');const errors=[],checks=[];mkdirSync('.local/office-desktop/proof/screenshots',{recursive:true});
for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addCookies(user.cookies);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(f.origin+'/account/settings');const panel=page.locator('#office-desktop');await expect(panel).toBeVisible();await expect(panel.getByRole('button',{name:'生成使用密钥',exact:true})).toBeEnabled();
 await panel.getByLabel('密钥名称',{exact:true}).fill('Browser '+name+' '+suffix);await panel.getByLabel('设备上限',{exact:true}).fill('2');await panel.getByRole('button',{name:'生成使用密钥',exact:true}).click();await expect(panel.locator('code')).toContainText('CTO-');const row=panel.getByRole('row').filter({hasText:'Browser '+name+' '+suffix});await expect(row).toHaveCount(1);await row.getByRole('button',{name:'停用密钥',exact:true}).click();await expect(row.getByRole('button',{name:'重新启用密钥',exact:true})).toBeVisible();await expect(panel.locator('code')).toHaveCount(0);await row.getByRole('button',{name:'重新启用密钥',exact:true}).click();await expect(row.getByRole('button',{name:'停用密钥',exact:true})).toBeVisible();checks.push(name+': real create / key clears / disable / enable');
 for(const locale of ['zh-CN','it','en']){
  await page.getByLabel('语言 / Lingua / Language',{exact:true}).selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
  for(const width of [1440,1024,390,375]){
   await page.setViewportSize({width,height:1100});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+locale+width+' overflow');
   const dimensions=await panel.locator('input').evaluateAll(inputs=>inputs.map(i=>({type:i.type,height:i.getBoundingClientRect().height,font:parseFloat(getComputedStyle(i).fontSize)})));assert.ok(dimensions.every(i=>i.height>=44&&i.font>=16),JSON.stringify({width,dimensions}));
   await page.screenshot({path:`.local/office-desktop/proof/screenshots/${name}-${locale}-${width}.png`,fullPage:false});checks.push(`${name}/${locale}/${width}`);
  }
 }
 await page.reload();await expect(panel).toBeVisible();await expect(panel.locator('code')).toHaveCount(0);checks.push(name+': refresh reloads real state without exposing key');
 await context.close();await browser.close();
}
assert.deepEqual(errors,[]);writeFileSync('.local/office-desktop/proof/browser-results.json',JSON.stringify({checks,count:checks.length,environment:'actual local Auth/API/database, synthetic accounts',jsErrors:errors,production:false},null,2));console.log('PASS',checks.length,'local browser checks');
