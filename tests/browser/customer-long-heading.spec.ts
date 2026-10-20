import{test,expect}from'@playwright/test';
import{readFileSync}from'node:fs';
import{translate}from'../../lib/i18n/translate';
const accountFile=process.env.CT_PERF_FIXTURE,historyFile=process.env.CT_PERF_CUSTOMER_HISTORY;
test.skip(!accountFile||!historyFile,'Explicit owned local historical customer and identity required');
const account=accountFile?JSON.parse(readFileSync(accountFile,'utf8')):null,history=historyFile?JSON.parse(readFileSync(historyFile,'utf8')):null;
for(const locale of['zh-CN','it','en']as const)test(`long original customer name keeps heading and actual return accessible ${locale}`,async({page},info)=>{
 const base=String(info.project.use.baseURL);expect(base).toMatch(/^https?:\/\/localhost:318[79]$/);
 await page.addInitScript(locale=>localStorage.setItem('chinatech.language',locale),locale);
 const login=await page.request.post('/api/auth/login',{headers:{Origin:base},data:{email:account.email,password:account.password,remember:false}});expect(login.status()).toBe(200);
 await page.context().addCookies([{name:'ct_store',value:account.storeId,url:base}]);
 const row=history.rows[50],id='PHONE-'+row.phone.slice(1),t=(value:string)=>translate(value,locale),measurements=[];
 for(const width of[1440,1024,390,375]){
  await page.setViewportSize({width,height:812});await page.goto('/app/customers/'+id+'?returnTo='+encodeURIComponent('/app/customers?q='+row.suffix));
  const heading=page.locator('.module-heading h2'),back=page.getByRole('link',{name:t('返回客户列表'),exact:true});
  await expect(heading).toHaveText('名'.repeat(80)+'…');
  const facts=page.locator('.device-facts span').filter({has:page.locator('small').filter({hasText:t('客户称呼')})}).locator('strong');
  await expect.poll(()=>facts.textContent().then(value=>value?.length)).toBe(10000);
  expect(await facts.textContent().then(value=>value?.endsWith(row.suffix))).toBe(true);
  const geometry=await page.locator('.module-heading').evaluate(node=>({height:node.getBoundingClientRect().height,bottom:node.getBoundingClientRect().bottom,viewport:innerHeight}));
  expect(geometry.height).toBeLessThan(300);expect(geometry.bottom).toBeLessThan(geometry.viewport/2);await expect(back).toBeInViewport();
  if(width<768){const size=await back.boundingBox();expect(size!.width).toBeGreaterThanOrEqual(44);expect(size!.height).toBeGreaterThanOrEqual(44);}
  await back.click();await expect(page).toHaveURL(/\/app\/customers\?/);await expect(page.locator('#customer-'+id)).toBeVisible();
  measurements.push({width,...geometry});
 }
 await info.attach('historical-name-heading-and-return',{body:JSON.stringify({buildId:readFileSync('.next-backend/BUILD_ID','utf8').trim(),locale,originalLength:10000,headingLength:81,measurements}),contentType:'application/json'});
});
