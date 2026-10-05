import { test, expect, type Page } from "@playwright/test";
import { defaultStoreSettings } from "../../lib/store-settings";
import { defaultRepairGroups } from "../../lib/repair-groups";
import { repairOrders, type RepairStatus } from "../../lib/repair-fixtures";
async function filters(page:Page) { const toggle=page.getByRole('button',{name:/^筛选/});await expect(toggle).toBeVisible();if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await expect(page.getByLabel('维修阶段筛选')).toBeVisible(); }
async function emptyPurchases(page:Page) {await page.addInitScript(()=>{if(localStorage.getItem('four-groups-empty-seeded'))return;localStorage.setItem('four-groups-empty-seeded','1');localStorage.setItem('chinatech.m1.procurement.v1',JSON.stringify({version:1,records:[],repairUpdates:{}}));});}
test.beforeEach(async({page})=>{await page.goto('/login');await page.getByRole('button',{name:'填入演示账号',exact:true}).click();await page.getByRole('button',{name:'登录工作台',exact:true}).click();await expect(page).toHaveURL(/\/app\/dashboard$/);});

test('four daily groups hide empty rows; history and all preserve sorting and facts',async({page})=>{
 await emptyPurchases(page);const statuses:RepairStatus[]=['awaiting_reply','outsourced','repairing','ready','completed','cancelled'];
 const workflows=Object.fromEntries(repairOrders.map((order,index)=>[order.id,{revision:0,status:statuses[index],custody:'store',notice:null,events:[],updatedAt:'2026-10-02 08:00:00'}]));
 await page.addInitScript(data=>localStorage.setItem('chinatech.m1.repair-workflow.v1',JSON.stringify({version:1,workflows:data})),workflows);
 await page.goto('/app/repairs');await expect(page.locator('.repair-group-toggle > span')).toHaveText(['处理中','等取机']);
 await expect(page.locator('#repair-group-processing')).toHaveAttribute('aria-expanded','true');await page.locator('#repair-group-processing').click();await page.reload();await expect(page.locator('#repair-group-processing')).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:/^历史工单/}).click();await expect(page.locator('.repair-module-row')).toHaveCount(2);await expect(page.locator('.repair-module-row')).toContainText(['维修结束','作废']);
 await page.getByRole('button',{name:/^全部工单/}).click();await filters(page);await page.getByLabel('工单分组').selectOption('none');await page.getByLabel('工单排序').selectOption('created');
 const expected=[...repairOrders].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(row=>row.id);
 expect(await page.locator('.repair-module-row').evaluateAll(rows=>rows.map(row=>row.getAttribute('aria-label')!.split(' ')[0]))).toEqual(expected);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chinatech.m1.repair-workflow.v1')!).workflows)).toEqual(workflows);
});

