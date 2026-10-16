import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { intakeDirectoryEntry, intakeSignatureSnapshot, validLocalIntake, validIntakeSignature, type IntakeReceiptData, type IntakeSignature } from "../../lib/repair-intake-record";
import { currentRepairRequirements, validateRepairRequirements } from "../../lib/repair-requirements";
import { initialRepairWorkflow } from "../../lib/repair-workflow";
import { validateProcurementDraft } from "../../lib/procurement";
import { itemQuoteTotal } from "../../lib/repair-item-pricing";
import { printDate, printLabel, printLanguageName, printMoney, printServiceRequests, type PrintLanguage } from "../../lib/print-language";
import { repairIntakeTerms, repairIntakeStatutoryRights, repairIntakeAcknowledgement, repairIntakeTermsVersion } from "../../lib/repair-print-terms";

// A real React receipt on about:blank. Only in-memory providers, icons and the
// platform origin are seams. No server, storage, account or HTTP is involved.
const root = process.cwd();
const native = createRequire(resolve(root, "package.json"));
const evidence = resolve(process.env.REPAIR_PRINT_EVIDENCE_DIR ?? resolve(root, ".local/ui-proof/repair-print-layout", process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR ? "production-css" : "source-css"));
const moduleFile = "components/repairs/intake-receipt.module.css";
const globalsFile = "app/globals.css";
let bundle: string;
let moduleCss: string;
let globalCss: string;
let classes: Record<string, string>;
let cssInputs: Record<string, string>;
let sourceInputs: Record<string, string>;

