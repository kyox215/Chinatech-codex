import { test, expect, type Page } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";
import { currentRetailSale, retailPaidCents, type RetailUnit } from "../../lib/retail";
const unitKey="chinatech.m1.retail.v1";
async function units(page:Page):Promise<RetailUnit[]> {return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).units,unitKey);}
async function openActions(page:Page) {await expect(page.locator('[data-retail-group="actions"]')).toBeVisible();const button=page.locator('[data-retail-group="actions"] > button[aria-controls]');if(await button.isVisible() && await button.getAttribute("aria-expanded")==="false")await button.click();}
test.beforeEach(async({page})=>{await page.addInitScript(()=>{window.print=()=>{const state=window as typeof window & {workflowPrints?:number};state.workflowPrints=(state.workflowPrints??0)+1;};});await page.goto("/login");await page.getByRole("button",{name:"填入演示账号",exact:true}).click();await page.getByRole("button",{name:"登录工作台",exact:true}).click();await expect(page).toHaveURL(/\/app\/dashboard$/);});
async function newForm(page:Page,model:string) {await page.goto("/app/retail/new");await page.getByRole("radio",{name:"新机",exact:true}).locator("..").click();await page.getByRole("combobox",{name:"型号 / 商品名称 *",exact:true}).fill(model);}
test("新建默认仅建档，部分检查可保存，完整检查一次可售并刷新",async({page})=>{
 await newForm(page,"DEMO Single submit draft");
 await expect(page.getByRole("combobox",{name:"保存方式",exact:true})).toHaveValue("inspecting");
 await page.getByRole("checkbox",{name:/我确认这是门店自有/}).check();
 await page.getByRole("button",{name:"创建独立档案",exact:true}).click();
 await expect(page).toHaveURL(/\/app\/retail\/units\//);
 let saved=(await units(page)).find(item=>item.model==="DEMO Single submit draft")!;
 expect(saved.status).toBe("inspecting");expect(saved.inspection).toEqual({functional:false,ownership:false,data:false});expect(saved.costCents).toBeNull();
 await openActions(page);await page.getByRole("checkbox",{name:"功能检测已完成",exact:true}).check();await page.getByRole("button",{name:"记录检测",exact:true}).click();
 await expect.poll(async()=> (await units(page)).find(item=>item.id===saved.id)?.inspection.functional).toBe(true);
 await page.getByRole("checkbox",{name:"所有权及账号锁核验已完成",exact:true}).check();await page.getByRole("checkbox",{name:"数据处理核验已完成",exact:true}).check();await page.getByLabel("售价",{exact:true}).fill("80");
 await page.getByRole("button",{name:"保存检测并设为可售",exact:true}).click();
 await expect.poll(async()=> (await units(page)).find(item=>item.id===saved.id)?.status).toBe("available");
 await page.reload();saved=(await units(page)).find(item=>item.id===saved.id)!;expect(saved.priceCents).toBe(8000);expect(saved.events.at(-2)?.detail).toContain("功能检测：已核对");expect(saved.events.at(-1)?.title).toContain("approve");
});
test("实际检查不能预勾，建档可售一个提交、关键字段改动清核验",async({page})=>{
 await newForm(page,"DEMO Ready one submit");await page.getByRole("combobox",{name:"保存方式",exact:true}).selectOption("available");await page.getByLabel("标价",{exact:true}).fill("120");
 for(const name of ["功能检测已完成","门店自有及账号锁已核验","数据处理核验已完成"])await expect(page.getByRole("checkbox",{name,exact:true})).not.toBeChecked();
 for(const name of ["功能检测已完成","门店自有及账号锁已核验","数据处理核验已完成"])await page.getByRole("checkbox",{name,exact:true}).check();
 await page.getByRole("combobox",{name:"型号 / 商品名称 *",exact:true}).fill("DEMO Ready changed");
 await expect(page.getByRole("checkbox",{name:"功能检测已完成",exact:true})).not.toBeChecked();
 for(const name of ["功能检测已完成","门店自有及账号锁已核验","数据处理核验已完成"])await page.getByRole("checkbox",{name,exact:true}).check();
 await page.locator("footer").getByRole("button",{name:"建档并设为可售",exact:true}).click();await expect(page).toHaveURL(/\/app\/retail\/units\//);
 const saved=(await units(page)).find(item=>item.model==="DEMO Ready changed")!;expect(saved.status).toBe("available");expect(saved.sales).toHaveLength(0);expect(saved.costCents).toBeNull();expect(saved.refurbCents).toBeNull();
});
async function checkout(page:Page) {
 const item={...structuredClone(retailUnits[0]),id:"DEMO-CHECKOUT-ONE",model:"DEMO actual checkout",serial:"DEMO-CHECKOUT-SN",priceCents:10000,sales:[]};
 await page.evaluate(({unitKey,item})=>localStorage.setItem(unitKey,JSON.stringify({version:1,units:[item]})),{unitKey,item});
 await page.goto("/app/retail/units/"+item.id);await openActions(page);await page.getByRole("button",{name:"登记售出",exact:true}).click();
 const form=page.getByRole("region",{name:"登记成交",exact:true});
 await form.getByRole("combobox",{name:"客户手机号 *",exact:true}).fill("+393200007701");return form;
}
test("多笔实际款项与交付一次成交，打印入口保留且不自动打印",async({page})=>{
 const form=await checkout(page);await expect(form.getByLabel("本台成交价",{exact:true})).toHaveValue("100.00");
 for(const name of ["本次收款情况","实际交付情况"])await expect(form.getByRole("combobox",{name,exact:true})).toHaveValue("");
 await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("partial");
 await form.getByLabel("收款金额",{exact:true}).fill("40");await form.getByRole("combobox",{name:"收款方式",exact:true}).selectOption("cash");
 await form.getByRole("button",{name:"添加一笔实际收款",exact:true}).click();
 await form.getByLabel("收款金额",{exact:true}).nth(1).fill("60");await form.getByRole("combobox",{name:"收款方式",exact:true}).nth(1).selectOption("card");
 await form.getByRole("combobox",{name:"实际交付情况",exact:true}).selectOption("delivered");await form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true}).check();
 await form.getByRole("button",{name:"确认登记成交",exact:true}).click();await expect(form).toHaveCount(0);
 const saved=(await units(page))[0],sale=currentRetailSale(saved)!;expect(saved.sales).toHaveLength(1);expect(sale.payments).toHaveLength(2);expect(retailPaidCents(sale)).toBe(10000);expect(sale.delivered).toBe(true);expect(await page.evaluate(()=>(window as typeof window & {workflowPrints?:number}).workflowPrints??0)).toBe(0);expect(sale.product!.model).toBe("DEMO actual checkout");
 await page.reload();await expect(page.locator('[data-retail-group="sales"]')).toBeVisible();const sales=page.locator('[data-retail-group="sales"] > button[aria-controls]');if(await sales.isVisible() && await sales.getAttribute("aria-expanded")==="false")await sales.click();
 await expect(page.getByRole("button",{name:"打印销售与保修单",exact:true})).toHaveCount(1);expect((await units(page))[0].sales).toHaveLength(1);
});
test("欠款交付要明确授权，未选择付款方式不写入，手机焦点无顶栏遮挡",async({page})=>{
 await page.setViewportSize({width:375,height:812});await newForm(page,"DEMO mobile focus");
 const price=page.getByLabel("标价",{exact:true});await price.fill("80");await price.focus();const rect=await price.boundingBox();expect(rect!.y).toBeGreaterThanOrEqual(0);expect(await price.evaluate(element=>getComputedStyle(element).fontSize)).toBe("16px");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const form=await checkout(page);await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("none");await form.getByRole("combobox",{name:"实际交付情况",exact:true}).selectOption("delivered");
 await expect(form.getByRole("checkbox",{name:"明确授权本次欠款放行",exact:true})).not.toBeChecked();
 await form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true}).check();await expect(form.getByRole("button",{name:"确认登记成交",exact:true})).toBeDisabled();expect((await units(page))[0].sales).toHaveLength(0);
 await form.getByRole("combobox",{name:"实际交付情况",exact:true}).selectOption("none");await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("full");await expect(form.getByRole("combobox",{name:"收款方式",exact:true})).toHaveValue("");await form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true}).check();await form.getByRole("button",{name:"确认登记成交",exact:true}).click();expect((await units(page))[0].sales).toHaveLength(0);
 await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("none");await form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true}).check();await form.getByRole("button",{name:"确认登记成交",exact:true}).click();await expect(form).toHaveCount(0);
 const sale=currentRetailSale((await units(page))[0])!;expect(retailPaidCents(sale)).toBe(0);expect(sale.delivered).toBe(false);
});

