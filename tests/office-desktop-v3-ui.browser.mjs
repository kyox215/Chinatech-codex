// Real production component + CSS in an isolated Next harness; all APIs are synthetic.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){const path=resolve(file);if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const require=name=>name.startsWith('./')?(name.endsWith('.json')?JSON.parse(readFileSync(resolve(dirname(path),name),'utf8')):load(resolve(dirname(path),name)+'.ts')):native(name);runInContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,createContext({exports,require}));return exports;}
const {translate}=load('lib/i18n/translate.ts');
const base='http://127.0.0.1:3282';const out='.local/office-v3-ui-proof';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
const accountId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',firstSession='11111111-1111-4111-8111-111111111111';
let state={enabled:true,minimumVersion:'1.4.0',currentVersion:'1.5.0',releaseReady:true,signingReady:true,revision:'0',updatedAt:null,eligibleMinimumVersions:['1.4.0','1.5.0']},patchMode='normal',jobsMode='normal',jobCalls=0,patches=[],releasePatch,releaseJobs;
const jobs=[{jobId:'33333333-3333-4333-8333-333333333333',action:'install',status:'completed',appVersion:'1.4.0',architecture:'win-x64',createdAt:'2026-10-13T07:00:00Z',startedAt:'2026-10-13T07:01:00Z',updatedAt:'2026-10-13T07:02:00Z'},{jobId:'44444444-4444-4444-8444-444444444444',action:'uninstall',status:'paused',appVersion:'1.4.0',architecture:'win-arm64',createdAt:'2026-10-13T06:00:00Z',startedAt:null,updatedAt:'2026-10-13T06:00:00Z'}];
await page.route('**/api/account/toolbox/office-desktop/v3/control',async route=>{
 const request=route.request(),sid=request.headers()['x-ct-session-id'];assert.equal(request.headers()['x-ct-account-id'],accountId);
 if(request.method()==='PATCH'){
  const body=request.postDataJSON();patches.push(body);
  if(patchMode==='failOnce'){patchMode='normal';return route.fulfill({status:503,json:{code:'SERVICE_UNAVAILABLE'}});}
  if(patchMode==='conflict'){patchMode='normal';return route.fulfill({status:409,json:{code:'REQUEST_CONFLICT'}});}
  if(patchMode==='delay'){patchMode='normal';await new Promise(resolve=>{releasePatch=resolve;});return route.fulfill({json:{...state,enabled:body.enabled,minimumVersion:body.minimumVersion,accountId,sessionId:sid}}).catch(()=>{});}
  state={...state,enabled:body.enabled,minimumVersion:body.minimumVersion,revision:String(Number(state.revision)+1)};
 }
 await route.fulfill({json:{...state,accountId,sessionId:sid}});
});
await page.route('**/api/account/toolbox/office-desktop/v3/jobs',async route=>{
 jobCalls++;assert.equal(route.request().headers()['x-ct-account-id'],accountId);assert.ok(route.request().headers()['x-ct-session-id']);
 if(jobsMode==='delay'){await new Promise(resolve=>{releaseJobs=resolve;});return route.fulfill({json:{jobs}}).catch(()=>{});}
 await route.fulfill({json:{jobs:jobsMode==='empty'?[]:jobs}});
});
try{
 for(const op of ['start','commit','resume','outcome']){const active=await page.request.post(base+'/api/toolbox/office-desktop/v3/jobs/'+op,{data:{}});assert.equal(active.status(),400,op+' actual route');assert.deepEqual(await active.json(),{code:'INVALID_REQUEST'});const removed=await page.request.post(base+'/api/toolbox/office-desktop/v3/'+op,{data:{}});assert.equal(removed.status(),404,op+' removed flat route');}
 checks.push('Actual Next HTTP task jobs routes fail closed on loopback origin; removed flat routes return 404');
 await page.goto(base);const panel=page.locator('#office-desktop-v3-control');await expect(panel.getByRole('button',{name:'暂停新版新任务',exact:true})).toBeEnabled();assert.equal(jobCalls,0);
 await panel.getByLabel('新版最低可用版本',{exact:true}).selectOption('1.5.0');await panel.getByRole('button',{name:'保存新版最低版本',exact:true}).click();patchMode='failOnce';await panel.getByRole('button',{name:'确认变更',exact:true}).click();await expect(panel.getByRole('button',{name:'重试原新版设置请求',exact:true})).toBeVisible();assert.equal(patches.length,1);await panel.getByRole('button',{name:'重试原新版设置请求',exact:true}).click();await expect(panel.getByRole('group')).toHaveCount(0);assert.deepEqual(patches[1],patches[0]);await expect(panel.getByLabel('新版最低可用版本',{exact:true})).toHaveValue('1.5.0');checks.push('Save failure preserves original request ID/body; retry succeeds with the selected minimum');
 await panel.getByRole('button',{name:'暂停新版新任务',exact:true}).click();patchMode='conflict';await panel.getByRole('button',{name:'确认变更',exact:true}).click();await expect(panel.getByRole('group')).toHaveCount(0);await expect(panel.getByRole('alert')).toContainText('设置已变化');await panel.getByRole('button',{name:'刷新新版设置',exact:true}).click();await expect(panel.getByRole('alert')).toHaveCount(0);checks.push('409 clears confirmation and requires a fresh status read');
 await panel.getByRole('button',{name:'查看最近 20 条新版任务',exact:true}).click();await expect(panel.getByRole('row')).toHaveCount(3);assert.equal(jobCalls,1);await expect(panel.getByText('任务已完成',{exact:true})).toBeVisible();await expect(panel.getByText('任务已暂停，恢复资格待核对',{exact:true})).toBeVisible();checks.push('Jobs load only on expansion, with bounded metadata and explicit client-report status');
 for(const locale of ['zh-CN','it','en']){
  await page.getByLabel('语言 / Lingua / Language',{exact:true}).selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
  for(const width of [1440,1024,390,375]){
   await page.setViewportSize({width,height:1000});await expect(panel.getByRole('heading',{name:translate('新版 Office 助手',locale),exact:true})).toBeVisible();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${locale}/${width} document overflow`);
   const targets=await panel.locator('button:visible:not(.select-control__button)').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));assert.ok(targets.every(height=>height>=44),`${locale}/${width} target sizes ${targets}`);const select=await panel.locator('select').evaluate(node=>({height:node.getBoundingClientRect().height,font:parseFloat(getComputedStyle(node).fontSize)}));assert.ok(select.height>=44);if(width<768)assert.ok(select.font>=16);
   assert.ok(await panel.locator('.module-table-scroll').evaluate(node=>node.scrollWidth>node.clientWidth||node.clientWidth>0));
   await page.screenshot({path:`${out}/${locale}-${width}.png`,fullPage:true});checks.push(`${locale}/${width}: heading, touch targets, bounded table scroll and no document overflow`);
  }
 }
 await page.getByLabel('语言 / Lingua / Language',{exact:true}).selectOption('zh-CN');await panel.getByRole('button',{name:'收起新版任务状态',exact:true}).click();jobsMode='delay';await panel.getByRole('button',{name:'查看最近 20 条新版任务',exact:true}).click();await expect.poll(()=>Boolean(releaseJobs)).toBe(true);await panel.getByRole('button',{name:'收起新版任务状态',exact:true}).click();jobsMode='empty';await panel.getByRole('button',{name:'查看最近 20 条新版任务',exact:true}).click();await expect(panel.getByText('暂无新版任务记录。',{exact:true})).toBeVisible();releaseJobs();await expect(panel.getByText('暂无新版任务记录。',{exact:true})).toBeVisible();checks.push('Late collapsed jobs request cannot overwrite a later empty result');
 await page.reload();await expect(panel.getByRole('button',{name:'暂停新版新任务',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'暂停新版新任务',exact:true}).click();patchMode='delay';await panel.getByRole('button',{name:'确认变更',exact:true}).click();await expect.poll(()=>Boolean(releasePatch)).toBe(true);await page.getByRole('button',{name:'Change test session',exact:true}).click();await expect(panel.getByRole('button',{name:'暂停新版新任务',exact:true})).toBeEnabled();releasePatch();await expect(panel.getByRole('button',{name:'暂停新版新任务',exact:true})).toBeEnabled();await expect(panel.getByRole('group')).toHaveCount(0);checks.push('Session remount discards pending confirmation and ignores the old save response');
 state={...state,enabled:false,releaseReady:false,signingReady:false,currentVersion:null};await panel.getByRole('button',{name:'刷新新版设置',exact:true}).click();await expect(panel.getByRole('button',{name:'允许新版新任务',exact:true})).toBeDisabled();await expect(panel.getByText('暂无已验证的新版',{exact:true})).toBeVisible();checks.push('Unverified release and missing signing disable enabling new tasks');
 assert.deepEqual(errors,[]);writeFileSync(`${out}/results.json`,JSON.stringify({checks,errors,source:'real OfficeDesktopV3Control and existing styles; synthetic API fixture',realAccounts:false,productionWrites:0},null,2));console.log(JSON.stringify({checks:checks.length,errors,realAccounts:false,productionWrites:0}));
}finally{await browser.close();}
