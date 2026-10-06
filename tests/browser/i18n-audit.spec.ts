import {test,expect,type Page,type Locator} from "@playwright/test";
import {translate,translateSystemMessage} from "../../lib/i18n/translate";
import { emptyRetailUnit } from "../../lib/retail";
import type {Locale} from "../../lib/i18n/locale";
async function activate(target:Locator){if(test.info().project.use.hasTouch)await target.tap();else await target.click();}
async function language(page:Page,locale:Locale){
 const select=page.getByLabel("语言 / Lingua / Language",{exact:true});
 if(!await select.isVisible()){
  if(await page.evaluate(()=>innerWidth<768)){const menu=page.locator(".page-menu-button");await expect(menu).toBeVisible();if(await menu.getAttribute("aria-expanded")!=="true")await activate(menu);}
  const account=page.locator(".sidebar-account");if(await account.getAttribute("open")===null)await activate(account.locator("summary"));
 }
 await select.selectOption(locale);await expect(page.locator("html")).toHaveAttribute("lang",locale);
 const close=page.locator(".app-sidebar__close");if(await close.isVisible()){await activate(close);await expect(page.locator(".page-menu-button")).toHaveAttribute("aria-expanded","false");await expect.poll(()=>page.locator("#app-sidebar").evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);}else{const account=page.locator(".sidebar-account[open] summary");if(await account.isVisible())await activate(account);}
}
async function fits(page:Page){await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollWidth<=innerWidth+1)).toBe(true);}

test("all public auth routes switch three languages without visible system Chinese or horizontal overflow",async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 for(const route of ["/login","/register","/forgot-password","/reset-password","/verify-email"]){
  await page.goto(route);for(const locale of ["zh-CN","it","en"] as const){await language(page,locale);for(const width of [1440,1024,390,375]){await page.setViewportSize({width,height:width<768?844:1000});await fits(page);if(locale!=="zh-CN"){const text=(await page.locator(".auth-form").innerText()).replaceAll("中文","");expect(text).not.toMatch(/[\u3400-\u9fff]/u);}}}
 }
 expect(errors).toEqual([]);
});

test("translated dashboard heading, actions and metric labels stay in their containers",async({page})=>{
 await page.request.post("/api/preview-session",{data:{email:"demo@chinatech.local",password:"Preview2026!"}});await page.goto("/app/dashboard");
 for(const locale of ["zh-CN","it","en"] as const){await language(page,locale);for(const width of [1440,1024,390,375]){await page.setViewportSize({width,height:1000});await expect(page.locator(".module-title h2")).toHaveText(translate("工作台",locale));await fits(page);
  const geometry=await page.locator(".module-heading").evaluate(el=>{const title=el.querySelector("h2")!.getBoundingClientRect(),actions=el.querySelector(".module-heading__actions")!.getBoundingClientRect();return{titleHeight:title.height,titleBottom:title.bottom,actionsTop:actions.top};});expect(geometry.titleHeight).toBeLessThan(40);if(width<768)expect(geometry.actionsTop).toBeGreaterThanOrEqual(geometry.titleBottom);
  expect(await page.locator(".retail-metrics small").evaluateAll(rows=>rows.every(e=>{const r=e.getBoundingClientRect(),p=e.closest("a")!.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;}))).toBe(true);
 }}
 await page.reload();await expect(page.locator("html")).toHaveAttribute("lang","en");
});

