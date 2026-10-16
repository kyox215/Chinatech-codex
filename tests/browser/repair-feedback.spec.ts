import { test, expect, type Page } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { emptyIntakeServices } from "../../lib/intake-services";
import { defaultStaffData } from "../../lib/staff";
import { defaultStoreSettings } from "../../lib/store-settings";
import { translate } from "../../lib/i18n/translate";
import { intakeDirectoryEntry, type IntakeReceiptData } from "../../lib/repair-intake-record";
import { initialRepairWorkflow } from "../../lib/repair-workflow";
import { currentRepairRequirements } from "../../lib/repair-requirements";
import type { ProcurementRecord } from "../../lib/procurement";

// Reuses the project's TypeScript/CJS in-memory React-fixture technique. Only
// decorative icons and Next's image renderer are adapted; all tested controls,
// language selection, photo draft/capture/viewer and feedback hooks are real.
const fixtureEntry = String.raw`
import React,{useEffect,useRef,useState} from "react";
import{createRoot}from"react-dom/client";
import{LanguageProvider,useLanguage}from"@/components/language-provider";
import{OperationFeedbackProvider}from"@/components/operation-feedback";
import{SearchCombobox}from"@/components/search-combobox";
import{IntakePhotos,useIntakePhotos}from"@/components/repairs/intake-photos";
const api=window.repairFeedbackFixture={};let root;
function Setup({locale,children}){const{setLocale}=useLanguage();useEffect(()=>setLocale(locale),[locale,setLocale]);return children;}
function Combo(){const{t}=useLanguage();const[value,setValue]=useState("");const dialog=useRef(null);useEffect(()=>{dialog.current.showModal();},[]);return <dialog ref={dialog} className="repair-parts-dialog repair-part-dialog repair-items-dialog repair-procurement-dialog"><header><h2>DEMO supplier boundary</h2><button type="button" className="icon-button" onClick={()=>dialog.current.close()} aria-label="DEMO close">×</button></header><div className="repair-procurement-dialog__body" data-combobox-boundary id="fixture-boundary"><fieldset className="form-fields"><p>DEMO: fixed header and footer, locally supplied content.</p><SearchCombobox adaptiveMenu optionLimit={50} label={t("供应商（选填）")} value={value} onChange={setValue} options={Array.from({length:50},(_,i)=>({value:'DEMO Supplier '+String(i+1).padStart(2,'0'),label:'DEMO Supplier '+String(i+1).padStart(2,'0')}))}/>{Array.from({length:12},(_,i)=><p key={i}>DEMO repair item {i+1}: complete supplier and repair requirements.</p>)}</fieldset></div><div className="repair-procurement-dialog__footer"><footer><button className="button" type="button" onClick={()=>dialog.current.close()}>DEMO cancel</button></footer></div></dialog>;}
function DefaultCombo({adaptive=false}){const[value,setValue]=useState("");return <div style={{width:'280px',margin:'30px'}}><SearchCombobox adaptiveMenu={adaptive} commitOnBlur={adaptive} showAllOnOpen={adaptive} label={adaptive?"DEMO brand":"DEMO customer"} value={value} onChange={setValue} options={[{value:'Alpha',label:'Alpha'},{value:'Beta',label:'Beta'}]}/></div>;}
function Photos(){const draft=useIntakePhotos();return <IntakePhotos {...draft}/>;}
api.mount=(kind,locale)=>{root?.unmount();document.getElementById('root').replaceChildren();root=createRoot(document.getElementById('root'));root.render(<LanguageProvider><Setup locale={locale}><OperationFeedbackProvider>{kind==='combo'?<Combo/>:kind==='default'||kind==='adaptive-default'?<DefaultCombo adaptive={kind==='adaptive-default'}/>:<Photos/>}</OperationFeedbackProvider></Setup></LanguageProvider>);};api.unmount=()=>root?.unmount();api.ready=true;
`;

