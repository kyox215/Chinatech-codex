import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium, webkit, expect } from '@playwright/test';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const messages={};
new Function('exports',ts.transpileModule(readFileSync('lib/i18n/public.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(messages);
const tr=(key,locale)=>locale==='zh-CN'?key:messages.publicMessages[key]?.[locale==='it'?0:1]??key;
const origin=process.env.PORTAL_ORIGIN??'http://127.0.0.1:3284';
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const out=resolve(process.env.PORTAL_PROOF_DIR??'../../../.company-tmp/modern-portal-20261023/browser');mkdirSync(out,{recursive:true});
const results=[],errors=[],css=new Map();
async function revealSearch(page,locale){const search=page.locator('#portal-search');if(!await search.isVisible())await page.getByRole('button',{name:tr('搜索首页功能',locale),exact:true}).click();return search;}
async function fit(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflows');}
async function touchTarget(link){const b=await link.boundingBox();assert(b&&b.width>=44&&b.height>=44,`small target ${JSON.stringify(b)}`);}
async function settled(page){await expect(page.locator('[data-content-progress][data-active=true]')).toHaveCount(0);}
async function playing(video){await expect.poll(()=>video.evaluate(v=>({playing:!v.paused&&v.currentTime>0,error:v.error?.code??null})),{timeout:30000}).toEqual({playing:true,error:null});const before=await video.evaluate(v=>v.currentTime);await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:10000}).toBeGreaterThan(before);return video.evaluate(v=>v.currentTime);}
try{
 for(const [engine,type]of Object.entries({chromium,webkit}).filter(([engine])=>!process.env.PORTAL_ENGINE||process.env.PORTAL_ENGINE===engine)){
  const browser=await type.launch({headless:true});
  try{
   for(const locale of (process.env.PORTAL_ONLY_FLOW?[]:['zh-CN','it','en'])){
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(locale=>localStorage.setItem('chinatech.language',locale),locale);
    const page=await context.newPage();page.on('pageerror',e=>errors.push({engine,locale,message:e.message}));
    page.on('response',async response=>{if(response.url().includes('/_next/')&&response.url().includes('.css'))try{const body=await response.body();css.set(response.url(),{sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length});}catch{}});
    try{
     for(const width of [1440,1024,390,375]){
      await page.setViewportSize({width,height:width<768?844:1000});
      for(const path of ['/','/repair','/cinema'].filter(path=>!process.env.PORTAL_ONLY_HOME||path==='/')){
       await page.goto(origin+path);await expect(page.locator('html')).toHaveAttribute('lang',locale);await settled(page);await fit(page);
       const login=page.locator('header a[href="/login"]'),register=page.locator('header a[href="/register"]');await expect(login).toBeInViewport();await expect(register).toBeInViewport();await touchTarget(login);await touchTarget(register);
       await expect(page.getByLabel('语言 / Lingua / Language')).toBeInViewport();
       if(path==='/'){
        await expect(page.locator('h1')).toHaveText(tr('我的数字空间',locale)+' '+tr('发现好用功能',locale));await expect(page).toHaveTitle(new RegExp(tr('我的数字空间',locale)));
        await expect(page.locator('[data-feature]')).toHaveCount(3);await expect(page.locator('video')).toHaveCount(0);await expect(page.locator('a[href="/toolbox"]')).toHaveCount(0);
        for(const id of ['repair','cinema'])await touchTarget(page.locator(`[data-feature=${id}] a`));
        await expect(page.locator('a[href^="/toolbox"]')).toHaveCount(0);
        await expect(page.locator('body')).not.toContainText(/Windows|Office|MobileTrans/);
        const search=await revealSearch(page,locale);
        assert(Number(await search.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)))>=16);
        await page.locator('button[aria-pressed]').nth(1).click();
        await expect(page.locator('[data-feature]')).toHaveCount(1);
        await expect(page.locator('[data-feature=repair]')).toBeVisible();
        await page.locator('button[aria-pressed]').nth(2).click();
        await expect(page.locator('[data-feature]')).toHaveCount(1);
        await expect(page.locator('[data-feature=cinema]')).toBeVisible();
        await page.locator('button[aria-pressed]').nth(3).click();await expect(page.locator('[data-feature]')).toHaveCount(1);await expect(page.locator('[data-feature=currentflow]')).toBeVisible();
        await page.locator('button[aria-pressed]').nth(0).click();
        await revealSearch(page,locale);await search.fill('Windows'); await expect(page.locator('[data-feature]')).toHaveCount(0);
        await expect(page.locator('#portal-results .button')).toHaveCount(1);
        await page.locator('#portal-results .button').click(); await expect(page.locator('[data-feature]')).toHaveCount(3);
        await revealSearch(page,locale);await search.fill(tr('放映室',locale)); await expect(page.locator('[data-feature]')).toHaveCount(1);
        await search.fill('CurrentFlow');await expect(page.locator('[data-feature=currentflow]')).toHaveCount(1);await search.fill('');await page.keyboard.press('Escape');
        await expect(page.locator('[data-feature] img')).toHaveCount(0);
        const source=page.locator('[data-feature=currentflow] a').nth(0),download=page.locator('[data-feature=currentflow] a').nth(1);await touchTarget(source);await touchTarget(download);await expect(source).toHaveAttribute('href','https://github.com/kyox215/CurrentFlow');await expect(download).toHaveAttribute('href','https://github.com/kyox215/CurrentFlow/releases/latest');for(const link of [source,download]){await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel',/noopener/);}await expect(page.locator('[data-feature=currentflow]')).toContainText('macOS 13+ · Apple Silicon');
        for(const icon of await page.locator('[data-feature] [data-kind] svg').all()) {
          const b=await icon.boundingBox(); assert(b&&b.width===40&&b.height===40);
        }
        for(const id of ['repair','cinema']) {
          await page.locator(`[data-feature=${id}]`).evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
          const href=await page.locator(`[data-feature=${id}]`).evaluate(e=>{const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+22,b.y+22)?.closest('a')?.getAttribute('href');});
          assert.equal(href,'/'+id,'card icon area must use the real entrance link');
        }
        const a=await page.locator('[data-feature=repair]').boundingBox(),b=await page.locator('[data-feature=cinema]').boundingBox();
        const columns=width>=1200?3:width>768?2:1;
        if(columns>1)assert.equal(a.y,b.y,'desktop entrances must share a row');else assert(b.y>=a.y+a.height,'mobile cards must stack');
        const grid=page.locator('[data-feature=repair]').locator('..');
        assert.equal(await grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),columns);
        const expected=(await grid.boundingBox()).width;assert(Math.abs(a.width-(expected-(columns-1)*(width>768?16:12))/columns)<1,'card width must follow reference columns');
        const hero=page.locator('main img');await expect(hero).toHaveCount(1);await expect.poll(()=>hero.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
        await grid.evaluate(e=>{const original=[...e.children];for(let i=0;i<5;i++){const n=original[i%original.length].cloneNode(true);n.setAttribute('data-layout-fixture','true');n.removeAttribute('data-feature');n.removeAttribute('aria-labelledby');n.removeAttribute('aria-describedby');n.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));e.append(n);}});
        await fit(page);
        const layout=await grid.evaluate(e=>[...e.children].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
        assert.equal(layout.filter(n=>n.y===layout[0].y).length,columns,'future cards do not fill the configured row');
        assert(layout[columns].y>=layout[0].y+layout[0].height,'future rows overlap');
        await grid.locator('[data-layout-fixture]').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
        assert.equal(await page.locator('[data-feature=repair]').evaluate(e=>getComputedStyle(e).borderRadius),'16px');
       }else{
        await expect(page.getByRole('navigation',{name:tr('页面位置',locale)}).locator('[aria-current=page]')).toHaveText(tr(path==='/repair'?'手机维修管理':'放映室',locale));
        await touchTarget(page.getByRole('navigation',{name:tr('页面位置',locale)}).locator('a[href="/"]'));
        if(path==='/repair'){
         for(const id of ['features','tutorials','workflow','questions'])await expect(page.locator('#'+id)).toHaveCount(1);
         await expect(page.locator('header a[href="/toolbox"]')).toBeVisible();await expect(page.locator('#cinema')).toHaveCount(0);await expect(page.locator('#tutorials video track')).toHaveCount(1);
        }else{
         await expect(page.locator('h1')).toHaveText(tr('放映室',locale));await expect(page.locator('video')).toHaveCount(1);await expect(page.locator('video track')).toHaveCount(0);await expect(page.locator('button[aria-pressed]')).toHaveCount(3);assert.equal(await page.locator('video').getAttribute('src'),null);
        }
       }
       if(path==='/') { await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo({top:0,behavior:'instant'});}); await expect(page.locator('h1')).toBeInViewport(); }
       if((locale==='zh-CN'&&[1440,375].includes(width))||(path==='/'&&width===375))await page.screenshot({path:resolve(out,`${engine}-${locale}-${width}-${path==='/'?'portal':path.slice(1)}.png`),fullPage:path!=='/repair'});
       results.push({engine,locale,width,path,status:'passed'});
      }
     }
    }finally{await context.close();}
   }
   if(process.env.PORTAL_ONLY_HOME)continue;
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push({engine,flow:true,message:e.message,stack:e.stack,url:page.url()}));page.on('requestfailed',r=>{if(r.url().includes('/api/auth/status'))writeFileSync(resolve(out,'auth-failures.jsonl'),JSON.stringify({url:page.url(),request:r.url(),failure:r.failure()})+'\n',{flag:'a'});});
   try{
    await page.goto(origin);await page.locator('[data-feature=repair] a').press('Enter');await expect(page).toHaveURL(origin+'/repair');await page.goBack();await expect(page).toHaveURL(origin+'/');
    await page.locator('[data-feature=cinema] a').click();await expect(page).toHaveURL(origin+'/cinema');await page.goBack();await expect(page).toHaveURL(origin+'/');await page.goForward();await expect(page).toHaveURL(origin+'/cinema');
    await page.getByRole('navigation',{name:'页面位置'}).locator('a').click();await expect(page).toHaveURL(origin+'/');
    for(const section of ['features','tutorials','workflow','questions','cinema']){
     await page.goto(origin+'/?source=bookmark#'+section);await expect(page).toHaveURL(origin+(section==='cinema'?'/cinema?source=bookmark':'/repair?source=bookmark#'+section));
    }
    await page.goto(origin+'/#unknown');await expect(page.locator('[data-feature]')).toHaveCount(3);await expect(page).toHaveURL(origin+'/#unknown');
    await page.goto(origin+'/repair');await page.getByRole('link',{name:'观看使用教程',exact:true}).click();await expect(page).toHaveURL(origin+'/repair#tutorials');
    await page.evaluate(()=>scrollTo(0,0));await page.getByRole('link',{name:'观看使用教程',exact:true}).press('Enter');
    const bounds=await page.locator('#tutorials').boundingBox(),header=await page.locator('header').boundingBox();assert(bounds.y>=header.y+header.height,'anchor covered by header');
    await page.goto(origin);await page.locator('header a[href="/login"]').click();await expect(page).toHaveURL(origin+'/login');await page.locator('header a[href="/"]').first().click();await expect(page).toHaveURL(origin+'/');
    await page.locator('header a[href="/register"]').click();await expect(page).toHaveURL(origin+'/register');await page.locator('header a[href="/"]').first().click();await expect(page).toHaveURL(origin+'/');
    await page.goto(origin+'/app/dashboard');await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.goto(origin+'/repair');await page.locator('header a[href="/toolbox"]').click();await expect(page).toHaveURL(origin+'/toolbox');await fit(page);await page.locator('header a[href="/"]').click();await expect(page).toHaveURL(origin+'/');
    const skip=page.getByRole('link',{name:'跳到主要内容'});await skip.focus();await skip.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
    await page.goto(origin+'/cinema');const video=page.locator('video');
    const starts=[];for(let index=0;index<3;index++){
     await page.locator('button[aria-pressed]').nth(index).click();assert.equal(await video.getAttribute('src'),null);await page.getByRole('button',{name:/^播放影片：/}).click();starts.push(await playing(video));
    }
    const old=await video.elementHandle();await page.getByRole('navigation',{name:'页面位置'}).locator('a').click();await expect(page).toHaveURL(origin+'/');assert(await old.evaluate(v=>v.paused&&!v.hasAttribute('src')));await old.dispose();
    await page.goto(origin+'/repair#tutorials');const tutorial=page.locator('#tutorials video');await page.getByRole('button',{name:/^播放教程：/}).click();const tutorialTime=await playing(tutorial);await expect(tutorial.locator('track')).toHaveAttribute('srclang','zh-CN');await tutorial.evaluate(v=>{v.textTracks[0].mode='showing';});await expect.poll(()=>tutorial.evaluate(v=>v.textTracks[0].cues?.length??0)).toBeGreaterThan(0);
    results.push({engine,flow:'navigation/bookmarks/keyboard/auth-links/anonymous-protection/toolbox/media-release',status:'passed',filmStartTimes:starts,tutorialTime});
   }finally{await context.close();}
   const fixtureContext=await browser.newContext({viewport:{width:375,height:844}});const fixturePage=await fixtureContext.newPage();const posts=[];
   await fixturePage.route('**/api/auth/status',route=>route.fulfill({json:{state:'workspace',scope:'synthetic-portal',formal:true,account:{name:'Synthetic owner',email:'owner@example.test'},store:{name:'Synthetic shop',role:'owner'}}}));
   await fixturePage.route('**/api/auth/activity',route=>{posts.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});});
   try{
    for(const path of ['/','/repair','/cinema'].filter(path=>!process.env.PORTAL_ONLY_HOME||path==='/')){await fixturePage.goto(origin+path);await expect(fixturePage.locator('header details summary')).toContainText('Synthetic owner');await touchTarget(fixturePage.locator('header details summary'));await fit(fixturePage);await fixturePage.locator('header details summary').click();await expect(fixturePage.getByRole('region',{name:'账号详情'})).toContainText('Synthetic shop');await expect(fixturePage.getByRole('region',{name:'账号详情'}).getByRole('link',{name:'账号设置',exact:true})).toHaveAttribute('href','/account/settings');await fixturePage.keyboard.press('Escape');}
    assert(posts.every(body=>body.store===false));results.push({engine,flow:'synthetic-signed-in-header',status:'passed',activityPosts:posts.length,boundary:'Display/API fixtures only; no real sign-in, membership or store writes.'});
   }finally{await fixtureContext.close();}
  }finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'results.json'),JSON.stringify({origin,status:'passed',results,errors,css:[...css.values()],boundary:'Local production build; emulated viewports in Chromium and WebKit. Anonymous flows use real local endpoints; signed-in headers use explicit fixtures. No physical phones, production auth or business writes.'},null,2));
 console.log(`PASS ${results.length} UI/flow cases; 0 page errors; ${css.size} served CSS assets`);
}catch(error){writeFileSync(resolve(out,'failed-results.json'),JSON.stringify({origin,status:'failed',error:String(error),stack:error.stack,results,errors},null,2));throw error;}
