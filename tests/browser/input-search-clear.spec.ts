import {expect,test,type Page} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {buildInfiniteListFixture} from './helpers/infinite-list-fixture';

// Actual InputControl, feedback hooks, LanguageProvider and existing CSS.
// No backend/identity seams, network, storage mutation or app navigation.
const run=process.env.CT_INPUT_SEARCH_RUN??'source-first';if(!/^[a-z0-9-]+$/.test(run))throw Error('Explicit safe proof run name required');
const compiled=process.env.CT_INPUT_SEARCH_COMPILED==='1';
const entry=String.raw`
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{InputControl}from'@/components/input-control';
import{LanguageProvider,useLanguage}from'@/components/language-provider';
const api=window.searchClear={clears:0,customChanges:0,nativeChanges:0,textClears:0};
function Case(){const{setLocale}=useLanguage(),[custom,setCustom]=useState(''),[native,setNative]=useState(''),[text,setText]=useState('DEMO text');api.setLocale=setLocale;
 return<main style={{width:'min(480px,calc(100vw - 32px))',margin:16}}>
 <div className="module-search" data-case="custom"><InputControl type="search" aria-label="DEMO custom search" ref={node=>{api.input=node}} value={custom} onChange={event=>{api.customChanges++;setCustom(event.target.value)}} onClear={()=>{api.clears++;setCustom('')}}/></div>
 <div className="module-search" data-case="native"><InputControl type="search" aria-label="DEMO native search" value={native} onChange={event=>{api.nativeChanges++;setNative(event.target.value)}}/></div>
 <div className="module-search" data-case="text"><InputControl type="text" aria-label="DEMO text" value={text} onChange={event=>setText(event.target.value)} onClear={()=>{api.textClears++;setText('')}}/></div>
 <div className="module-search" data-case="disabled"><InputControl type="search" aria-label="DEMO disabled search" disabled value="DEMO disabled" onClear={()=>{throw Error('Disabled clear')}}/></div>
 <div className="module-search" data-case="readonly"><InputControl type="search" aria-label="DEMO readonly search" readOnly value="DEMO readonly" onClear={()=>{throw Error('Readonly clear')}}/></div>
 </main>;
}createRoot(document.getElementById('root')).render(<LanguageProvider><Case/></LanguageProvider>);
`;
type Fixture=Window&{searchClear:{clears:number;customChanges:number;nativeChanges:number;textClears:number;input:HTMLInputElement;setLocale:(locale:string)=>void}};
async function mount(page:Page,locale:string){
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const cssFiles=compiled?readdirSync(resolve(process.env.CT_PERF_BUILD_DIR??'.next-backend','static/chunks')).filter(name=>name.endsWith('.css')).map(name=>resolve(process.env.CT_PERF_BUILD_DIR??'.next-backend','static/chunks',name)):[resolve('app/globals.css')];
 const cssInputs=Object.fromEntries(cssFiles.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));let css=cssFiles.map(file=>readFileSync(file,'utf8')).join('\n');
 expect(css).toContain('::-webkit-search-cancel-button');
 await test.info().attach('input-search-css-inputs',{contentType:'application/json',body:Buffer.from(JSON.stringify({condition:compiled?'Exact compiled CSS assets':'Source CSS component fixture; production CSS is a later verification',cssInputs,isMobile:test.info().project.use.isMobile,hasTouch:test.info().project.use.hasTouch}))});
 css=css.replace(/url\((["']?)\/fonts\/([^"')]+)\1\)/g,(_match,_quote,file)=>`url(data:font/woff2;base64,${readFileSync(resolve('public/fonts',file)).toString('base64')})`);
 await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div>`);
 await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry,seams:[],actualIcons:true})});
 await expect(page.getByRole('searchbox',{name:'DEMO custom search'})).toBeVisible();
 await page.evaluate(value=>(window as unknown as Fixture).searchClear.setLocale(value),locale);
 await expect(page.locator('html')).toHaveAttribute('lang',locale);return errors;
}
for(const locale of ['zh-CN','it','en'])test(`search owns one clear action and native-only search remains native (${locale})`,async({page},info)=>{
 const errors=await mount(page,locale),label=locale==='zh-CN'?'清空输入':locale==='it'?'Cancella campo':'Clear input';
 const custom=page.getByRole('searchbox',{name:'DEMO custom search'}),native=page.getByRole('searchbox',{name:'DEMO native search'}),customCase=page.locator('[data-case="custom"]');
 const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
 for(const width of[1440,1024,390,375]){
  await page.setViewportSize({width,height:950});await custom.fill('DEMO search');
  const clear=customCase.getByRole('button',{name:label,exact:true});await expect(clear).toBeVisible();
  const box=await clear.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await custom.evaluate(node=>node.matches('.input-control__body:has(.input-control__clear) > input[type="search"]'))).toBe(true);
  const inputBox=await custom.boundingBox(),before=await page.evaluate(()=>(window as unknown as Fixture).searchClear.clears);
  // Prove the absolute click lands in the input content before exercising it.
  // Locator-relative positions on padded search controls differ by engine.
  const contentPoint={x:Math.min(inputBox!.x+inputBox!.width-60,box!.x-8),y:inputBox!.y+inputBox!.height/2};
  expect(contentPoint.x).toBeGreaterThan(inputBox!.x);
  const hit=await custom.evaluate((node,point)=>({matches:document.elementFromPoint(point.x,point.y)===node,target:document.elementFromPoint(point.x,point.y)?.outerHTML,icon:node.parentElement?.querySelector('svg')?.getBoundingClientRect().toJSON()}),contentPoint);
  await test.info().attach(`custom-point-${width}`,{contentType:'application/json',body:Buffer.from(JSON.stringify({inputBox,clearBox:box,contentPoint,hit}))});
  expect(hit.matches).toBe(true);expect(hit.icon?.width).toBe(16);expect(hit.icon?.height).toBe(16);
  await page.mouse.click(contentPoint.x,contentPoint.y);await expect(custom).toHaveValue('DEMO search');
  if(info.project.use.hasTouch)await clear.tap();else if(width>=768){await custom.focus();await custom.press('Tab');await expect(clear).toBeFocused();await clear.press('Enter');}else await clear.click();await expect(custom).toHaveValue('');await expect(custom).toBeFocused();
  expect(await page.evaluate(()=>(window as unknown as Fixture).searchClear.clears)).toBe(before+1);
  expect(await custom.evaluate(node=>(window as unknown as Fixture).searchClear.input===node)).toBe(true);
  await custom.fill('DEMO refill');await expect(clear).toBeVisible();await expect(custom).toHaveValue('DEMO refill');
  if(width<768)expect(await custom.evaluate(node=>getComputedStyle(node).fontSize)).toBe('16px');
  await native.fill('DEMO native');expect(await native.evaluate(node=>node.matches('.input-control__body:has(.input-control__clear) > input[type="search"]'))).toBe(false);
  await expect(page.locator('[data-case="native"] button')).toHaveCount(0);const nativeBox=await native.boundingBox();
  const nativeChanges=await page.evaluate(()=>(window as unknown as Fixture).searchClear.nativeChanges);
  const nativeFont=await native.evaluate(node=>Number.parseFloat(getComputedStyle(node).fontSize));
  // The native UA glyph is inside the input inline end (one half-em center).
  const nativePoint={x:nativeBox!.x+nativeBox!.width-nativeFont/2,y:nativeBox!.y+nativeBox!.height/2};
  expect(await native.evaluate((node,point)=>document.elementFromPoint(point.x,point.y)===node,nativePoint)).toBe(true);
  await test.info().attach(`native-point-${width}`,{contentType:'application/json',body:Buffer.from(JSON.stringify({nativeBox,nativePoint,nativeFont}))});
  await page.mouse.click(nativePoint.x,nativePoint.y);await expect(native).toHaveValue('');
  expect(await page.evaluate(()=>(window as unknown as Fixture).searchClear.nativeChanges)).toBe(nativeChanges+1);
  await expect(page.locator('[data-case="disabled"] button')).toHaveCount(0);await expect(page.locator('[data-case="readonly"] button')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===375)await page.screenshot({path:`../proof/input-search-clear-${run}-${info.project.name}-${locale}-375.png`});
 }
 await page.locator('[data-case="text"]').getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('textbox',{name:'DEMO text'})).toHaveValue('');
 expect(await page.evaluate(()=>(window as unknown as Fixture).searchClear.textClears)).toBe(1);expect(errors).toEqual([]);expect(requests).toEqual([]);
});