export function buildRepairFeedbackFixture(source = process.cwd()) {
  const native = createRequire(resolve(source, "package.json"));
  const modules: string[] = [], ids = new Map<string, number>();
  function pathFor(name: string, parent: string) {
    if (name === "lucide-react" || name === "next/image") return "virtual:" + name;
    if (name.endsWith(".css")) return "virtual:css";
    const file = name.startsWith("@/") ? resolve(source, name.slice(2)) : name.startsWith(".") ? resolve(dirname(parent), name) : native.resolve(name);
    if (existsSync(file) && extname(file)) return file;
    for (const ending of [".tsx", ".ts", ".js", "/index.js"]) if (existsSync(file + ending)) return file + ending;
    throw new Error(`Cannot resolve ${name} from ${parent}`);
  }
  function add(file: string): number {
    if (ids.has(file)) return ids.get(file)!;
    const id = modules.length; ids.set(file, id); modules.push("");
    let raw: string;
    if (file === "virtual:lucide-react") raw = 'module.exports=new Proxy({},{get:(_t,name)=>({size=24,...props})=>require("react").createElement("svg",{...props,width:size,height:size,"data-icon":String(name)})});';
    else if (file === "virtual:next/image") raw = 'module.exports={__esModule:true,default:({unoptimized,priority,fill,...props})=>require("react").createElement("img",props)};';
    else if (file === "virtual:css") raw = 'module.exports={__esModule:true,default:new Proxy({},{get:(_t,name)=>String(name)})};';
    else if (file.endsWith(".json")) raw = "module.exports=" + readFileSync(file, "utf8");
    else raw = file === "virtual:entry.tsx" ? fixtureEntry : readFileSync(file, "utf8");
    let code = /\.tsx?$/.test(file) ? ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText : raw;
    code = code.replaceAll("process.env.NODE_ENV", '"development"').replace(/require\(["']([^"']+)["']\)/g, (_match, name) => `__require(${add(pathFor(name, file))})`);
    modules[id] = `function(module,exports,__require){${code}\n}`; return id;
  }
  const entry = add("virtual:entry.tsx");
  return `(()=>{const modules=[${modules.join(",\n")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}__require(${entry});})();`;
}