const provider = `
export const useBackendMode = () => true;
export const useStoreSettings = () => ({settings:window.printFixture.settings,ready:!window.printFixture.unavailable,error:null});
export const useLocalIntakes = () => ({signatures:window.printFixture.signatures,ready:true,error:null});
export const useRepairDirectory = () => window.printFixture.directory;
export const useRepairWorkflows = () => ({workflows:window.printFixture.workflows});
export const useLanguage = () => ({locale:'it',t:text=>text,systemText:text=>text});
`;
const entry = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {IntakeReceipt} from '@/components/repairs/intake-receipt';
function Fixture(){const[open,setOpen]=useState(true);return <><button id="trigger" onClick={()=>setOpen(true)}>DEMO print</button>{open&&<IntakeReceipt data={window.printFixture.data} onClose={()=>setOpen(false)}/>}</>}
document.getElementById('root').innerHTML='<button id="initial-focus">DEMO focus</button>';
document.getElementById('initial-focus').focus();
createRoot(document.getElementById('root')).render(<Fixture/>);
`;

async function buildFixture() {
  sourceInputs = Object.fromEntries(["components/repairs/intake-receipt.tsx", moduleFile, globalsFile, "lib/print-language.ts", "lib/repair-print-terms.ts", "lib/repair-requirements.ts", "lib/repair-detail-view.ts", "lib/repair-item-pricing.ts", "lib/repair-requirement-display.ts"].map(file => [file, createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")]));
  const swc = native("next/dist/build/swc");
  await swc.loadBindings();
  const compiled = swc.getBindingsSync().css.lightning.transform({ filename: moduleFile, code: Buffer.from(readFileSync(resolve(root, moduleFile))), cssModules: true, minify: true });
  classes = Object.fromEntries(Object.entries(compiled.exports as Record<string, { name: string }>).map(([key, value]) => [key, value.name]));
  moduleCss = compiled.code.toString();
  globalCss = readFileSync(resolve(root, globalsFile), "utf8");
  cssInputs = Object.fromEntries([moduleFile, globalsFile].map(file => [file, createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")]));
  // The production gate feeds a frozen build's static directory to the same
  // receipt/fixture/assertions. Missing or ambiguous private classes fail closed.
  if (process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR) {
    const collect = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? collect(resolve(directory, entry.name)) : entry.name.endsWith(".css") ? [resolve(directory, entry.name)] : []);
    const files = collect(resolve(process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR));
    const contents = files.map(file => ({ file, css: readFileSync(file, "utf8") }));
    const receipt = contents.filter(row => row.css.includes("intake-receipt-module__"));
    if (!receipt.length) throw new Error("The selected production CSS has no IntakeReceipt module");
    const allReceipt = receipt.map(row => row.css).join("\n");
    classes = Object.fromEntries(Object.keys(classes).map(name => {
      const found = [...new Set(allReceipt.match(new RegExp(`intake-receipt-module__[a-zA-Z0-9_-]+__${name}(?![a-zA-Z0-9_-])`, "g")))];
      if (found.length !== 1) throw new Error(`Expected one production class for ${name}, got ${found.length}`);
      return [name, found[0]];
    }));
    moduleCss = allReceipt;
    globalCss = contents.filter(row => !receipt.includes(row)).map(row => row.css).join("\n");
    cssInputs = Object.fromEntries(contents.map(row => [row.file, createHash("sha256").update(row.css).digest("hex")]));
  }
  const embeddedFont = `url("data:font/woff2;base64,${readFileSync(resolve(root, "public/fonts/source-sans-3/source-sans-3-roman.woff2")).toString("base64")}")`;
  const inlineFont = (css: string) => css.replace(/url\((?:"[^"]+\.woff2"|'[^']+\.woff2'|[^)]+\.woff2)\)/g, embeddedFont);
  moduleCss = inlineFont(moduleCss); globalCss = inlineFont(globalCss);
  const ids = new Map<string, number>(), modules: string[] = [];
  const seams = new Set(["components/backend-snapshot", "components/settings/settings-store", "components/repairs/local-intake-store", "components/repairs/repair-workflow-store", "components/language-provider"]);
  const locate = (request: string, parent: string) => {
    const rel = request.startsWith("@/") ? request.slice(2) : request.startsWith(".") ? resolve(dirname(parent), request).slice(root.length + 1) : null;
    if (rel && seams.has(rel)) return "virtual:providers.tsx";
    if (rel === "components/repairs/intake-signature") return "virtual:signature.tsx";
    if (request === "lucide-react") return "virtual:icons";
    if (request.endsWith(".css")) return "virtual:css";
    const file = request.startsWith("@/") ? resolve(root, request.slice(2)) : request.startsWith(".") ? resolve(dirname(parent), request) : native.resolve(request);
    if (existsSync(file) && extname(file)) return file;
    for (const suffix of [".tsx", ".ts", ".js", "/index.js"]) if (existsSync(file + suffix)) return file + suffix;
    throw new Error(`Cannot resolve ${request} from ${parent}`);
  };
  const add = (file: string): number => {
    if (ids.has(file)) return ids.get(file)!;
    const id = modules.length; ids.set(file, id); modules.push("");
    let code: string;
    if (file === "virtual:icons") code = 'module.exports=new Proxy({}, {get:(_t,name)=>props=>__require(REACT).createElement("svg",{...props,width:props.size??24,height:props.size??24,"data-icon":String(name)})});'.replace("REACT", String(add(native.resolve("react"))));
    else if (file === "virtual:css") code = `module.exports={__esModule:true,default:${JSON.stringify(classes)}};`;
    else {
      let raw = file === "virtual:providers.tsx" ? provider : file === "virtual:entry.tsx" ? entry : file === "virtual:signature.tsx" ? `import React from 'react';const styles={image:'signature-image'};const useLanguage=()=>({t:text=>text});\n${readFileSync(resolve(root, "components/repairs/intake-signature.tsx"), "utf8").split("export function SignatureImage")[1].split("function SignaturePad")[0].replace(/^/, "export function SignatureImage")}` : readFileSync(file, "utf8");
      // about:blank has origin "null". Supply only the QR payload base, while
      // preserving the real writer/QR matrix; this URL is never requested.
      if (file === resolve(root, "components/repairs/intake-receipt.tsx")) raw = raw.replace("window.location.origin", '"https://print-fixture.invalid"');
      code = /\.tsx?$/.test(file) ? ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText : raw;
      code = code.replaceAll("process.env.NODE_ENV", '"production"');
    }
    code = code.replace(/require\(["']([^"']+)["']\)/g, (_match, request) => `__require(${add(locate(request, file))})`);
    modules[id] = `function(module,exports,__require){${code}\n}`;
    return id;
  };
  const id = add("virtual:entry.tsx");
  bundle = `(()=>{const m=[${modules.join(",")}],c={};function __require(id){if(c[id])return c[id].exports;const e=c[id]={exports:{}};m[id](e,e.exports,__require);return e.exports}__require(${id})})()`;
}

function fixture(long: boolean, unknown = false) {
  const policy = { months: 6, shopName: "DEMO Print Layout Shop", address: "DEMO Via di prova 1, 00100 Roma", phone: "+390000000001" };
  const more = long ? Array.from({ length: 24 }, (_, n) => `DEMO project ${String(n + 1).padStart(2, "0")} long repair request original text`).map((item, n) => ({ item, amountCents: n === 23 && unknown ? null : n * 103 })) : [];
  const faults = ["屏幕：碎裂", "电池：不充电", "尾插：接触不良", ...more.map(row => `${row.item}：DEMO symptom`)];
  const issueNote = long ? "DEMO original customer note. Keep the device and inspect each requested repair separately. ".repeat(12) + "DEMO NOTE END" : "DEMO original customer note.";
  const data: IntakeReceiptData = { id: "LOCAL-0000000000000005", createdAt: "2026-10-16 09:00:00", updatedAt: "2026-10-16 09:00:00", previewAt: "2026-10-16 09:00:00", customerName: "DEMO PRINT CUSTOMER", phone: "+390000000002", email: "", category: "手机", brand: "Apple", model: long ? "DEMO long model identity with original customer text and complete serial distinction ".repeat(2).slice(0, 160) : "DEMO Phone 16", serial: "DEMO-SERIAL-0005", color: "黑色", issue: [faults.join("、"), issueNote].join("；"), faults, issueNote, services: { screen: { quality: "assembled", technology: "oled" }, battery: { quality: "original", appleService: "both" }, port: { quality: "original" } }, accessories: ["SIM 卡", "DEMO charging cable"], priority: "普通", photoCount: 0, custody: "store", policy, itemQuotes: [{ item: "屏幕", amountCents: 0 }, { item: "电池", amountCents: unknown && !long ? null : 6000 }, { item: "尾插", amountCents: 4000 }, ...more] };
  const signature: IntakeSignature = { id: "DEMO-SIGNATURE", orderId: data.id, actorId: "DEMO-ACTOR", signedAt: "2026-10-16 09:00:00", language: "it", termsVersion: repairIntakeTermsVersion, aspectRatio: 3.2, strokes: [[{ x: .1, y: .6 }, { x: .3, y: .2 }, { x: .5, y: .8 }, { x: .8, y: .3 }]], snapshot: intakeSignatureSnapshot(data, policy) };
  const order = intakeDirectoryEntry(data);
  return { data, directory: [order], workflows: { [data.id]: initialRepairWorkflow(order) }, signatures: [signature], settings: { ...policy, paper: "a5", repairWarrantyMonths: 6 }, unavailable: false };
}

async function mount(page: Page, data = fixture(false), moduleFirst = false) {
  const requests: string[] = [], errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>');
  await page.addStyleTag({ content: moduleFirst ? moduleCss + globalCss : globalCss + moduleCss });
  await page.evaluate(value => { Object.assign(window, { printFixture: value }); }, data);
  await page.addScriptTag({ content: `(()=>{const active=new Set();const Native=window.ResizeObserver;window.ResizeObserver=class extends Native{observe(...args){active.add(this);return super.observe(...args)}disconnect(){active.delete(this);return super.disconnect()}};window.printFixtureObserverCount=()=>active.size})()` });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("dialog[open]")).toBeVisible();
  await expect(page.locator(`.${classes.qr} path`)).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  return { requests, errors };
}

test.beforeAll(async () => { mkdirSync(evidence, { recursive: true }); await buildFixture(); });

for (const format of ["a5", "a4", "half", "double"] as const) for (const language of ["it", "en", "zh"] as PrintLanguage[]) for (const long of [false, true]) {
  test(`接机打印 ${format}/${language}/${long ? "long" : "regular"} 大字完整自然分页`, async ({ page, browserName }, info) => {
    const input = fixture(long, long);
    expect(validLocalIntake(input.data)).toBe(true);
    expect(validIntakeSignature(input.signatures[0])).toBe(true);
    const observed = await mount(page, input, long);
    await page.getByRole("combobox", { name: printLabel("paper", "it"), exact: true }).selectOption(format);
    await page.getByRole("combobox", { name: printLabel("printLanguage", "it"), exact: true }).selectOption(language);
    const copies = page.locator(`.${classes.copy}`);
    await expect(copies).toHaveCount(format === "double" ? 2 : 1);
    for (const copy of await copies.all()) {
      await expect(copy).toHaveAttribute("lang", language);
      await expect(copy).toContainText(input.data.model);
      await expect(copy).toContainText(input.data.issueNote!);
      for (const term of [...repairIntakeTerms[language], repairIntakeStatutoryRights[language], repairIntakeAcknowledgement[language], repairIntakeTermsVersion]) await expect(copy).toContainText(term);
      await expect(copy.locator(`[data-print-current-projects] .${classes.requests} tbody tr`)).toHaveCount(input.data.itemQuotes!.length);
      await expect(copy.locator(`[data-print-current-projects] .${classes.requests} tbody tr`).first()).toContainText(printMoney(0, language));
      await expect(copy.locator(`.${classes.amounts}`)).toContainText(long ? printLabel("unquoted", language) : printMoney(10000, language));
      await expect(copy.locator(`.${classes.signatureImage} svg`)).toHaveAttribute("viewBox", "0 0 800 250");
      await expect(copy.locator(`.${classes.signatureImage} polyline`)).toHaveAttribute("points", "80,150 240,50 400,200 640,75");
      await expect(copy).toContainText(printLabel("signatureLanguage", language));
      await expect(copy).toContainText("16");
    }
    await page.setViewportSize({ width: Math.round((format === "a4" ? 281 : 194) * 96 / 25.4), height: 1000 });
    await page.emulateMedia({ media: "print" });
    const metrics = await page.evaluate(({ names }) => {
      // CSSOM serialises 10pt as 13.3333px. Retain that raw value and report
      // points to 0.001pt, rather than interpreting serialisation as smaller type.
      const pointSize = (element: Element) => Number((parseFloat(getComputedStyle(element).fontSize) * .75).toFixed(3));
      const sizes = [...document.querySelectorAll(`.${names.copy} p,.${names.copy} li,.${names.copy} small,.${names.copy} dd,.${names.copy} th,.${names.copy} td`)].filter(e => e.textContent?.trim()).map(e => ({ element: e.tagName, cssPx: getComputedStyle(e).fontSize, pt: pointSize(e) }));
      return { sizes, minPt: Math.min(...sizes.map(row => row.pt)), modelPt: pointSize(document.querySelector(`.${names.model}`)!), corePt: [names.issue,names.requests,names.amounts].map(name => pointSize(document.querySelector(`.${name}`)!)), copyWidth: document.querySelector(`.${names.copy}`)!.getBoundingClientRect().width, naturalCopyHeights: [...document.querySelectorAll(`.${names.document}`)].map(e=>e.getBoundingClientRect().height*25.4/96), scrollClips: [...document.querySelectorAll(`.${names.copy} *`)].filter(e => e instanceof HTMLElement && (getComputedStyle(e).overflowY === "hidden" || getComputedStyle(e).textOverflow === "ellipsis")).map(e => ({tag:e.tagName,className:e.getAttribute("class")})), paired: document.querySelector(`.${names.sheets}`)?.getAttribute("data-paired"), url: location.href };
    }, { names: classes });
    expect(metrics.minPt).toBeGreaterThanOrEqual(10);
    expect(metrics.modelPt).toBeGreaterThanOrEqual(11);
    for (const corePt of metrics.corePt) expect(corePt).toBeGreaterThanOrEqual(11);
    expect(Math.round(metrics.copyWidth * 25.4 / 96 * 10) / 10).toBe(format === "a4" ? 281 : 194);
    expect(metrics.scrollClips).toEqual([]);
    expect(metrics.url).toBe("about:blank");
    const name = `${format}-${language}-${long ? "long" : "regular"}-${info.project.name}`;
    const expectedPdf = { copyLabels: (format === "double" ? ["customerCopy", "shopCopy"] as const : ["customerCopy"] as const).map(key => printLabel(key, language)), terms: repairIntakeTerms[language], tableHeaders: [printLabel("description", language), printLabel("amount", language)], phrases: [input.data.model, input.data.issueNote!, repairIntakeStatutoryRights[language], repairIntakeAcknowledgement[language], repairIntakeTermsVersion, `${printLabel("signatureLanguage", language)}: ${printLanguageName(input.signatures[0].language, language)} · ${printLabel("signedAt", language)}: ${printDate(input.signatures[0].signedAt, language)}`, printLabel("keepReceipt", language), ...printServiceRequests(input.data.services, language), printLabel("intakeRequests", language), printLabel("currentRepairProjects", language), printLabel("currentProjectsSignatureScope", language)], corePhrases: [input.data.model, input.data.issueNote!], rows: await copies.first().locator(`[data-print-current-projects] .${classes.requests} tbody tr`).evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(cell => cell.textContent ?? ""))), orderId: input.data.id };
    let pages: number | undefined;
    if (browserName === "chromium") {
      const pdf = await page.pdf({ path: resolve(evidence, `${name}.pdf`), preferCSSPageSize: true, printBackground: true });
      const raw = pdf.toString("latin1");
      pages = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length;
      expect(pages).toBeGreaterThan(0);
      if (long) expect(pages).toBeGreaterThan(1);
      if (format === "double" && metrics.paired !== "true") expect(pages % 2).toBe(0);
      const mediaBox = [...raw.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(match => match[1].trim().split(/\s+/).map(Number));
      expect(mediaBox.length).toBeGreaterThan(0);
      for (const box of mediaBox) {
        const [width, height] = [box[2], box[3]];
        const expected = format === "a5" ? [210, 148] : format === "a4" ? [297, 210] : [210, 297];
        expect(Math.abs(width * 25.4 / 72 - expected[0])).toBeLessThan(.5);
        expect(Math.abs(height * 25.4 / 72 - expected[1])).toBeLessThan(.5);
      }
    }
    await page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: true, animations: "disabled", scale: "css" });
    writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify({ fixture: "DEMO only; in-memory providers; QR payload origin seam", format, language, long, browserName, pages, metrics, expectedPdf, requests: observed.requests, errors: observed.errors, sourceSha256: sourceInputs, cssInputs, cssEvidence: process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR ? "Actual frozen Next production CSS input directory; embedded existing local font bytes" : "Next bundled Lightning CSS compilation of current module + current globals; full next build remains a separate gate" }, null, 2));
    expect(observed.requests).toEqual([]);
    expect(observed.errors).toEqual([]);
  });
}

test("接机打印未知金额/历史签名/不可读取门控及关闭焦点保持", async ({ page }) => {
  const input = fixture(false, true);
  input.signatures[0].snapshot.model = "DEMO historical device";
  const observed = await mount(page, input);
  await expect(page.locator(`.${classes.amounts}`)).toContainText(printLabel("unquoted", "it"));
  await expect(page.locator(`.${classes.requests} tbody tr`).first()).toContainText(printMoney(0, "it"));
  await expect(page.locator(`.${classes.requests} tbody tr`).nth(1)).toContainText(printLabel("define", "it"));
  await expect(page.locator(`.${classes.signatureImage} svg`)).toHaveCount(0);
  await expect(page.locator(`.${classes.copy}`)).toContainText(printLabel("historicalSignature", "it"));
  await page.getByRole("button", { name: printLabel("close", "it") }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.locator("#trigger").focus();
  await page.locator("#trigger").press("Enter");
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator("#trigger")).toBeFocused();
  expect(observed.requests).toEqual([]);
  expect(observed.errors).toEqual([]);
  input.unavailable = true;
  await page.evaluate(value => Object.assign(window, { printFixture: value }), input);
  await page.locator("#trigger").click();
  await expect(page.getByRole("button", { name: printLabel("print", "it"), exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText(printLabel("receiptUnavailable", "it"));
});

test("双联只按真实打印宽度测量且重复打印/resize/切纸/卸载稳定", async ({ page }) => {
  const observed = await mount(page);
  const paper = page.getByRole("combobox", { name: printLabel("paper", "it"), exact: true });
  await paper.selectOption("double");
  const sheets = page.locator(`.${classes.sheets}`);
  await expect(sheets).toHaveAttribute("data-paired", "false");
  await expect.poll(() => page.evaluate("window.printFixtureObserverCount()")).toBe(1);
  await page.emulateMedia({ media: "print" });
  const stable = await page.evaluate(async name => {
    await document.fonts.ready;
    const element = document.querySelector(`.${name}`)!;
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(element, { attributes: true, attributeFilter: ["data-paired"] });
    const before = element.getAttribute("data-paired");
    for (let n = 0; n < 3; n++) window.dispatchEvent(new Event("beforeprint"));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    observer.disconnect();
    return { before, after: element.getAttribute("data-paired"), mutations };
  }, classes.sheets);
  expect(stable.before).toBe(stable.after); expect(stable.mutations).toBe(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(sheets).toHaveAttribute("data-paired", stable.after!);
  await page.emulateMedia({ media: "screen" });
  await expect(sheets).toHaveAttribute("data-paired", "false");
  await paper.selectOption("half");
  await expect.poll(() => page.evaluate("window.printFixtureObserverCount()")).toBe(0);
  await paper.selectOption("double");
  await expect.poll(() => page.evaluate("window.printFixtureObserverCount()")).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect.poll(() => page.evaluate("window.printFixtureObserverCount()")).toBe(0);
  expect(observed.requests).toEqual([]); expect(observed.errors).toEqual([]);
});

test("接机打印预览四宽保持操作触达及内容容器内滚动", async ({ page }, info) => {
  const observed = await mount(page, fixture(true, true));
  const paper = page.getByRole("combobox", { name: printLabel("paper", "it"), exact: true });
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await paper.selectOption("a4");
    await expect(page.getByText(printLabel("longContentContinues", "it"), { exact: true })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector("dialog")!.getBoundingClientRect();
      const copy = document.querySelector("article[data-copy]")!;
      const columns = copy.querySelector("table > tbody > tr:nth-child(2)")!;
      const columnsWidth = [...columns.children].map(e => e.getBoundingClientRect().width);
      return { columnsWidth, copyInnerWidth: copy.clientWidth - parseFloat(getComputedStyle(copy).paddingLeft) - parseFloat(getComputedStyle(copy).paddingRight), viewportOverflow: document.documentElement.scrollWidth > innerWidth, left: dialog.left, right: dialog.right, width: innerWidth, selectPx: [...document.querySelectorAll("select")].map(e => parseFloat(getComputedStyle(e).fontSize)), targets: [...document.querySelectorAll(".intake-receipt-toolbar > button, .intake-receipt-toolbar select")].map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right })) };
    });
    expect(geometry.viewportOverflow).toBe(false);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    for (const target of geometry.targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); expect(target.left).toBeGreaterThanOrEqual(geometry.left); expect(target.right).toBeLessThanOrEqual(geometry.right); }
    if (width < 768) { for (const font of geometry.selectPx) expect(font).toBeGreaterThanOrEqual(16); for (const columnWidth of geometry.columnsWidth) expect(columnWidth).toBeGreaterThanOrEqual(geometry.copyInnerWidth - 1); }
    await page.screenshot({ path: resolve(evidence, `preview-${width}-${info.project.name}.png`), animations: "disabled", scale: "css" });
  }
  expect(observed.requests).toEqual([]); expect(observed.errors).toEqual([]);
});

const coverageScenarios = ["partial-quotes", "fault-only", "workflow-project", "same-title", "unmatched-quote", "zero-unknown", "multiple-purchases", "free-mainboard", "free-corrosion", "free-fault-phrase", "free-long-text"] as const;
function coverageFixture(scenario: typeof coverageScenarios[number]) {
  const input = fixture(false);
  if (scenario === "partial-quotes") input.data.itemQuotes = [{ item: "屏幕", amountCents: 0 }];
  if (scenario === "fault-only") {
    input.data.services = { screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" } };
    input.data.faults = ["主板：无法开机"];
    input.data.issue = [input.data.faults.join("、"), input.data.issueNote].filter(Boolean).join("；");
    input.data.itemQuotes = [];
  }
  if (scenario === "same-title") input.data.itemQuotes![0].amountCents = 9876;
  if (scenario === "unmatched-quote") input.data.itemQuotes!.push({ item: "DEMO historical connector service", amountCents: 12345 });
  if (scenario === "zero-unknown") input.data.itemQuotes![1].amountCents = null;
  const order = intakeDirectoryEntry(input.data);
  const workflow = initialRepairWorkflow(order);
  const freeRequests: Partial<Record<typeof scenario, string>> = {
    "free-mainboard": "主板",
    "free-corrosion": "需检查腐蚀",
    "free-fault-phrase": "进水：需检查腐蚀",
    "free-long-text": "DEMO 自由要求：主板；需检查腐蚀；进水：需检查腐蚀。Keep the customer's exact original punctuation and wording. ".repeat(12) + "DEMO FREE REQUEST END",
  };
  if (scenario === "workflow-project" || scenario === "same-title" || scenario.startsWith("free-")) workflow.requirements = [{ id: "project:DEMO-added", title: scenario === "same-title" ? "屏幕" : "DEMO liquid inspection", request: freeRequests[scenario] ?? (scenario === "same-title" ? "DEMO matte OLED; retain the original display and inspect the connector separately." : "DEMO inspect every connector without heat; record corrosion before proposing replacement."), revision: 3, mode: "pending", confirmed: false, deviceFingerprint: order.deviceFingerprint }];
  input.directory = [order]; input.workflows = { [input.data.id]: workflow };
  input.signatures[0].snapshot = intakeSignatureSnapshot(input.data, input.data.policy!);
  const procurementRecords = scenario === "multiple-purchases" ? [1, 2].map(n => ({ id: `DEMO-PURCHASE-${n}`, repairId: input.data.id, item: "屏幕", supplier: `DEMO PRIVATE SUPPLIER ${n}`, quantity: 1, unitCostCents: 7654321, expectedAt: "", reference: "DEMO PRIVATE COST REFERENCE", events: [], requirementId: "intake:屏幕", requirementRevision: 1 })) : [];
  return { ...input, procurementRecords };
}

for (const scenario of coverageScenarios) for (const language of ["it", "en", "zh"] as PrintLanguage[]) {
  test(`接机打印完整项目 ${scenario}/${language} 原签名范围及金额不猜配`, async ({ page, browserName }, info) => {
    const input = coverageFixture(scenario);
    const requirements = currentRepairRequirements(input.directory[0], input.workflows[input.data.id]);
    validateRepairRequirements(requirements);
    for (const record of input.procurementRecords) validateProcurementDraft(record);
    expect(validLocalIntake(input.data)).toBe(true); expect(validIntakeSignature(input.signatures[0])).toBe(true);
    const snapshot = JSON.stringify(input.signatures[0].snapshot);
    const observed = await mount(page, input);
    const format = scenario === "same-title" || scenario === "unmatched-quote" ? "double" : "a5";
    await page.getByRole("combobox", { name: printLabel("paper", "it"), exact: true }).selectOption(format);
    await page.getByRole("combobox", { name: printLabel("printLanguage", "it"), exact: true }).selectOption(language);
    const copies = page.locator(`.${classes.copy}`);
    const total = itemQuoteTotal(input.data.itemQuotes, requirements.map(row => row.title));
    for (const copy of await copies.all()) {
      const current = copy.locator("[data-print-current-projects]");
      const rows = current.locator("tbody tr");
      await expect(rows).toHaveCount(requirements.length);
      await expect(current).toContainText(printLabel("currentProjectsSignatureScope", language));
      for (const requirement of requirements) {
        const row = current.locator(`tr[data-requirement-id="${requirement.id}"]`);
        await expect(row).toHaveAttribute("data-requirement-revision", String(requirement.revision));
        await expect(row).toHaveAttribute("data-requirement-request", requirement.request);
        if (requirement.id === "project:DEMO-added") {
          await expect(row).toContainText(requirement.request);
          const visibleBody = row.locator("td").first();
          await expect(visibleBody).toBeVisible();
          expect(await visibleBody.textContent()).toContain(requirement.request);
        }
        if (requirement.id === "intake:屏幕") await expect(row).toContainText("OLED");
        if (requirement.id === "intake:电池") await expect(row).toContainText(printServiceRequests(input.data.services, language).find(request => request.startsWith("Apple · "))!);
      }
      const intake = copy.locator("[data-print-intake-requests]");
      await expect(intake).toContainText(printLabel("intakeRequests", language));
      for (const request of printServiceRequests(input.data.services, language)) await expect(intake).toContainText(request);
      await expect(copy.locator(`.${classes.amounts}`)).toContainText(total === null ? printLabel("unquoted", language) : printMoney(total, language));
      await expect(copy.locator(`.${classes.signatureImage} svg`)).toHaveAttribute("viewBox", "0 0 800 250");
      await expect(copy.locator(`.${classes.signatureImage} polyline`)).toHaveAttribute("points", "80,150 240,50 400,200 640,75");
      await expect(copy).not.toContainText(printLabel("historicalSignature", language));
      await expect(copy).toContainText(repairIntakeAcknowledgement[language]);
      await expect(copy).not.toContainText("DEMO PRIVATE");
      if (scenario === "partial-quotes" || scenario === "zero-unknown") {
        await expect(current.locator('tr[data-requirement-id="intake:屏幕"] td').last()).toHaveText(printMoney(0, language));
        await expect(current.locator('tr[data-requirement-id="intake:电池"] td').last()).toHaveText(printLabel("define", language));
      }
      if (scenario === "same-title") {
        await expect(current.locator('tr[data-requirement-id="intake:屏幕"] td').last()).toHaveText(printLabel("pending", language));
        await expect(current.locator('tr[data-requirement-id="project:DEMO-added"] td').last()).toHaveText(printLabel("pending", language));
        await expect(current).not.toContainText(printMoney(9876, language));
        await expect(copy.locator("[data-print-review-quotes] tbody tr")).toHaveCount(1);
        await expect(copy.locator("[data-print-review-quotes] td").last()).toHaveText(printMoney(9876, language));
      }
      if (scenario === "unmatched-quote") {
        await expect(copy.locator("[data-print-review-quotes] tbody tr")).toHaveCount(1);
        await expect(copy.locator("[data-print-review-quotes]")).toContainText("DEMO historical connector service");
        await expect(copy.locator("[data-print-review-quotes] td").last()).toHaveText(printMoney(12345, language));
      }
      if (scenario === "multiple-purchases") {
        expect(input.procurementRecords).toHaveLength(2);
        await expect(rows).toHaveCount(3);
        await expect(current.locator('tr[data-requirement-id="intake:屏幕"] td').last()).toHaveText(printMoney(0, language));
        await expect(copy.locator(`.${classes.amounts}`)).toContainText(printMoney(10000, language));
      }
    }
    expect(await page.evaluate(() => JSON.stringify((window as unknown as { printFixture: ReturnType<typeof coverageFixture> }).printFixture.signatures[0].snapshot))).toBe(snapshot);
    await page.emulateMedia({ media: "print" });
    const metrics = await page.evaluate(names => ({ paired: document.querySelector(`.${names.sheets}`)?.getAttribute("data-paired"), minPt: Math.min(...[...document.querySelectorAll(`.${names.copy} p,.${names.copy} li,.${names.copy} small,.${names.copy} dd,.${names.copy} th,.${names.copy} td`)].filter(e => e.textContent?.trim()).map(e => Number((parseFloat(getComputedStyle(e).fontSize) * .75).toFixed(3)))) }), classes);
    expect(metrics.minPt).toBeGreaterThanOrEqual(10);
    const expectedPdf = { copyLabels: (format === "double" ? ["customerCopy", "shopCopy"] as const : ["customerCopy"] as const).map(key => printLabel(key, language)), terms: repairIntakeTerms[language], tableHeaders: [printLabel("description", language), printLabel("amount", language)], phrases: [input.data.model, input.data.issueNote!, repairIntakeStatutoryRights[language], repairIntakeAcknowledgement[language], repairIntakeTermsVersion, `${printLabel("signatureLanguage", language)}: ${printLanguageName(input.signatures[0].language, language)} · ${printLabel("signedAt", language)}: ${printDate(input.signatures[0].signedAt, language)}`, printLabel("keepReceipt", language), printLabel("intakeRequests", language), printLabel("currentRepairProjects", language), printLabel("currentProjectsSignatureScope", language), ...printServiceRequests(input.data.services, language)], corePhrases: [input.data.model, input.data.issueNote!], rows: await copies.first().locator(`.${classes.requests} tbody tr`).evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(cell => cell.textContent ?? ""))), orderId: input.data.id, exactAmounts: scenario === "fault-only" ? [] : [printMoney(scenario === "same-title" ? 9876 : scenario === "unmatched-quote" ? 12345 : 0, language)] };
    const output = resolve(evidence, "coverage"); mkdirSync(output, { recursive: true });
    const name = `${scenario}-${language}-${info.project.name}`;
    let pages: number | undefined;
    if (browserName === "chromium") {
      const pdf = await page.pdf({ path: resolve(output, `${name}.pdf`), preferCSSPageSize: true, printBackground: true });
      pages = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
      expect(pages).toBeGreaterThan(0);
    }
    writeFileSync(resolve(output, `${name}.json`), JSON.stringify({ scenario, format, language, long: false, browserName, pages, metrics, expectedPdf, requirements, quotes: input.data.itemQuotes, totalCents: total, procurementRecords: input.procurementRecords, signatureSnapshotUnchanged: true, requests: observed.requests, errors: observed.errors, sourceSha256: sourceInputs, cssInputs }, null, 2));
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, animations: "disabled", scale: "css" });
    expect(observed.requests).toEqual([]); expect(observed.errors).toEqual([]);
  });
}
