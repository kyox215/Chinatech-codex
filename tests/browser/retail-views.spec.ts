import { test, expect } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";

const fixtures = retailUnits.map((unit,index) => ({...unit, condition:index === 0 ? "新机" as const : "翻新机" as const}));
test.beforeEach(async ({page}) => {
  const response = await page.request.post("/api/preview-session",{data:{email:"demo@chinatech.local",password:"Preview2026!"}});
  expect(response.status()).toBe(200);
  await page.addInitScript(units=>localStorage.setItem("chinatech.m1.retail.v1",JSON.stringify({version:1,units})),fixtures);
});
test("整机首页先显示在售，新机翻新机独立切换并在刷新后保留",async({page})=>{
  await page.goto("/app/retail");
  const table=page.getByRole("region",{name:"整机商品表格",exact:true});
  const available=fixtures.filter(unit=>unit.status==="available");
  await expect(table.getByRole("link")).toHaveCount(available.length);
  await expect(page.getByRole("link",{name:`在售商品 ${available.length}`,exact:true})).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:"新机 1",exact:true}).click();
  await expect(table.getByRole("link")).toHaveCount(1);
  await expect(table).toContainText(fixtures[0].code);
  await page.reload();
  await expect(page.getByRole("button",{name:"新机 1",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:`翻新机 ${available.length-1}`,exact:true}).click();
  await expect(table.getByRole("link")).toHaveCount(available.length-1);
  await expect(table).not.toContainText(fixtures[0].code);
});
test("已售独立历史，其他状态仍可查，单机管理入口保留",async({page})=>{
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