type FixtureWindow = Window & { repairFeedbackFixture: { ready: boolean; mount: (kind: string, locale: string) => void; unmount: () => void }; repairFeedbackRO: () => number };
export async function mountRepairFeedbackFixture(page: Page, bundle = buildRepairFeedbackFixture()) {
  const requests: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  let css = readFileSync(resolve("app/globals.css"), "utf8");
  css = css.replace(/url\((["']?)\/fonts\/([^"')]+)\1\)/g, (_match, _quote, file) => `url(data:font/woff2;base64,${readFileSync(resolve("public/fonts", file)).toString("base64")})`);
  css += readFileSync(resolve("components/repairs/repair-detail-workspace.module.css"), "utf8").replace(/:global\(([^)]+)\)/g, "$1");
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div>`);
  await page.addScriptTag({ content: `window.fetch=()=>{throw Error('No network in repair feedback memory fixture')};let nonce=0;if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>('00000000-0000-4000-8000-'+String(++nonce).padStart(12,'0'))});const nativeRO=ResizeObserver,active=new Set();window.ResizeObserver=class extends nativeRO{observe(...a){active.add(this);return super.observe(...a)}disconnect(){active.delete(this);super.disconnect()}};window.repairFeedbackRO=()=>active.size;` });
  await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => Boolean((window as unknown as FixtureWindow).repairFeedbackFixture?.ready));
  return { requests, errors };
}

export async function exerciseRepairFeedbackFixture(page: Page, prefix: string) {
  mkdirSync(dirname(prefix), { recursive: true });
  const proof = await mountRepairFeedbackFixture(page);
  const geometry: unknown[] = [];
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  for (const width of [1440, 1024, 390, 375]) {
    const locale = width >= 768 ? "en" : "it";
    await page.setViewportSize({ width, height: width < 768 ? 420 : 900 });
    await page.evaluate(locale => (window as unknown as FixtureWindow).repairFeedbackFixture.mount("combo", locale), locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const input = page.getByRole("combobox", { name: translate("供应商（选填）", locale), exact: true });
    await input.fill("DEMO Supplier");
    const menu = page.locator(".search-combobox__menu"); await expect(menu).toBeVisible();
    const measure = async () => {
      const value = await menu.evaluate(node => { const boundary = document.getElementById("fixture-boundary")!, b = boundary.getBoundingClientRect(), m = node.getBoundingClientRect(); return { top: b.top + boundary.clientTop, bottom: b.top + boundary.clientTop + boundary.clientHeight, menuTop: m.top, menuBottom: m.bottom, height: m.height, space: getComputedStyle(node).getPropertyValue("--combobox-space") }; });
      geometry.push({ width, locale, ...value }); writeFileSync(prefix+"-progress.json",JSON.stringify(geometry,null,2)); expect(value.menuTop).toBeGreaterThanOrEqual(value.top); expect(value.menuBottom).toBeLessThanOrEqual(value.bottom);
    };
    await expect.poll(() => menu.evaluate(n => n.style.getPropertyValue("--combobox-space"))).not.toBe(""); await measure();
    await page.locator("#fixture-boundary").evaluate(node => node.scrollBy(0, 20));
    await expect.poll(() => menu.evaluate(n => {const b=document.getElementById("fixture-boundary")!,r=b.getBoundingClientRect(),m=n.getBoundingClientRect();return m.top>=r.top+b.clientTop&&m.bottom<=r.top+b.clientTop+b.clientHeight;})).toBe(true); await measure();
    if(width===1440||width===390)await page.screenshot({path:prefix+"-supplier-"+width+".png"});
    await input.press("ArrowUp"); await input.press("Enter"); await expect(input).toHaveValue("DEMO Supplier 50");
    await expect(menu).toHaveCount(0); await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).repairFeedbackRO())).toBe(0);
    if(touch)await page.getByRole("button", {name:"DEMO close",exact:true}).tap();else await page.getByRole("button", {name:"DEMO close",exact:true}).click();
  }
  await page.evaluate(() => (window as unknown as FixtureWindow).repairFeedbackFixture.mount("default", "zh-CN"));
  const plain = page.getByRole("combobox", { name: "DEMO customer", exact: true }); await plain.fill("Al"); await plain.press("ArrowDown"); await plain.press("Enter"); await expect(plain).toHaveValue("Alpha");
  await page.evaluate(() => (window as unknown as FixtureWindow).repairFeedbackFixture.mount("adaptive-default", "zh-CN"));
  const brand = page.getByRole("combobox", {name:"DEMO brand",exact:true}); await brand.fill("Al"); await brand.press("ArrowDown"); await brand.press("Enter"); await expect(brand).toHaveValue("Alpha"); await brand.fill("Beta"); await brand.press("Escape"); await expect(brand).toHaveValue("Alpha");
  await page.evaluate(() => (window as unknown as FixtureWindow).repairFeedbackFixture.mount("photos", "zh-CN"));
  await expect(page.getByLabel("上传正面照片", { exact: true })).toBeAttached();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("上传正面照片", { exact: true }).setInputFiles({ name: "DEMO-front.png", mimeType: "image/png", buffer: png });
  const preview = page.getByRole("button", { name: "查看正面照片", exact: true }); await expect(preview).toBeVisible();
  let choosers = 0; page.on("filechooser", () => { choosers++; }); if(touch)await preview.tap();else await preview.click();
  await expect(page.getByRole("dialog", { name: "接机照片", exact: true })).toBeVisible(); await page.getByRole("button", { name: "关闭照片", exact: true }).click(); await expect(preview).toBeFocused(); expect(choosers).toBe(0); await page.screenshot({path:prefix+"-photo-actions.png"});
  await page.getByRole("button", { name: "拍摄正面照片", exact: true }).click(); await expect(page.getByText("当前地址无法使用相机。请使用 HTTPS 地址，或选择上传照片。", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "关闭拍照", exact: true }).click();
  await expect(page.getByLabel("上传正面照片", { exact: true })).toBeEnabled();
  await page.evaluate(() => (window as unknown as FixtureWindow).repairFeedbackFixture.unmount()); await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).repairFeedbackRO())).toBe(0);
  expect(proof.requests).toEqual([]); expect(proof.errors).toEqual([]);
  mkdirSync(dirname(prefix), { recursive: true }); writeFileSync(prefix + ".json", JSON.stringify({ geometry, requests: proof.requests, errors: proof.errors, photoPreviewDoesNotSelectFile: choosers === 0, camera: "about:blank insecure-context fallback; not physical permission/hardware evidence", sourceCssOnly: true, defaultComboPreserved: true }, null, 2));
}

const id = "LOCAL-A202610160000001", intakeKey = "chinatech.m1.local-intakes.v1";
const intake: IntakeReceiptData = { id, revision: 1, createdAt: "2026-10-16 09:00:00", updatedAt: "2026-10-16 09:00:00", previewAt: "2026-10-16 09:00:00", customerName: "DEMO repair feedback", phone: "+393200009900", email: "", category: "手机", brand: "Apple", model: "DEMO Repair Feedback", color: "", serial: "", faults: ["屏幕：碎裂", "电池：不充电"], issue: "屏幕：碎裂、电池：不充电", accessories: [], services: structuredClone(emptyIntakeServices), priority: "普通", photoCount: 0, photos: [], custody: "store", itemQuotes: [{ item: "屏幕", amountCents: 0 }, { item: "电池", amountCents: null }] };
const requirement = currentRepairRequirements(intakeDirectoryEntry(intake), initialRepairWorkflow(intakeDirectoryEntry(intake)))[0];
const batteryRequirement = currentRepairRequirements(intakeDirectoryEntry(intake), initialRepairWorkflow(intakeDirectoryEntry(intake))).find(row => row.title === "电池")!;
const purchases: ProcurementRecord[] = [1,2,3].map((n) => ({ id: `PO-DEMO-FEEDBACK-${n}`, repairId: id, item: n === 3 ? "DEMO legacy item" : "屏幕", supplier: `DEMO supplier ${n}`, quantity: 1, unitCostCents: null, expectedAt: "", reference: "", specification: "DEMO original specification", events: [], ...(n === 3 ? {} : { requirementId: requirement.id, requirementRevision: requirement.revision }) }));

test.beforeEach(async ({ page }, info) => {
  if (info.title.includes("@offline")) return;
  expect((await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } })).status()).toBe(200);
  await page.addInitScript(({ intake, purchases, settings, intakeKey }) => {
    if (localStorage.getItem("repair-feedback-seeded")) return;
    localStorage.setItem("repair-feedback-seeded", "1"); localStorage.setItem(intakeKey, JSON.stringify({ version: 1, records: [intake], signatures: [] })); localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: purchases, repairUpdates: {} })); localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: {} })); localStorage.setItem("chinatech.m1.store-settings.v1", JSON.stringify({ version: 1, settings }));
  }, { intake, purchases, settings: defaultStoreSettings, intakeKey });
});

test("@offline repair supplier boundary and photo controls use real React without network", async ({ page }, info) => {
  await exerciseRepairFeedbackFixture(page, resolve(".local/ui-proof/repair-feedback", info.project.name + "-memory"));
});

test("repair feedback three tabs retain all scoped purchases and orphan records", async ({ page }, info) => {
  await page.goto(`/app/repairs/${id}`); const tabs = page.getByRole("tablist", { name: "工单详情分组", exact: true }); await expect(tabs.getByRole("tab")).toHaveCount(3);
  const repair = tabs.getByRole("tab", { name: /^维修/ }); await repair.focus(); await repair.press("End"); await expect(tabs.getByRole("tab", { name: /^历史/ })).toBeFocused(); await page.keyboard.press("ArrowRight"); await expect(repair).toBeFocused(); await page.keyboard.press("ArrowLeft"); await expect(tabs.getByRole("tab", { name: /^历史/ })).toBeFocused(); await page.keyboard.press("Home"); await expect(repair).toBeFocused();
  await expect(page.getByText("采购进度", { exact: true })).toHaveCount(0); await page.getByRole("button", { name: /^全部配件记录/ }).click(); const dialog = page.getByRole("dialog", { name: "供应商与配件", exact: true }); await dialog.locator(".repair-existing-parts > summary").click();
  const select = dialog.getByRole("combobox", { name: "本次操作的配件", exact: true }); await expect(select.locator("option")).toHaveCount(3);
  expect(await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual(["PO-DEMO-FEEDBACK-1", "PO-DEMO-FEEDBACK-2", "PO-DEMO-FEEDBACK-3"]);
  const selectedItem = dialog.locator(".repair-parts-dialog__item");
  await select.selectOption("PO-DEMO-FEEDBACK-3"); await expect(select).toHaveValue("PO-DEMO-FEEDBACK-3"); await expect(selectedItem.getByText("DEMO legacy item", { exact: true })).toBeVisible(); await expect(selectedItem.getByText(/^DEMO supplier 3 · 1\s+件$/)).toBeVisible();
  await select.selectOption("PO-DEMO-FEEDBACK-2"); await expect(select).toHaveValue("PO-DEMO-FEEDBACK-2"); await expect(selectedItem.getByText("屏幕", { exact: true })).toBeVisible(); await expect(selectedItem.getByText(/^DEMO supplier 2 · 1\s+件$/)).toBeVisible(); await dialog.getByRole("button", { name: "关闭配件操作", exact: true }).click();
  const screenProject = page.locator(`[data-repair-project="${requirement.id}"]`), batteryProject = page.locator(`[data-repair-project="${batteryRequirement.id}"]`);
  await expect(screenProject).toHaveCount(1); await expect(batteryProject).toHaveCount(1);
  await expect(screenProject.getByRole("button", { name: "修改屏幕报价", exact: true }).getByText("€0.00", { exact: true })).toBeVisible();
  await expect(batteryProject.getByRole("button", { name: "修改电池报价", exact: true }).getByText("未报价", { exact: true })).toBeVisible(); await expect(page.getByLabel("维修报价", { exact: true })).toContainText("待补全报价");
  await page.evaluate(data => { data.currentId="DEMO-VIEWER"; localStorage.setItem("chinatech.m1.staff.v1",JSON.stringify({version:1,data})); window.dispatchEvent(new Event("chinatech-staff-change")); }, structuredClone(defaultStaffData));
  await expect(page.getByRole("button", {name:"选择屏幕供应商",exact:true})).toBeDisabled(); await page.getByRole("button", {name:/^全部配件记录/}).click(); await expect(page.getByRole("dialog", {name:"供应商与配件",exact:true}).getByRole("button", {name:"保存",exact:true})).toHaveCount(0); await page.getByRole("button", {name:"关闭配件操作",exact:true}).click();
  mkdirSync(".local/ui-proof/repair-feedback", { recursive: true }); await page.screenshot({ path: `.local/ui-proof/repair-feedback/${info.project.name}-three-tabs.png` });
});

test("repair supplier pending-project controls stay inline and retain native form ownership", async ({ page }) => {
  await page.goto(`/app/repairs/${id}`); await page.getByRole("button", { name: "选择电池供应商", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "供应商与配件", exact: true }); await expect(dialog.getByText("维修项目核对", { exact: true })).toHaveCount(0); const note = dialog.getByLabel("无需采购说明", { exact: true }); await expect(note).toBeVisible(); expect(await note.evaluate(node => (node as HTMLInputElement).form)).toBeNull();
  await dialog.getByLabel("电池报价", { exact: true }).fill("45"); await note.fill("DEMO manual only"); await note.press("Enter"); await expect(dialog).toBeVisible();
  const save = dialog.getByRole("button", { name: "保存", exact: true }); expect(await save.evaluate(node => (node as HTMLButtonElement).form?.classList.contains("repair-item-editor"))).toBe(true); await save.click(); await expect(dialog).not.toBeVisible(); await page.reload();
  const batteryProject = page.locator(`[data-repair-project="${batteryRequirement.id}"]`); await expect(batteryProject).toHaveCount(1); await expect(batteryProject.getByRole("button", { name: "修改电池报价", exact: true }).getByText("€45.00", { exact: true })).toBeVisible();
});

test("repair list names concrete projects and keeps toolbar action boxes aligned", async ({ page }, info) => {
  await page.goto("/app/repairs"); const search = page.getByRole("textbox", { name: "搜索维修工单", exact: true }); await search.fill("DEMO Repair Feedback");
  const button = page.getByRole("button", { name: `${id} 供应商与配件操作`, exact: true }); await expect(button).toBeVisible(); await expect(button.locator(".repair-row-parts__chips")).toContainText("屏幕"); await expect(button.locator(".repair-row-parts__chips")).toContainText("电池"); await expect(button).toHaveAccessibleDescription(/DEMO legacy item/);
  const rows: unknown[] = []; for (const width of [1440, 1024, 390, 375]) { await page.setViewportSize({ width, height: 900 }); const boxes = await page.locator(".repair-filterbar > .module-search, .repair-filterbar > .repair-filter-trigger, .repair-filterbar > .module-select").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height)); expect(boxes.every(height => height === 48)).toBe(true); const actions = await page.locator(".module-heading__actions > .button,.module-heading__actions > .icon-button").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height)); expect(actions.every(height => height === 44)).toBe(true); expect(await button.locator(".repair-row-parts__chips").evaluate(n => n.getBoundingClientRect().height)).toBeLessThanOrEqual(43); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); rows.push({ width, boxes, actions }); }
  mkdirSync(".local/ui-proof/repair-feedback", { recursive: true }); writeFileSync(resolve(".local/ui-proof/repair-feedback", info.project.name + "-toolbar.json"), JSON.stringify(rows, null, 2));
});

for (const locale of ["zh-CN", "it", "en"] as const) test(`repair request source keeps custom preset-word collisions in list and detail (${locale})`, async ({ page }) => {
  const rawRequests = ["主板", "需检查腐蚀", "进水：需检查腐蚀", "DEMO 原始长要求 · 不加热、不替换，先检查每个连接器。".repeat(5)];
  const order = intakeDirectoryEntry(intake), workflow = initialRepairWorkflow(order);
  workflow.requirements = [...currentRepairRequirements(order, workflow), ...rawRequests.map((request, index) => ({ id: `project:DEMO-raw-${index}`, title: "屏幕", request, revision: 1, mode: "pending" as const, confirmed: false, deviceFingerprint: order.deviceFingerprint }))];
  await page.addInitScript(({ id, workflow, locale }) => {
    localStorage.setItem("chinatech.language", locale);
    localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: { [id]: workflow } }));
  }, { id, workflow, locale });
  await page.goto("/app/repairs");
  const button = page.getByRole("button", { name: translate("{v0} 供应商与配件{v1}", locale, { v0: id, v1: translate("操作", locale) }), exact: true });
  await expect(button).toBeVisible();
  const description = page.locator(`[id="${await button.getAttribute("aria-describedby")}"]`);
  for (const raw of rawRequests) await expect(description).toContainText(raw);
  await expect(button).toHaveAccessibleDescription(await description.textContent() ?? "");
  const descriptionBounds = await description.boundingBox();
  expect(descriptionBounds?.width).toBeLessThanOrEqual(1);
  expect(descriptionBounds?.height).toBeLessThanOrEqual(1);
  await page.goto(`/app/repairs/${id}`);
  for (const [index, raw] of rawRequests.entries()) await expect(page.locator(`[data-repair-project="project:DEMO-raw-${index}"]`).getByText(raw, { exact: true })).toBeVisible();
});