test("新建与成交三语四宽度可读，输入与按钮尺寸保留",async({page},info)=>{
 test.setTimeout(120000);await newForm(page,"DEMO layout product");
 await page.getByRole("combobox",{name:"保存方式",exact:true}).selectOption("available");await page.getByLabel("电池健康",{exact:true}).fill("100");await page.getByRole("heading",{name:"新建商品",exact:true}).click();
 for(const locale of ["zh-CN","it","en"]){await page.evaluate(locale=>{localStorage.setItem("chinatech.language",locale);window.dispatchEvent(new StorageEvent("storage",{key:"chinatech.language",newValue:locale}));},locale);
  await expect(page.locator("html")).toHaveAttribute("lang",locale);
  for(const width of [1440,1024,390,375]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const submit=page.locator('footer button[type="submit"]');expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
   if(width<768){expect(await page.locator("main input").first().evaluate(el=>getComputedStyle(el).fontSize)).toBe("16px");expect(await page.locator("main > header").evaluate(el=>getComputedStyle(el).position)).toBe("static");}
   await page.screenshot({path:".local/ui-proof/retail-workflow/"+info.project.name+"-"+locale+"-"+width+"-new.png",fullPage:true});}
 }
 await page.evaluate(()=>{localStorage.setItem("chinatech.language","zh-CN");window.dispatchEvent(new StorageEvent("storage",{key:"chinatech.language",newValue:"zh-CN"}));});await page.setViewportSize({width:1440,height:900});const form=await checkout(page);
 await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("full");await form.getByRole("combobox",{name:"收款方式",exact:true}).selectOption("cash");await form.getByRole("combobox",{name:"实际交付情况",exact:true}).selectOption("delivered");
 for(const locale of ["zh-CN","it","en"]){await page.evaluate(locale=>{localStorage.setItem("chinatech.language",locale);window.dispatchEvent(new StorageEvent("storage",{key:"chinatech.language",newValue:locale}));},locale);await expect(page.locator("html")).toHaveAttribute("lang",locale);
  for(const width of [1440,1024,390,375]){await page.setViewportSize({width,height:900});await openActions(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await page.locator('form[role="region"] button[type="submit"]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
   await page.screenshot({path:".local/ui-proof/retail-workflow/"+info.project.name+"-"+locale+"-"+width+"-checkout.png",fullPage:true});}
 }
});
test("照片在新建暂存并一起保存，手机仅展开一次，不复制旧核验",async({page})=>{
 await page.setViewportSize({width:375,height:812});await newForm(page,"DEMO staged photo");await page.getByRole("heading",{name:"新建商品",exact:true}).click();const before=await page.evaluate(key=>localStorage.getItem(key),unitKey);
 await page.getByText("照片（选填）",{exact:true}).click();const gallery=page.getByRole("region",{name:"本台实物照片",exact:true});await expect(gallery.getByRole("button",{name:"上传",exact:true})).toBeVisible();await expect(gallery.getByRole("button",{name:/照片 0|收起照片/,exact:true})).toHaveCount(0);
 const photo=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=80;canvas.height=120;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#5f57ff";ctx.fillRect(0,0,80,120);return canvas.toDataURL("image/png");});
 await gallery.getByLabel("上传本台实物照片",{exact:true}).setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:Buffer.from(photo.split(",")[1],"base64")});
 await expect(gallery.getByRole("button",{name:"查看实物照片 1",exact:true})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),unitKey)).toBe(before);await expect(gallery.getByRole("button",{name:"确认保存照片",exact:true})).toHaveCount(0);
 await page.getByRole("checkbox",{name:/我确认这是门店自有/}).check();await page.getByRole("button",{name:"创建独立档案",exact:true}).click();await expect(page).toHaveURL(/\/app\/retail\/units\//);const saved=(await units(page)).find(item=>item.model==="DEMO staged photo")!;
 expect(saved.photos).toHaveLength(1);expect(saved.photos[0]).toMatch(/^data:image\/jpeg;base64,/);expect(saved.status).toBe("inspecting");expect(saved.inspection).toEqual({functional:false,ownership:false,data:false});expect(saved.events).toHaveLength(2);
 await page.reload();expect((await units(page)).find(item=>item.id===saved.id)?.photos).toEqual(saved.photos);
});
