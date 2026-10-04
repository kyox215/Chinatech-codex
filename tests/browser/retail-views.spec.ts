import { test, expect, type Page } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";
import { parseStoredRetailUnits } from "../../lib/retail";

const fixtures = retailUnits.map((unit,index) => ({...unit, condition:index === 0 ? "新机" as const : "翻新机" as const}));
test.beforeEach(async ({page}) => {
  await page.goto("/login");
  await page.getByRole("button", {name:"填入演示账号",exact:true}).click();
  await page.getByRole("button", {name:"登录工作台",exact:true}).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});
async function seedUnits(page: Page, units=fixtures) {
  parseStoredRetailUnits(JSON.stringify({version:1,units}), []);
  await page.addInitScript(data=>localStorage.setItem("chinatech.m1.retail.v1",JSON.stringify({version:1,units:data})),units);
}
test("整机首页先显示在售，新机翻新机独立切换并在刷新后保留",async({page})=>{
  await seedUnits(page);
  await page.goto("/app/retail");
  const table=page.getByRole("region",{name:"整机商品表格",exact:true});
  const available=fixtures.filter(unit=>unit.status==="available");
  await expect(table.getByRole("link")).toHaveCount(available.length);
  await expect(page.getByRole("link",{name:`在售商品 ${available.length}`,exact:true})).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:"新机 1",exact:true}).click();
  await expect(table.getByRole("link")).toHaveCount(1);
  await expect(table.getByRole("link")).toHaveAttribute("href", `/app/retail/units/${fixtures[0].id}`);
  await page.reload();
  await expect(page.getByRole("button",{name:"新机 1",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:`翻新机 ${available.length-1}`,exact:true}).click();
  await expect(table.getByRole("link")).toHaveCount(available.length-1);
  await expect(table.locator(`a[href="/app/retail/units/${fixtures[0].id}"]`)).toHaveCount(0);
});
test("已售独立历史，其他状态仍可查，单机管理入口保留",async({page})=>{
  await seedUnits(page);
  await page.goto("/app/retail?view=sold");
  const table=page.getByRole("region",{name:"整机商品表格",exact:true});
  await expect(table.getByRole("link")).toHaveCount(1);
  await expect(table).toContainText("Galaxy S21");
  await page.getByRole("link",{name:/^其他状态 \d+$/}).click();
  await expect(table.getByRole("link")).toHaveCount(fixtures.filter(u=>u.status!=="available"&&u.status!=="sold").length);
  await expect(page.getByRole("combobox",{name:"其他状态筛选",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"单机管理",exact:true}).click();
  await expect(page.getByRole("button",{name:"识码查找",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"返回在售商品",exact:true}).click();
  await expect(page.getByRole("link",{name:/^在售商品 \d+$/})).toHaveAttribute("aria-current","page");
});

test("默认名称排序、精简空字段，搜索编号及详情返回继续可用",async({page},testInfo)=>{
  await seedUnits(page);
  await page.goto("/app/retail");
  const table=page.getByRole("region",{name:"整机商品表格",exact:true});
  const titles=table.locator("a strong");
  const expected=["Apple iPad 9","Apple iPhone 13","Nintendo Switch OLED","Sony PS5 Digital"];
  await expect(titles).toHaveText(expected);
  await expect(page.getByRole("combobox",{name:"整机排序",exact:true})).toHaveValue("name-asc");
  await expect(table).not.toContainText("未记录");
  for (const row of await table.getByRole("link").all()) {
    await expect(row).not.toContainText("拿走");
    await expect(row).not.toContainText("成交");
  }
  await expect(table).not.toContainText("翻新机");
  await expect(table).not.toContainText(fixtures[0].code);
  for(const width of [1440,1024,390,375]) {
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.local/ui-proof/retail-sort-simplify/${testInfo.project.name}-available-${width}.png`,fullPage:true});
  }
  await page.getByRole("combobox",{name:"整机排序",exact:true}).selectOption("newest");
  await expect(titles.first()).toHaveText("Apple iPhone 13");
  await page.reload();
  await expect(page.getByRole("combobox",{name:"整机排序",exact:true})).toHaveValue("newest");
  await page.getByRole("button",{name:"清除筛选",exact:true}).click();
  await expect(titles).toHaveText(expected);
  await page.getByRole("searchbox",{name:"搜索整机商品",exact:true}).fill(fixtures[0].code);
  await expect(table.getByRole("link")).toHaveCount(1);
  await table.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/app/retail/units/${fixtures[0].id}`));
  await page.getByRole("link",{name:"返回商品列表",exact:true}).click();
  await expect(page.getByRole("searchbox",{name:"搜索整机商品",exact:true})).toHaveValue(fixtures[0].code);
  await expect(table.getByRole("link")).toHaveCount(1);
});

test("已售按售出时间倒序，切换视图与刷新保留正确默认",async({page},testInfo)=>{
  const sold=fixtures[7];
  const units=[...fixtures.filter(unit=>unit.status!=="sold"),
    {...sold,id:"demo-sold-old",code:"DEMO-SOLD-OLD",serial:"DEMO-SN-SOLD-OLD",model:"Galaxy S20",intakeDate:"2026-09-19",sales:[{...sold.sales[0],id:"DEMO-SALE-OLD",time:"2026-09-20 16:00",deliveryDate:"2026-10-03"}]},
    {...sold,id:"demo-sold-new",code:"DEMO-SOLD-NEW",serial:"DEMO-SN-SOLD-NEW",model:"Galaxy S22",intakeDate:"2026-09-01",sales:[{...sold.sales[0],id:"DEMO-SALE-NEW",time:"2026-09-29 10:00",deliveryDate:"2026-09-30"}]},sold];
  await seedUnits(page, units);
  await page.goto("/app/retail?view=sold");
  const table=page.getByRole("region",{name:"整机商品表格",exact:true});
  const titles=table.locator("a strong");
  await expect(titles).toHaveText(["Samsung Galaxy S22","Samsung Galaxy S21","Samsung Galaxy S20"]);
  await expect(page.getByRole("combobox",{name:"整机排序",exact:true})).toHaveValue("sold-newest");
  for(const width of [1440,1024,390,375]) {
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.local/ui-proof/retail-sort-simplify/${testInfo.project.name}-sold-${width}.png`,fullPage:true});
  }
  await page.reload();await expect(titles.first()).toHaveText("Samsung Galaxy S22");
  await page.getByRole("link",{name:/^在售商品 \d+$/}).click();
  await expect(page.getByRole("combobox",{name:"整机排序",exact:true})).toHaveValue("name-asc");
  await page.getByRole("link",{name:/^已售历史 \d+$/}).click();
  await expect(titles.first()).toHaveText("Samsung Galaxy S22");
});
