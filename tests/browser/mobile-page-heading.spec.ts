import { test, expect, type Page, type Locator } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";
import { defaultStaffData } from "../../lib/staff";
import { translate } from "../../lib/i18n/translate";
import { languageStorageKey, type Locale } from "../../lib/i18n/locale";

async function login(page: Page) {
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
}
async function sameRow(page: Page, action: Locator) {
  await expect(action).toBeVisible();
  const menu = page.locator(".module-heading .page-menu-button");
  const a = await action.boundingBox(), m = await menu.boundingBox();
  expect(a).not.toBeNull(); expect(m).not.toBeNull();
  expect(a!.width).toBeGreaterThanOrEqual(44); expect(a!.height).toBeGreaterThanOrEqual(44);
  expect(m!.width).toBeGreaterThanOrEqual(44); expect(m!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(a!.y + a!.height / 2 - m!.y - m!.height / 2)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("商品三语四宽标题紧凑且同型号新建、菜单与返回仍可操作", async ({ page }, info) => {
  await login(page);
  const unit = retailUnits[1];
  for (const locale of ["zh-CN", "it", "en"] as Locale[]) {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: languageStorageKey, value: locale });
    await page.goto(`/app/retail/units/${unit.id}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const copy = page.getByRole("link", { name: translate("同型号新建", locale), exact: true });
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: 900 });
      if (width < 768) await sameRow(page, copy);
      else await expect(copy.getByText(translate("同型号新建", locale), { exact: true })).toBeVisible();
      await expect(page.locator(".module-title h2")).toHaveText(translate("商品档案", locale));
      await expect(page.locator(".module-title .status-pill")).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:`.local/mobile-heading/visual/${info.project.name}-${locale}-375.png`,animations:"disabled"});
    const menu = page.locator(".page-menu-button");
    await menu.click(); await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.locator(".app-sidebar__close").click(); await expect(menu).toHaveAttribute("aria-expanded", "false");
    await copy.click(); await expect(page).toHaveURL(new RegExp(`/app/retail/new\\?copy=${unit.id}$`));
    await expect(page.locator(".module-title h2")).toHaveText(translate("同型号新建商品", locale));
    await page.locator(".page-back-button").click(); await expect(page).toHaveURL(/\/app\/retail$/);
  }
});

test("客户和采购操作同排，工单打印入口可打开关闭", async ({ page }) => {
  await login(page); await page.setViewportSize({width:375,height:900});
  await page.goto("/app/customers");
  const add = page.getByRole("button", {name:"新建客户",exact:true});
  await sameRow(page,add); await add.click();
  const name = page.getByRole("textbox",{name:"客户称呼（选填）",exact:true});
  await name.fill("DEMO 未保存布局验收");
  await page.getByRole("button",{name:"取消",exact:true}).click(); await expect(name).toHaveCount(0);
  await page.getByRole("region",{name:"客户列表",exact:true}).locator('a[href^="/app/customers/"]').first().click();
  const edit = page.getByRole("button",{name:"编辑客户资料",exact:true}); await sameRow(page,edit);
  await edit.click(); await expect(name).toBeVisible(); await page.getByRole("button",{name:"取消",exact:true}).click();
  await page.goto("/app/customer-devices");
  await sameRow(page,page.locator(".module-heading > .button"));
  await page.goto("/app/procurement/PO-2026-0101");
  const repair = page.locator(".module-heading .page-toolbar-action"); await sameRow(page,repair);
  await repair.click(); await expect(page).toHaveURL(/\/app\/repairs\/CT-2026-0929$/);
  const print = page.getByRole("button",{name:"打印接机单",exact:true}); await sameRow(page,print);
  await print.click(); await expect(page.locator("dialog[open]")).toBeVisible();
  await page.locator("dialog[open] .intake-receipt-toolbar > .icon-button").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("只读列表仅识码时与标题同排且权限未扩展", async ({ page }) => {
  const staff = structuredClone(defaultStaffData); staff.currentId = "DEMO-VIEWER";
  await page.addInitScript(data=>localStorage.setItem("chinatech.m1.staff.v1",JSON.stringify({version:1,data})),staff);
  await login(page);
  for (const [route,label,forbidden] of [["/app/retail","识码查找","新建商品"],["/app/repairs","扫码查单","新建工单"]]) {
    await page.goto(route);
    for (const width of [390,375]) {
      await page.setViewportSize({width,height:900});
      await sameRow(page,page.getByRole("button",{name:label,exact:true}));
      await expect(page.getByRole("link",{name:forbidden,exact:true})).toHaveCount(0);
    }
  }
});


test("长意语采购状态保持完整且不覆盖标题行操作", async ({ page }) => {
  await page.addInitScript(({key})=>localStorage.setItem(key,"it"),{key:languageStorageKey});
  await login(page);
  for (const id of ["PO-2026-0105", "PO-2026-0106"]) {
    await page.goto(`/app/procurement/${id}`);
    for (const width of [390,375]) {
      await page.setViewportSize({width,height:900});
      const action=page.locator(".module-heading .page-toolbar-action");
      await sameRow(page,action);
      const badge=page.locator(".module-title .status-pill");
      await expect(badge).toBeVisible();
      const b=await badge.boundingBox(), c=await page.locator(".module-title__content").boundingBox(), a=await action.boundingBox();
      expect(b!.x).toBeGreaterThanOrEqual(c!.x-1);
      expect(b!.x+b!.width).toBeLessThanOrEqual(c!.x+c!.width+1);
      expect(b!.x+b!.width).toBeLessThan(a!.x);
      expect(await badge.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    }
  }
});
