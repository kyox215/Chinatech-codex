import {test,expect,type Locator,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {buildOfficeCommand,signOfficeToken,type OfficeToken} from '../../lib/toolbox/office-token';
const actions={install:'仅安装',activate:'仅激活',uninstall:'仅卸载',reinstall:'完整重装'} as const;
async function activate(locator:Locator){if(test.info().project.use.hasTouch)await locator.tap();else await locator.click();}
async function gateway(page:Page){
 const state={enabled:true,version:'1',fail:false,delay:0};
 await page.route('**/api/toolbox/office',async route=>{
  if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
  if(state.fail)return route.fulfill({status:503,json:{message:'Office 服务暂不可用，请稍后重试。'}});
  if(!state.enabled)return route.fulfill({status:403,json:{message:'Office 命令已停用。'}});
  const {action,terminal,language}=route.request().postDataJSON();
  const p:OfficeToken={v:1,action,epoch:state.version,digest:createHash('sha256').update('Fixture only').digest('hex')};
  const token=signOfficeToken(p,Buffer.alloc(32,29));
  await route.fulfill({json:{action,terminal,version:state.version,command:buildOfficeCommand('https://www.chinatech.in',token,p.digest,terminal,language),sourceUrl:'/api/toolbox/office/script?token='+token}});
 });return state;
}
test('eight controlled Office commands copy and download identical text without embedded payload',async({page})=>{
 await gateway(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {officeCopied:string}).officeCopied=text;}}}));
 await page.goto('/toolbox');await activate(page.getByRole('link',{name:'查看安装与激活命令',exact:true}));await expect(page).toHaveURL(/\/toolbox\/office$/);
 for(const [action,label]of Object.entries(actions)){
  await activate(page.getByRole('button',{name:new RegExp('^'+label)}));
  for(const terminal of ['powershell','cmd']){
   await activate(page.getByRole('button',{name:terminal==='cmd'?'CMD':'PowerShell',exact:true}));
   await expect(page.locator('pre code')).toContainText('powershell.exe');
   const command=(await page.locator('pre code').textContent())!;
   const loader=Buffer.from(command.split(' ').at(-1)!,'base64').toString('utf16le');
   expect(loader).toContain('/api/toolbox/office/script?token=');expect(loader).not.toContain('s1.kms.cx');expect(loader).not.toContain('FromBase64String');
   await expect(page.locator('.segmented-control__active')).toHaveText(terminal==='cmd'?'CMD':'PowerShell');
   await activate(page.getByRole('button',{name:'复制完整命令',exact:true}));await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('status')).toHaveText('命令已复制，请在所选管理员终端中粘贴。');
   expect(await page.evaluate(()=>(window as unknown as {officeCopied:string}).officeCopied)).toBe(command);
   const waiting=page.waitForEvent('download');await activate(page.getByRole('button',{name:'下载命令文本',exact:true}));const download=await waiting;
   expect(download.suggestedFilename()).toBe(`office-${action}-${terminal}.txt`);const stream=(await download.createReadStream())!;const parts:Buffer[]=[];for await(const part of stream)parts.push(Buffer.from(part));expect(Buffer.concat(parts).toString('utf8')).toBe(command+'\n');
   await expect(page.getByRole('link',{name:'查看当前操作脚本源码',exact:true})).toHaveAttribute('href',/\/api\/toolbox\/office\/script\?token=/);
  }
 }
 await activate(page.locator('header').getByRole('link',{name:'工具箱',exact:true}));await expect(page).toHaveURL(/\/toolbox$/);expect(errors).toEqual([]);
});
test('disabled or unavailable gateway hides old command and supports regeneration',async({page})=>{
 const state=await gateway(page);state.enabled=false;await page.goto('/toolbox/office');await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('alert')).toHaveText('Office 命令已停用。');await expect(page.getByRole('button',{name:'复制完整命令',exact:true})).toBeDisabled();await expect(page.locator('pre')).toHaveCount(0);
 state.enabled=true;await activate(page.getByRole('button',{name:'重新生成命令',exact:true}));await expect(page.locator('pre code')).toContainText('powershell.exe');
 const old=(await page.locator('pre code').textContent())!;state.version='3';await activate(page.getByRole('button',{name:'重新生成命令',exact:true}));await expect(page.locator('pre code')).not.toHaveText(old);
 state.fail=true;await activate(page.getByRole('button',{name:'重新生成命令',exact:true}));await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('alert')).toHaveText('Office 服务暂不可用，请稍后重试。');await expect(page.locator('pre')).toHaveCount(0);await expect(page.getByRole('button',{name:'下载命令文本',exact:true})).toBeDisabled();
 state.fail=false;await activate(page.getByRole('button',{name:'重新生成命令',exact:true}));await expect(page.locator('pre code')).toContainText('powershell.exe');
});
test('clipboard denial, missing API and delayed copy never claim success for another operation',async({page})=>{
 await gateway(page);await page.addInitScript(()=>{const state={reject:true,delayed:false,resolve:()=>{}};(window as unknown as {officeClipboard:typeof state}).officeClipboard=state;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{if(state.reject)throw new DOMException('Denied','NotAllowedError');if(state.delayed)await new Promise<void>(r=>{state.resolve=r;});}}});});
 await page.goto('/toolbox/office');const copy=page.getByRole('button',{name:'复制完整命令',exact:true});await expect(copy).toBeEnabled();await activate(copy);await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('alert')).toContainText('复制失败');
 await page.evaluate(()=>{const s=(window as unknown as {officeClipboard:{reject:boolean;delayed:boolean}}).officeClipboard;s.reject=false;});await activate(copy);await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('status')).toContainText('命令已复制');
 await page.evaluate(()=>{(window as unknown as {officeClipboard:{delayed:boolean}}).officeClipboard.delayed=true;});await activate(page.getByRole('button',{name:'已复制完整命令',exact:true}));await expect(page.getByRole('button',{name:'正在复制…',exact:true})).toBeDisabled();
 await activate(page.getByRole('button',{name:/^仅卸载/}));await expect(copy).toBeEnabled();await page.evaluate(()=>{(window as unknown as {officeClipboard:{resolve:()=>void}}).officeClipboard.resolve();});await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('status')).toHaveCount(0);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));await activate(copy);await expect(page.locator('section[aria-labelledby="operation-title"]').getByRole('alert')).toContainText('复制失败');
});

test('late generation response cannot replace the current action or terminal',async({page})=>{
 const state=await gateway(page);state.delay=150;await page.goto('/toolbox/office');
 await activate(page.getByRole('button',{name:/^仅卸载/}));await activate(page.getByRole('button',{name:'CMD',exact:true}));
 await expect(page.locator('pre code')).toContainText('powershell.exe');const command=(await page.locator('pre code').textContent())!;
 const source=Buffer.from(command.split(' ').at(-1)!,'base64').toString('utf16le');const token=source.match(/\?token=([^']+)'/)![1];
 expect(JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8')).action).toBe('uninstall');await expect(page.locator('.segmented-control__active')).toHaveText('CMD');
});
