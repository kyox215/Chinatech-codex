import {chromium,expect} from '@playwright/test';
import path from 'node:path';
import {setup,work,locales,ids,save} from './author.mjs';
import {officeCommands} from '../../lib/toolbox/office-commands.ts';
import {publicMessages} from '../../lib/i18n/public.ts';
const origin=process.env.OFFICE_CAPTURE_ORIGIN??'http://127.0.0.1:3147';
if(origin!=='http://127.0.0.1:3147')throw Error('Only isolated local preview 3147 is accepted.');
await setup();const browser=await chromium.launch(),records={};
try{for(const locale of locales){const page=await browser.newPage({viewport:{width:1440,height:860},deviceScaleFactor:1});
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
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
  const first=await screenshot(target,id+'-1');await target.click();await expect(page.locator('pre code')).toHaveText(officeCommands[index].commands.powershell);const after=await screenshot(target,id+'-1',true);records[`${locale}.${id}.1`]={...first,after:after.file};
  records[`${locale}.${id}.2`]=await screenshot(page.locator('[data-destructive]'),id+'-2');
  records[`${locale}.${id}.3`]=await screenshot(page.getByRole('button',{name:'PowerShell',exact:true}),id+'-3');
  const copy=page.getByRole('button',{name:t('复制完整命令'),exact:true});const fourth=await screenshot(copy,id+'-4');await copy.click();await expect(page.locator('[id^="command-"] [role="status"]')).toHaveText(t('命令已复制，请在所选管理员终端中粘贴。'));
  if(await page.evaluate(()=>window.officeVideoCopy)!==officeCommands[index].commands.powershell)throw Error('Capture copied wrong command.');
  const copied=await screenshot(page.locator('[id^="command-"] [role="status"]'),id+'-4',true);records[`${locale}.${id}.4`]={...fourth,after:copied.file,clipboard:'in-memory demonstration, exact source bytes checked'};
  const details=page.locator('[aria-labelledby="usage-title"]');records[`${locale}.${id}.6`]=await screenshot(details,id+'-6');console.log(`Captured ${locale}/${id}`);
 }
 await page.close();
}}finally{await browser.close();}
await save(path.join(work,'captures.json'),records);