test('stage save follows the group, restores focus and persists in detail',async({page})=>{
 await emptyPurchases(page);await page.goto('/app/repairs');const stage=page.getByRole('button',{name:'CT-2026-0929 更改维修阶段',exact:true});await stage.click();const dialog=page.getByRole('dialog',{name:'更改维修阶段'});
 await dialog.getByRole('button',{name:'修好，等取机',exact:true}).click();await dialog.getByRole('button',{name:'保存阶段',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('#repair-group-ready')).toHaveAttribute('aria-expanded','true');await expect(stage).toBeFocused();await expect(stage).toHaveText('未通知');
 await page.reload();await expect(stage).toHaveText('未通知');await page.getByRole('link',{name:'打开 CT-2026-0929 iPhone 15 Pro 详情',exact:true}).click();await expect(stage).toHaveText('未通知');
});

test('pickup subfilters count actual notification, unsuccessful contact remains unnotified, refresh retains filter',async({page})=>{
 await page.goto('/app/repairs');const notices=page.getByRole('group',{name:'等取机通知筛选'});await notices.getByRole('button',{name:/^未通知/}).click();const contactButton=page.getByRole('button',{name:'CT-2026-0921 联系与跟进',exact:true});await contactButton.click();const contact=page.getByRole('dialog',{name:'工单联系与跟进'});
 await contact.getByRole('button',{name:'本次未接通',exact:true}).click();await expect(notices.getByRole('button',{name:/^未通知/})).toHaveAttribute('aria-pressed','true');await expect(page.locator('#repair-stage-CT-2026-0921')).toHaveText('未通知');
 await contactButton.click();await contact.getByRole('button',{name:'已实际成功通知取机',exact:true}).click();await expect(notices.getByRole('button',{name:'已通知 1',exact:true})).toHaveAttribute('aria-pressed','true');await expect(contactButton).toBeFocused();await expect(page.locator('#repair-stage-CT-2026-0921')).toHaveText('已通知');
 await page.reload();await expect(notices.getByRole('button',{name:'已通知 1',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const width of [1440,1024,390,375]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);for(const button of await notices.getByRole('button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);await page.screenshot({path:`.local/ui-proof/four-groups/${test.info().project.name}-${width}.png`});}
});

test('all child stages follow filtered saves through daily and history without changing procurement',async({page})=>{
 test.setTimeout(120000);await emptyPurchases(page);await page.goto('/app/repairs');await filters(page);await page.getByLabel('维修阶段筛选').selectOption('awaiting_quote');
 const id='CT-2026-0929', stage=page.getByRole('button',{name:`${id} 更改维修阶段`,exact:true});const procurement=await page.evaluate(()=>localStorage.getItem('chinatech.m1.procurement.v1'));
 const stages=[['待检测','processing','待检测'],['待选配件','processing','待选配件'],['维修中','processing','维修中'],['待测试','processing','待测试'],['寄修','processing','寄修'],['修好，等取机','ready','未通知'],['维修结束','all','维修结束'],['作废','all','作废'],['待确认','processing','待确认']];
 for(const [label,key,display] of stages) {await stage.click();const dialog=page.getByRole('dialog',{name:'更改维修阶段'});await dialog.getByRole('button',{name:label,exact:true}).click();await dialog.getByLabel('维修阶段变更原因',{exact:true}).fill('本地合成阶段核对');await dialog.getByRole('button',{name:'保存阶段',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator(`#repair-group-rows-${key}`).getByRole('button',{name:`${id} 更改维修阶段`,exact:true})).toHaveText(display);await expect(stage).toBeFocused();await expect(page.getByRole('article',{name:`${id} iPhone 15 Pro`,exact:true})).toHaveCount(1);expect(await page.evaluate(()=>localStorage.getItem('chinatech.m1.procurement.v1'))).toBe(procurement);}
 await page.reload();await expect(stage).toHaveText('待确认');const flow=await page.evaluate(id=>JSON.parse(localStorage.getItem('chinatech.m1.repair-workflow.v1')!).workflows[id],id);expect(flow.events).toHaveLength(stages.length);expect(flow.events.every((event:{type:string})=>event.type==='stage')).toBe(true);expect(flow.notice).toBeNull();expect(flow.handedOver).toBeUndefined();
});

test('old eleven group configuration adopts four standard names without rewriting raw settings',async({page})=>{
 const groups=defaultRepairGroups();groups.workflow=groups.workflow.filter(row=>!['rework','diagnosis','awaiting_quote','awaiting_parts','testing'].includes(row.key)).map(row=>({...row,label:row.key==='processing'?'维修':row.key==='complete'?'完成':row.label}));const raw=JSON.stringify({version:1,settings:{...defaultStoreSettings,repairGroups:groups}});
 await page.addInitScript(raw=>localStorage.setItem('chinatech.m1.store-settings.v1',raw),raw);await page.goto('/app/repairs');await expect(page.locator('.repair-group-toggle > span')).toHaveText(['处理中','等配件','等取机']);expect(await page.evaluate(()=>localStorage.getItem('chinatech.m1.store-settings.v1'))).toBe(raw);
});
