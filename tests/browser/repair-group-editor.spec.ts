import { test, expect, type Page } from "@playwright/test";
import { defaultStaffData } from "../../lib/staff";

const headings = (page: Page) => page.locator(".repair-group-toggle > span");
test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } })).status()).toBe(200);
});

test("owner renames, pointer-drags, saves, refreshes and shares groups between tabs", async ({ page, context }) => {
  await page.goto("/app/repairs");
  const other = await context.newPage(); await other.goto("/app/repairs");
  await page.getByRole("button",{name:"管理分组",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"管理维修分组"});
  await dialog.getByLabel("分组名称 久等 未答复",{exact:true}).fill("等待客户答复");
  const handle=dialog.getByRole("button",{name:"拖动分组 寄修",exact:true});
  const first=dialog.locator('[data-repair-group="awaiting_reply"]');
  const start=await handle.boundingBox();const end=await first.boundingBox();
  expect(start).not.toBeNull();expect(end).not.toBeNull();
  if (test.info().project.name === "chromium-desktop") {
    const touch = await context.newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x:start!.x+20, y:start!.y+20 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x:end!.x+20, y:end!.y+20 }] });
      await expect.poll(async()=> (await handle.boundingBox())!.y).toBeLessThan(start!.y-40);
      await expect.poll(async()=> (await first.boundingBox())!.y).toBeGreaterThan(end!.y+40);
      await page.screenshot({path:'.local/ui-proof/group-motion/chromium-touch-during-drag.png'});
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await touch.detach(); }
  } else {
    await page.mouse.move(start!.x+20,start!.y+20); await page.mouse.down();
    await page.mouse.move(end!.x+20,end!.y+20,{steps:8});
    await expect.poll(async()=> (await handle.boundingBox())!.y).toBeLessThan(start!.y-40);
    await expect.poll(async()=> (await first.boundingBox())!.y).toBeGreaterThan(end!.y+40);
    await page.screenshot({path:'.local/ui-proof/group-motion/webkit-during-drag.png'});
    await page.mouse.up();
  }
  await expect(dialog.locator('[data-repair-group]').first()).toHaveAttribute('data-repair-group','outsourced');
  await dialog.getByRole("button",{name:"保存分组",exact:true}).click();
  await expect(dialog).not.toBeVisible();await expect(headings(page).nth(0)).toHaveText("寄修");await expect(headings(page).nth(1)).toHaveText("等待客户答复");
  await expect(headings(other).nth(1)).toHaveText("等待客户答复");
  await page.reload();await expect(headings(page).nth(1)).toHaveText("等待客户答复");
  await page.getByRole("button",{name:"管理分组",exact:true}).click();
  await dialog.getByLabel("分组名称 等待客户答复",{exact:true}).fill("寄修");
  await dialog.getByRole("button",{name:"保存分组",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("重复");
  await dialog.getByRole("button",{name:"取消",exact:true}).click();await expect(headings(page).nth(1)).toHaveText("等待客户答复");
  await other.close();
});

test("viewer has no editor; delegated settings permission enables editor and revocation closes it", async ({ page }) => {
  const data=structuredClone(defaultStaffData);data.currentId="DEMO-VIEWER";
  await page.addInitScript(data=>localStorage.setItem('chinatech.m1.staff.v1',JSON.stringify({version:1,data})),data);
  await page.goto('/app/repairs');await expect(page.getByRole('button',{name:'管理分组',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('chinatech.m1.staff.v1')!);raw.data.members.find((m:{id:string})=>m.id==='DEMO-VIEWER').permissions.push('settings.edit');localStorage.setItem('chinatech.m1.staff.v1',JSON.stringify(raw));window.dispatchEvent(new Event('chinatech-staff-change'));});
  await page.getByRole('button',{name:'管理分组',exact:true}).click();const dialog=page.getByRole('dialog',{name:'管理维修分组'});
  await dialog.getByLabel('分组名称 寄修',{exact:true}).fill('不得保存的草稿');
  await page.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('chinatech.m1.staff.v1')!);raw.data.members.find((m:{id:string})=>m.id==='DEMO-VIEWER').permissions=['repairs.view'];localStorage.setItem('chinatech.m1.staff.v1',JSON.stringify(raw));window.dispatchEvent(new Event('chinatech-staff-change'));});
  await expect(dialog).not.toBeVisible();await expect(headings(page)).toContainText(['寄修']);
  expect(await page.evaluate(()=>localStorage.getItem('chinatech.m1.store-settings.v1'))).toBeNull();
});

