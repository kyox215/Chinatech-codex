import {test,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";
import {translate} from "../../lib/i18n/translate";
import type {Locale} from "../../lib/i18n/locale";
const path=process.env.CT_PERF_FIXTURE;
test.skip(!path,"Requires explicit project-local synthetic real-Auth acceptance fixture; never runs against production.");
const fixture=path?JSON.parse(readFileSync(path,"utf8")):null;
async function login(page:Page,locale:Locale="zh-CN",account=fixture,directory=true) {
  const base=String(test.info().project.use.baseURL);
  expect(account.email).toMatch(/^performance-local-.*@example\.test$/);
  await page.addInitScript(locale=>localStorage.setItem("chinatech.language",locale),locale);
  const response=await page.request.post(base+"/api/auth/login",{headers:{Origin:base},data:{email:account.email,password:account.password,remember:false}});
  expect(response.status()).toBe(200);
  await page.context().addCookies([{name:"ct_store",value:account.storeId,url:base}]);
  await page.goto("/app/customers");
  if(directory)await expect(page.locator('[data-window-cache]')).toHaveAttribute("data-window-cache","50");
}
async function shown(page:Page) {const values=(await page.getByRole("region",{name:"列表加载",exact:true}).innerText()).match(/\d+/g)!.map(Number);return values.length===3?values[1]:values[0];}
async function scrollBatch(page:Page) {
  const before=await shown(page);
  await page.getByRole("region",{name:"列表加载",exact:true}).scrollIntoViewIfNeeded();
  await expect.poll(()=>shown(page)).toBeGreaterThan(before);
  // No further input: a boundary that remains visible must not drain batches.
  const once=await shown(page);await page.waitForTimeout(1100);expect(await shown(page)).toBe(once);
}
for(const width of [1440,1024,390,375])for(const locale of ["zh-CN","it","en"] as const)test(`real Auth first50, append100 and full search ${width}px ${locale}`,async({page,browserName},info)=>{
  test.skip(browserName==="webkit"&&width!==375,"WebKit touch representative is 375px; Chromium covers all four production breakpoints.");
  await page.setViewportSize({width,height:width<768?812:1000});await login(page,locale);
  const t=(text:string)=>translate(text,locale),rows=page.locator('[data-window-key]'),footer=page.getByRole("region",{name:t("列表加载"),exact:true});
  expect(await rows.count()).toBeGreaterThan(0);expect(await rows.count()).toBeLessThanOrEqual(50);await expect(footer).toContainText("1200");
  await expect(page.getByRole("button",{name:t("上一页"),exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:t("下一页"),exact:true})).toHaveCount(0);
  await footer.scrollIntoViewIfNeeded();await expect(page.locator('[data-window-cache]')).toHaveAttribute("data-window-cache","100");
  await page.waitForTimeout(1100);await expect(page.locator('[data-window-cache]')).toHaveAttribute("data-window-cache","100");
  await page.getByRole("textbox",{name:t("搜索客户"),exact:true}).fill("DEMO Customer 1199");await expect(rows).toHaveCount(1);await expect(rows).toContainText("DEMO Customer 1199");
  const style=await page.getByRole("textbox",{name:t("搜索客户"),exact:true}).evaluate(node=>({fontSize:parseFloat(getComputedStyle(node).fontSize),maxLength:(node as HTMLInputElement).maxLength}));expect(style.maxLength).toBe(160);if(width<768)expect(style.fontSize).toBeGreaterThanOrEqual(16);
  await page.screenshot({path:info.outputPath(`customer-${width}-${locale}.png`)});
});

test("bounded500 measured variable-height cache restores an evicted region without draining",async({page},info)=>{
  await login(page);
  // Synthetic geometry stress only: alternate short/tall production rows. No
  // business record is changed; normal CSS is separately verified above.
  await page.evaluate(()=>{const apply=()=>document.querySelectorAll<HTMLElement>('[data-window-index]').forEach(node=>node.style.minHeight=Number(node.dataset.windowIndex)%2?"240px":"76px");new MutationObserver(apply).observe(document.body,{subtree:true,childList:true});apply();});
  const calls:string[]=[];page.on("request",request=>{if(new URL(request.url()).pathname==="/api/backend/v2/customers")calls.push(request.url());});
  for(let i=0;i<12;i++)await scrollBatch(page);
  await expect(page.locator('[data-window-cache]')).toHaveAttribute("data-window-cache","500");expect(await page.locator('[data-window-key]').count()).toBeLessThan(100);
  const before=calls.filter(url=>url.includes("seek=")).length;
  await page.evaluate(()=>scrollTo({top:1000,behavior:"instant"}));
  await expect.poll(()=>page.locator('[data-window-key]').evaluateAll(nodes=>nodes.some(node=>{const rect=node.getBoundingClientRect();return rect.bottom>0&&rect.top<innerHeight;}))).toBe(true);
  await page.waitForTimeout(1100);expect(calls.filter(url=>url.includes("seek=")).length-before).toBeLessThanOrEqual(4);
  expect(await page.locator('[data-window-cache]').getAttribute("data-window-cache")).not.toBe("0");
  await info.attach("actual-window-api-calls",{body:JSON.stringify(calls.map(url=>new URL(url).search)),contentType:"application/json"});
});

test("deep customer detail returns by freshly authorized anchor with keyboard focus",async({page})=>{
  await login(page);for(let i=0;i<10;i++)await scrollBatch(page);
  const link=page.locator('[data-window-key]').last(),key=await link.getAttribute("data-window-key");
  await link.click();await expect(page.getByRole("heading",{name:"客户资料",exact:true})).toBeVisible();
  await page.goBack();await expect(page.locator(`[data-window-key="${key}"]`)).toBeVisible();await expect(page.locator(`[data-window-key="${key}"]`)).toBeFocused();
  await page.locator(`[data-window-key="${key}"]`).click();await page.getByRole("link",{name:"返回客户列表",exact:true}).click();await expect(page.locator(`[data-window-key="${key}"]`)).toBeVisible();await expect(page.locator(`[data-window-key="${key}"]`)).toBeFocused();
});

test("non-JSON403 removes old private rows even when the redirect navigation fails",async({page})=>{
  await login(page);
  const documentMarker="denial-old-document-"+Date.now();
  await page.evaluate(marker=>document.documentElement.dataset.denialDocument=marker,documentMarker);
  await page.route("**/api/backend/v2/customers?**",async route=>{if(new URL(route.request().url()).searchParams.get("q")==="denied")await route.fulfill({status:403,contentType:"text/html",body:"<h1>Denied</h1>"});else await route.continue();});
  // Abort the redirect: the old document remains, so a replacement page cannot
  // make this assertion pass. Holding it indefinitely freezes Chromium script
  // evaluation and Playwright locators until navigation settles.
  await page.route("**/account/pending",route=>route.abort("aborted"));
  const deniedNavigation=page.waitForEvent("requestfailed",request=>new URL(request.url()).pathname==="/account/pending");
  await page.getByRole("textbox",{name:"搜索客户",exact:true}).fill("denied");await deniedNavigation;
  await expect(page.locator("html")).toHaveAttribute("data-denial-document",documentMarker);expect(new URL(page.url()).pathname).toBe("/app/customers");
  await expect(page.locator(".backend-snapshot-root")).toHaveCount(1);
  await expect(page.locator('[data-window-key]')).toHaveCount(0);expect(await page.locator('body').innerText()).not.toContain("DEMO Customer");
});

test("authorized store member without customers.view stays at no-access without a directory request",async({page})=>{
  const restrictedPath=process.env.CT_PERF_RESTRICTED_FIXTURE;
  test.skip(!restrictedPath,"Requires explicit local synthetic restricted member fixture.");
  const restricted=JSON.parse(readFileSync(restrictedPath!,"utf8")),calls:string[]=[];
  page.on("request",request=>{if(new URL(request.url()).pathname==="/api/backend/v2/customers")calls.push(request.url());});
  await login(page,"zh-CN",restricted,false);
  await expect(page.getByText("当前账号无法访问此页面",{exact:true})).toBeVisible();
  await page.waitForTimeout(600);expect(calls).toEqual([]);expect(new URL(page.url()).pathname).toBe("/app/customers");
  await expect(page.locator('[data-window-key]')).toHaveCount(0);expect(await page.locator("body").innerText()).not.toContain("DEMO Customer");
});
