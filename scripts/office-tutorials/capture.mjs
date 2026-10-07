import {chromium,expect} from '@playwright/test';
import path from 'node:path';
import {setup,work,locales,ids,save} from './author.mjs';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
const gateway=createContext({exports:{},require:createRequire(import.meta.url),Buffer,URL,process:{env:{}}});
runInContext(ts.transpileModule(await fs.readFile(new URL('../../lib/toolbox/office-token.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,gateway);
const digest=gateway.exports.scriptDigest(Buffer.from('Inert tutorial fixture; never executed.'));
function fixtureCommand(action,terminal,language){const token=gateway.exports.signOfficeToken({v:1,action,epoch:'1',digest},Buffer.alloc(32,17));return{action,terminal,version:'1',command:gateway.exports.buildOfficeCommand('https://www.chinatech.in',token,digest,terminal,language),sourceUrl:'/api/toolbox/office/script?token='+token};}
import {publicMessages} from '../../lib/i18n/public.ts';
const origin=process.env.OFFICE_CAPTURE_ORIGIN??'http://127.0.0.1:3147';
if(!['http://127.0.0.1:3147','http://127.0.0.1:3159'].includes(origin))throw Error('Only the explicitly isolated local previews 3147/3159 are accepted.');
await setup();const browser=await chromium.launch(),records={};
try{for(const locale of locales){const page=await browser.newPage({viewport:{width:1440,height:860},deviceScaleFactor:1});
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.route('**/api/toolbox/office',route=>{const {action,terminal,language}=route.request().postDataJSON();return route.fulfill({json:fixtureCommand(action,terminal,language)});});
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.officeVideoCopy=text;}}});});
 const t=text=>locale==='zh-CN'?text:publicMessages[text]?.[locale==='it'?0:1]??text;
 async function screenshot(target,name,after){
  await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=await target.boundingBox();if(!bounds||bounds.x<0||bounds.y<0||bounds.x+bounds.width>1441||bounds.y+bounds.height>861)throw Error('Target must be visible in actual viewport: '+name);
  const file=path.join(work,'captures',`${locale}-${name}${after?'-after':''}.png`);await page.screenshot({path:file,animations:'disabled'});
  return{file:path.relative(process.cwd(),file),width:1440,height:860,highlight:bounds,documentLanguage:await page.locator('html').getAttribute('lang'),source:origin+'/toolbox/office',targetLabel:await target.innerText()};
 }
 for(const [index,id] of ids.entries()){
  await page.goto(origin+'/toolbox/office');await page.getByLabel('语言 / Lingua / Language',{exact:true}).selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
  const choices=page.locator('main aside button');const target=choices.nth(index);
  const first=await screenshot(target,id+'-1');await target.click();await expect(page.locator('pre code')).toHaveText(fixtureCommand(id,'powershell',locale).command);const after=await screenshot(target,id+'-1',true);records[`${locale}.${id}.1`]={...first,after:after.file};
  records[`${locale}.${id}.2`]=await screenshot(page.locator('[data-destructive]'),id+'-2');
  records[`${locale}.${id}.3`]=await screenshot(page.getByRole('button',{name:'PowerShell',exact:true}),id+'-3');
  const copy=page.getByRole('button',{name:t('复制完整命令'),exact:true});const fourth=await screenshot(copy,id+'-4');await copy.click();await expect(page.locator('[id^="command-"] [role="status"]')).toHaveText(t('命令已复制，请在所选管理员终端中粘贴。'));
  if(await page.evaluate(()=>window.officeVideoCopy)!==fixtureCommand(id,'powershell',locale).command)throw Error('Capture copied wrong command.');
  const copied=await screenshot(page.locator('[id^="command-"] [role="status"]'),id+'-4',true);records[`${locale}.${id}.4`]={...fourth,after:copied.file,clipboard:'in-memory demonstration, generated synthetic launcher bytes checked; never executed'};
  const details=page.locator('[aria-labelledby="usage-title"]');records[`${locale}.${id}.6`]=await screenshot(details,id+'-6');console.log(`Captured ${locale}/${id}`);
 }
 await page.close();
}}finally{await browser.close();}
await save(path.join(work,'captures.json'),records);