test("concurrent edit is rejected and keyboard sorting works at four widths", async ({ page, context }) => {
  await page.goto('/app/repairs');await page.getByRole('button',{name:'管理分组',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'管理维修分组'});await dialog.getByLabel('分组名称 寄修',{exact:true}).fill('旧草稿');
  const other=await context.newPage();await other.goto('/app/repairs');await other.getByRole('button',{name:'管理分组',exact:true}).click();
  const newer=other.getByRole('dialog',{name:'管理维修分组'});await newer.getByLabel('分组名称 寄修',{exact:true}).fill('新设置');await newer.getByRole('button',{name:'保存分组',exact:true}).click();await expect(newer).not.toBeVisible();
  await dialog.getByRole('button',{name:'保存分组',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('变化');
  await dialog.getByRole('button',{name:'取消',exact:true}).click();await expect(headings(page)).toContainText(['新设置']);await other.close();
  await page.getByRole('button',{name:'管理分组',exact:true}).click();await dialog.getByRole('button',{name:'拖动分组 新设置',exact:true}).press('ArrowUp');
  await expect(dialog.locator('[data-repair-group]').nth(1)).toHaveAttribute('data-repair-group','outsourced');
  for(const width of [1440,1024,390,375]) {
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:`.local/ui-proof/group-editor/${test.info().project.name}-${width}.png`});
  }
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
});

test("parts group rename and order persist independently of workflow groups", async ({ page }) => {
  await page.goto('/app/repairs');
  const toggle=page.getByRole('button',{name:/^筛选/});if(test.info().project.use.isMobile)await toggle.click();
  await page.getByLabel('工单分组',{exact:true}).selectOption('parts');
  const original=await headings(page).allTextContents();
  await page.getByRole('button',{name:'管理分组',exact:true}).click();const dialog=page.getByRole('dialog',{name:'管理维修分组'});
  const name=dialog.locator('input').nth(1);await name.fill('待处理配件');
  await dialog.getByRole('button',{name:'上移分组 待处理配件',exact:true}).click();await dialog.getByRole('button',{name:'保存分组',exact:true}).click();
  await expect(headings(page)).toHaveText(['待处理配件',original[0],...original.slice(2)]);
  await page.reload();const nextToggle=page.getByRole('button',{name:/^筛选/});if(test.info().project.use.isMobile)await nextToggle.click();
  await expect(headings(page).first()).toHaveText('久等 未答复');
  await page.getByLabel('工单分组',{exact:true}).selectOption('parts');await expect(headings(page).first()).toHaveText('待处理配件');
  await expect(page.getByLabel('配件状态筛选').locator('option').nth(1)).toHaveText('待处理配件');
});

test("drag previews scroll at the edge, Escape cancels and reduced motion keeps live feedback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app/repairs');
  await page.getByRole('button',{name:'管理分组',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'管理维修分组'});
  const list=dialog.locator('[data-dragging]');
  const rows=dialog.locator('[data-repair-group]');
  const first=dialog.getByRole('button',{name:'拖动分组 久等 未答复',exact:true});
  const start=(await first.boundingBox())!;const second=(await rows.nth(1).boundingBox())!;
  await page.mouse.move(start.x+20,start.y+20);await page.mouse.down();await page.mouse.move(second.x+20,second.y+20,{steps:5});
  await expect(list).toHaveAttribute('data-dragging','true');
  await expect.poll(async()=> (await first.boundingBox())!.y).toBeGreaterThan(start.y+30);
  expect(await rows.nth(1).evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.00001);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(list).toHaveAttribute('data-dragging','false');await expect(dialog).toBeVisible();
  await expect(rows.first()).toHaveAttribute('data-repair-group','awaiting_reply');
  await expect(dialog.getByRole('button',{name:'保存分组',exact:true})).toBeDisabled();
  const bounds=(await list.boundingBox())!;const next=(await first.boundingBox())!;
  await page.mouse.move(next.x+20,next.y+20);await page.mouse.down();await page.mouse.move(next.x+20,bounds.y+bounds.height-8,{steps:12});
  await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(30);
  await expect.poll(async()=> (await dialog.getByRole('button',{name:'拖动分组 修好',exact:true}).boundingBox())!.y).toBeLessThan(bounds.y+bounds.height);
  await page.mouse.up();await expect(list).toHaveAttribute('data-dragging','false');
  await expect(dialog.getByRole('button',{name:'保存分组',exact:true})).toBeEnabled();
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await expect(headings(page).first()).toHaveText('久等 未答复');
});
