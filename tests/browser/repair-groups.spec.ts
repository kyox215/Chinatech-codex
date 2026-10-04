import { test, expect, type Page } from "@playwright/test";
import { defaultStoreSettings } from "../../lib/store-settings";
import { defaultRepairGroups } from "../../lib/repair-groups";
import { repairOrders, type RepairStatus } from "../../lib/repair-fixtures";

async function filters(page: Page) {
  const toggle = page.getByRole("button", { name: /^筛选/ });
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await expect(page.getByLabel("维修阶段筛选")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "填入演示账号", exact: true }).click();
  await page.getByRole("button", { name: "登录工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

test("Stage group order, void filter and stable two-field sorting", async ({ page }) => {
  const statuses: RepairStatus[] = ["awaiting_reply", "outsourced", "repairing", "ready", "completed", "cancelled"];
  const workflows = Object.fromEntries(repairOrders.map((order, index) => [order.id, { revision: 0, status: statuses[index], custody: "store", notice: null, events: [], updatedAt: "2026-10-02 08:00:00" }]));
  await page.addInitScript(data => localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: data })), workflows);
  await page.goto("/app/repairs");
  const names = page.locator(".repair-group-toggle > span");
  const groupNames = ["寄修", "待检测", "待确认", "待配件", "维修中", "待测试", "待取机", "维修结束", "作废"];
  await expect(names).toHaveText(groupNames);
  await expect(page.locator("#repair-group-testing small")).toHaveText("0");
  await page.locator("#repair-group-testing").click();
  await expect(page.locator("#repair-group-rows-testing")).toHaveText("暂无符合条件的工单");
  await filters(page);
  await expect(page.getByLabel("工单分组")).toHaveValue("workflow");
  await page.getByLabel("维修阶段筛选").selectOption("including_cancelled");
  await expect(names).toHaveText(groupNames);
  await page.getByLabel("工单分组").selectOption("none");
  const expected = [...repairOrders].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(order=>order.id);
  expect(await page.locator(".repair-module-row").evaluateAll(rows=>rows.map(row=>row.getAttribute("aria-label")!.split(" ")[0]))).toEqual(expected);
  await page.getByLabel("维修阶段筛选").selectOption("all");
  expect(await page.locator(".repair-module-row").evaluateAll(rows=>rows.map(row=>row.getAttribute("aria-label")!.split(" ")[0]))).toEqual(expected.filter(id=>id!==repairOrders[5].id));
});