test("dynamic integer feedback follows language without changing its numeric draft",async({page})=>{
 await page.request.post("/api/preview-session",{data:{email:"demo@chinatech.local",password:"Preview2026!"}});await page.goto("/app/retail/units/demo-unit-2");await language(page,"en");
 const group=page.locator('[data-retail-group="physical"]');const toggle=group.locator(":scope > button");if(await toggle.isVisible()&&await toggle.getAttribute("aria-expanded")==="false")await activate(toggle);
 await activate(page.getByRole("button",{name:translate("编辑{v0}","en",{v0:"RAM"}),exact:true}));
 await page.getByRole("combobox",{name:"RAM（GB）",exact:true}).selectOption("custom");
 const input=page.locator('input[inputmode="numeric"]').first();await input.fill("9000");
 for(const locale of ["en","it","zh-CN"] as const){await language(page,locale);await expect(input).toHaveValue("9000");await expect(page.getByText(translateSystemMessage("请输入 1–8192 的整数。",locale),{exact:true}).first()).toBeVisible();}
 await input.fill("8");await activate(page.getByRole("button",{name:translate("继续确认","zh-CN"),exact:true}));await activate(page.getByRole("button",{name:translate("确认保存","zh-CN"),exact:true}));await page.reload();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units.find((u:{id:string})=>u.id==="demo-unit-2").ramGb)).toBe(8);
});

test("translated unknown financial values keep complete words at desktop and phone widths",async({page})=>{
 await page.request.post("/api/preview-session",{data:{email:"demo@chinatech.local",password:"Preview2026!"}});await page.goto("/app/retail/units/demo-unit-2");
 for(const locale of ["zh-CN","it","en"] as const){await language(page,locale);for(const width of [1440,1280,1024,390,375]){await page.setViewportSize({width,height:1000});const group=page.locator('[data-retail-group="finance"]');const toggle=group.locator(":scope > button");if(await toggle.isVisible()&&await toggle.getAttribute("aria-expanded")==="false")await activate(toggle);
  const edit=group.getByRole("button",{name:translate("编辑{v0}",locale,{v0:translate("整备成本",locale)}),exact:true});const value=edit.getByText(translate("待确认",locale),{exact:true});await expect(value).toBeVisible();await fits(page);
  const splitWords=await value.evaluate(el=>{const broken:string[]=[];const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walk.nextNode())){const text=node.textContent||"";for(const match of text.matchAll(/[A-Za-zÀ-ÿ]{3,}/gu)){const range=document.createRange();range.setStart(node,match.index!);range.setEnd(node,match.index!+match[0].length);if(new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size>1)broken.push(match[0]);}}return broken;});expect(splitWords).toEqual([]);
 }}
});


test("search matches the displayed colors in all three languages while preserving canonical data",async({page})=>{
 const unit={...emptyRetailUnit(),id:"demo-language-search",code:"DEMO-LANG-SEARCH",brand:"Apple",model:"Search phone",serial:"DEMO-SEARCH-01",color:"黑色",status:"available" as const,storeOwned:true,priceCents:100,inspection:{functional:true,ownership:true,data:true}};
 await page.addInitScript(unit=>{if(localStorage.getItem("locale-search-seeded"))return;localStorage.setItem("locale-search-seeded","1");localStorage.setItem("chinatech.m1.retail.v1",JSON.stringify({version:1,units:[unit]}));localStorage.setItem("chinatech.m1.retail-history.v1",JSON.stringify({version:1,records:[]}));},unit);
 await page.request.post("/api/preview-session",{data:{email:"demo@chinatech.local",password:"Preview2026!"}});await page.goto("/app/retail");
 for(const locale of ["it","en","zh-CN"] as const){await language(page,locale);await page.getByLabel(translate("搜索整机商品",locale),{exact:true}).fill(translate("黑色",locale));const table=page.getByRole("region",{name:translate("整机商品表格",locale),exact:true});await expect(table.getByRole("link")).toHaveCount(1);await expect(table.getByRole("link")).toHaveAttribute("href",/demo-language-search/);}
 await language(page,"en");await expect(page.getByLabel(translate("搜索整机商品","en"),{exact:true})).toHaveValue("黑色");await expect(page.getByRole("region",{name:translate("整机商品表格","en"),exact:true}).getByRole("link")).toHaveCount(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units[0].color)).toBe("黑色");
});