test("stage save moves to the new group, restores focus, persists and appears in detail", async ({ page }) => {
  await page.goto("/app/repairs");
  await expect(page.locator(".repair-group-toggle").first()).toBeVisible(); for (const id of await page.locator(".repair-group-toggle[aria-expanded=false]").evaluateAll(rows => rows.map(row => row.id))) await page.locator(`#${id}`).click();
  const stage = page.getByRole("button",{name:"CT-2026-0929 更改维修阶段",exact:true});
  await stage.click();
  const dialog = page.getByRole("dialog",{name:"更改维修阶段"});
  await dialog.getByRole("button",{name:"待取机",exact:true}).click();
  await dialog.getByRole("button",{name:"保存阶段",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#repair-group-ready")).toHaveAttribute("aria-expanded","true");
  await expect(stage).toBeFocused();
  await page.reload();
  await expect(page.locator("#repair-group-ready")).toBeVisible();
  if (await page.locator("#repair-group-ready").getAttribute("aria-expanded") === "false") await page.locator("#repair-group-ready").click();
  await expect(stage).toHaveText("待取机");
  await page.getByRole("link",{name:"打开 CT-2026-0929 iPhone 15 Pro 详情",exact:true}).click();
  await expect(stage).toHaveText("待取机");
});

test("ready contact is separate from stage and survives save/reload", async ({ page }) => {
  await page.goto("/app/repairs/CT-2026-0929");
  await page.getByRole("button",{name:"CT-2026-0929 更改维修阶段",exact:true}).click();
  const stage=page.getByRole("dialog",{name:"更改维修阶段"});
  await expect(stage.getByRole("button",{name:"修好已通知",exact:true})).toHaveCount(0);
  await stage.getByRole("button",{name:"取消",exact:true}).click();
  await page.goto("/app/repairs/CT-2026-0921");
  await page.getByRole("button",{name:"CT-2026-0921 联系与跟进",exact:true}).click();
  const contact=page.getByRole("dialog",{name:"工单联系与跟进"});
  await contact.getByRole("button",{name:"已实际成功通知取机",exact:true}).click();
  await page.goto("/app/repairs");
  await expect(page.locator("#repair-group-ready_notified")).toHaveCount(0);
  if (await page.locator("#repair-group-ready").getAttribute("aria-expanded") === "false") await page.locator("#repair-group-ready").click();
  await expect(page.locator("#repair-group-rows-ready")).toContainText("已通知取机");
  for(const width of [1440,1024,390,375]) {
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole("heading",{name:"维修工单",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    if (width < 768) await expect.poll(()=>page.locator('.app-sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    await page.screenshot({path:`.local/ui-proof/seatable-groups/${test.info().project.name}-${width}.png`});
  }
});

test("all stages move to their own group through filters without changing procurement or communication", async ({page}) => {
  test.setTimeout(120000);
  await page.goto('/app/repairs');await filters(page);
  await page.getByLabel('维修阶段筛选').selectOption('awaiting_quote');
  await page.locator('#repair-group-awaiting_quote').click();
  const id = 'CT-2026-0929';
  const stage = page.getByRole('button',{name:`${id} 更改维修阶段`,exact:true});
  const procurement = await page.evaluate(()=>localStorage.getItem('chinatech.m1.procurement.v1'));
  const stages = [['待检测','diagnosis'],['待配件','awaiting_parts'],['维修中','processing'],['待测试','testing'],['寄修','outsourced'],['待取机','ready'],['维修结束','complete'],['作废','cancelled'],['待确认','awaiting_quote']];
  for (const [label,key] of stages) {
    await stage.click();const dialog=page.getByRole('dialog',{name:'更改维修阶段'});
    await dialog.getByRole('button',{name:label,exact:true}).click();
    await dialog.getByLabel('维修阶段变更原因',{exact:true}).fill('本地合成阶段核对');
    await dialog.getByRole('button',{name:'保存阶段',exact:true}).click();
    await expect(dialog).not.toBeVisible();
    const target=page.locator(`#repair-group-rows-${key}`);
    await expect(target.getByRole('button',{name:`${id} 更改维修阶段`,exact:true})).toHaveText(label);
    await expect(page.locator(`#repair-group-${key}`)).toHaveAttribute('aria-expanded','true');
    await expect(stage).toBeFocused();
    await expect(page.getByRole('article',{name:`${id} iPhone 15 Pro`,exact:true})).toHaveCount(1);
    expect(await page.evaluate(()=>localStorage.getItem('chinatech.m1.procurement.v1'))).toBe(procurement);
  }
  await page.reload();await expect(page.locator('#repair-group-awaiting_quote')).toHaveAttribute('aria-expanded','true');
  await expect(stage).toHaveText('待确认');
  const workflow=await page.evaluate(id=>JSON.parse(localStorage.getItem('chinatech.m1.repair-workflow.v1')!).workflows[id],id);
  expect(workflow.events).toHaveLength(stages.length);
  expect(workflow.events.every((event:{type:string})=>event.type==='stage')).toBe(true);
  expect(workflow.notice).toBeNull();expect(workflow.handedOver).toBeUndefined();
  await page.getByLabel('维修阶段筛选').selectOption('all');
  await stage.click();const dialog=page.getByRole('dialog',{name:'更改维修阶段'});
  await dialog.getByRole('button',{name:'作废',exact:true}).click();
  await dialog.getByLabel('维修阶段变更原因',{exact:true}).fill('本地合成取消原因');
  await dialog.getByRole('button',{name:'保存阶段',exact:true}).click();
  await expect(page.getByLabel('维修阶段筛选')).toHaveValue('including_cancelled');
  await expect(page.locator('#repair-group-rows-cancelled').getByRole('button',{name:`${id} 更改维修阶段`,exact:true})).toHaveText('作废');
});

test("legacy store group labels become stage labels on read and raw settings stay untouched", async ({page}) => {
  const groups=defaultRepairGroups();
  groups.workflow=groups.workflow.filter(row=>!['diagnosis','awaiting_quote','awaiting_parts','testing'].includes(row.key)).map(row=>({...row,label:row.key==='processing'?'维修':row.key==='complete'?'完成':row.label}));
  const raw=JSON.stringify({version:1,settings:{...defaultStoreSettings,repairGroups:groups}});
  await page.addInitScript(raw=>localStorage.setItem('chinatech.m1.store-settings.v1',raw),raw);
  await page.goto('/app/repairs');
  await expect(page.locator('.repair-group-toggle > span')).toHaveText(['寄修','待检测','待确认','待配件','维修中','待测试','待取机','维修结束','作废']);
  expect(await page.evaluate(()=>localStorage.getItem('chinatech.m1.store-settings.v1'))).toBe(raw);
});
