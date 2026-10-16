import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { intakeDirectoryEntry, matchingIntakeSignature, intakeSignatureSnapshot, validLocalIntake, validIntakeSignature, type IntakeReceiptData, type IntakeSignature } from "../../lib/repair-intake-record";
import { currentRepairRequirements, validateRepairRequirements } from "../../lib/repair-requirements";
import { initialRepairWorkflow } from "../../lib/repair-workflow";
import { validateProcurementDraft } from "../../lib/procurement";
import { repairPrintProjection, canonicalPrintJson, receiptSmallScale, receiptPaperGeometry } from "../../lib/repair-print-layout";
import { itemQuoteTotal } from "../../lib/repair-item-pricing";
import { printLabel, printMoney, type PrintLanguage } from "../../lib/print-language";
import { repairIntakeTermsVersion } from "../../lib/repair-print-terms";
import { renderRepairReceipt, launchReceiptBrowser, ReceiptRenderError } from "../../lib/backend/repair-receipt-renderer";
import { repairReceiptHtml } from "../../lib/repair-receipt-template";
import { PDFDocument } from "pdf-lib";
import type { Browser } from "playwright-core";
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
let cssModules: Record<string, Record<string, string>>;
let cssInputs: Record<string, string>;
let sourceInputs: Record<string, string>;
const provider = `
export const useBackendState = () => ({formal:window.printFixture.formal!==false,active:window.printFixture.active!==false,snapshot:{intakes:[window.printFixture.data],signatures:window.printFixture.signatures,workflows:window.printFixture.workflows,storeId:window.printFixture.scope??'DEMO-STORE',staff:{currentId:'DEMO-MEMBER',members:[{id:'DEMO-MEMBER',revision:1,permissions:window.printFixture.permissions??['repairs.view'],accountStatus:'active',membershipStatus:'active',role:'technician'}]}}});
export const useBackendMode = () => true;
export const useStoreSettings = () => ({settings:window.printFixture.settings,ready:!window.printFixture.unavailable,error:null});
export const useLocalIntakes = () => ({signatures:window.printFixture.signatures,ready:true,error:null});
export const useRepairDirectory = () => window.printFixture.directory;
export const useRepairWorkflows = () => ({workflows:window.printFixture.workflows,ready:window.printFixture.workflowReady,error:window.printFixture.workflowError});
export const useLanguage = () => ({locale:'it',t:text=>text,systemText:text=>text});
`;
const entry = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {IntakeReceipt} from '@/components/repairs/intake-receipt';
import {OperationFeedbackProvider} from '@/components/operation-feedback';
import {printDate} from '@/lib/print-language';
window.fixturePrintDate=printDate;
function Fixture(){const trigger=React.useRef(null);const[open,setOpen]=useState(true);const[,update]=useState(0);window.updatePrintFixture=value=>{window.printFixture=value;update(n=>n+1)};return <><button id="trigger" ref={trigger} onClick={()=>setOpen(true)}>DEMO print</button>{open&&<IntakeReceipt restoreFocusRef={trigger} data={window.printFixture.data} onClose={()=>setOpen(false)}/>}</>}
document.getElementById('root').innerHTML='<button id="initial-focus">DEMO focus</button>';
document.getElementById('initial-focus').focus();
createRoot(document.getElementById('root')).render(<OperationFeedbackProvider><Fixture/></OperationFeedbackProvider>);
`;
async function buildFixture() {
    sourceInputs = Object.fromEntries(["components/repairs/intake-receipt.tsx", "components/repairs/receipt-pdf-preview.tsx", "lib/repair-receipt-template.ts", "lib/backend/repair-receipt-renderer.ts", "lib/backend/repair-receipt.ts", "app/api/backend/repair-receipt/route.ts", "server-assets/receipt/NotoSansSC-400.ttf", "server-assets/receipt/NotoSansSC-700.ttf", "package-lock.json", "next.config.ts", moduleFile, globalsFile, "lib/print-language.ts", "lib/repair-print-terms.ts", "lib/repair-requirements.ts", "lib/repair-detail-view.ts", "lib/repair-item-pricing.ts", "lib/repair-requirement-display.ts", "lib/repair-print-layout.ts", "components/operation-feedback.tsx", "components/operation-feedback.module.css"].map(file => [file, createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")]));
    const swc = native("next/dist/build/swc");
    await swc.loadBindings();
    const moduleFiles = [moduleFile, "components/operation-feedback.module.css"];
    cssModules = {};
    moduleCss = "";
    for (const file of moduleFiles) {
        const compiled = swc.getBindingsSync().css.lightning.transform({ filename: file, code: Buffer.from(readFileSync(resolve(root, file))), cssModules: true, minify: true });
        cssModules[file] = Object.fromEntries(Object.entries(compiled.exports as Record<string, {
            name: string;
        }>).map(([key, value]) => [key, value.name]));
        moduleCss += compiled.code.toString();
    }
    globalCss = readFileSync(resolve(root, globalsFile), "utf8");
    cssInputs = Object.fromEntries([...moduleFiles, globalsFile].map(file => [file, createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")]));
    if (process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR) {
        const collect = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? collect(resolve(directory, entry.name)) : entry.name.endsWith(".css") ? [resolve(directory, entry.name)] : []);
        const contents = collect(resolve(process.env.REPAIR_PRINT_PRODUCTION_CSS_DIR)).map(file => ({ file, css: readFileSync(file, "utf8") }));
        const all = contents.map(row => row.css).join("\n");
        for (const file of moduleFiles) {
            const prefix = file === moduleFile ? "intake-receipt-module__" : "operation-feedback-module__";
            cssModules[file] = Object.fromEntries(Object.keys(cssModules[file]).map(name => { const found = [...new Set(all.match(new RegExp(`${prefix}[a-zA-Z0-9_-]+__${name}(?![a-zA-Z0-9_-])`, "g")))]; if (found.length !== 1)
                throw new Error(`Missing/ambiguous production CSS ${file}:${name}`); return [name, found[0]]; }));
        }
            moduleCss = all;
        globalCss = "";
        cssInputs = Object.fromEntries(contents.map(row => [row.file, createHash("sha256").update(row.css).digest("hex")]));
    }
    const embeddedFont = `url("data:font/woff2;base64,${readFileSync(resolve(root, "public/fonts/source-sans-3/source-sans-3-roman.woff2")).toString("base64")}")`;
    const inlineFont = (css: string) => css.replace(/url\((?:"[^"]+\.woff2"|'[^']+\.woff2'|[^)]+\.woff2)\)/g, embeddedFont);
    moduleCss = inlineFont(moduleCss);
    globalCss = inlineFont(globalCss);
    const ids = new Map<string, number>(), modules: string[] = [];
    const seams = new Set(["components/backend-snapshot", "components/settings/settings-store", "components/repairs/local-intake-store", "components/repairs/repair-workflow-store", "components/language-provider"]);
    const locate = (request: string, parent: string) => {
        const rel = request.startsWith("@/") ? request.slice(2) : request.startsWith(".") ? resolve(dirname(parent), request).slice(root.length + 1) : null;
        if (rel && seams.has(rel))
            return "virtual:providers.tsx";
        if (rel === "components/repairs/intake-signature")
            return "virtual:signature.tsx";
        if (request === "lucide-react")
            return "virtual:icons";
        if (request.endsWith(".css"))
            return "virtual:css:" + (request.startsWith("@/") ? request.slice(2) : resolve(dirname(parent), request).slice(root.length + 1));
        if (request === "pdfjs-dist") return "virtual:pdfjs";
        if (request === "@zxing/library")
            return "virtual:qr";
        const file = request.startsWith("@/") ? resolve(root, request.slice(2)) : request.startsWith(".") ? resolve(dirname(parent), request) : native.resolve(request);
        if (existsSync(file) && extname(file))
            return file;
        for (const suffix of [".tsx", ".ts", ".js", "/index.js"])
            if (existsSync(file + suffix))
                return file + suffix;
        throw new Error(`Cannot resolve ${request} from ${parent}`);
    };
    const add = (file: string): number => {
        if (ids.has(file))
            return ids.get(file)!;
        const id = modules.length;
        ids.set(file, id);
        modules.push("");
        let code: string;
        if (file === "virtual:icons")
            code = 'module.exports=new Proxy({}, {get:(_t,name)=>props=>__require(REACT).createElement("svg",{...props,width:props.size??24,height:props.size??24,"data-icon":String(name)})});'.replace("REACT", String(add(native.resolve("react"))));
        else if (file.startsWith("virtual:css:"))
            code = `module.exports={__esModule:true,default:${JSON.stringify(cssModules[file.slice(12)])}};`;
        else if (file === "virtual:pdfjs") code = "module.exports=window.fixturePdfJs";
        else if (file === "virtual:qr")
            code = `const actual=__require(${add(native.resolve("@zxing/library"))});module.exports={...actual,MultiFormatWriter:class extends actual.MultiFormatWriter{encode(...args){if(window.printFixture.qrFailure)throw new Error('DEMO QR failure');return super.encode(...args)}}};`;
        else {
            let raw = file === "virtual:providers.tsx" ? provider : file === "virtual:entry.tsx" ? entry : file === "virtual:signature.tsx" ? `import React from 'react';const styles={image:'signature-image'};const useLanguage=()=>({t:text=>text});\n${readFileSync(resolve(root, "components/repairs/intake-signature.tsx"), "utf8").split("export function SignatureImage")[1].split("function SignaturePad")[0].replace(/^/, "export function SignatureImage")}` : readFileSync(file, "utf8");
            // about:blank has origin "null". Supply only the QR payload base, while
            // preserving the real writer/QR matrix; this URL is never requested.
            if (file === resolve(root, "components/repairs/intake-receipt.tsx"))
                raw = raw.replace("window.location.origin", '"https://print-fixture.invalid"');
            if (file === resolve(root, "components/repairs/receipt-pdf-preview.tsx")) raw = raw.replace('new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()', 'window.fixturePdfWorker');
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
    return { data, directory: [order], workflows: { [data.id]: initialRepairWorkflow(order) }, signatures: [signature], settings: { ...policy, paper: "a5", repairWarrantyMonths: 6 }, unavailable: false, workflowReady: true, workflowError: "" };
}
type PrintFixture = ReturnType<typeof fixture> & {
    active?: boolean;
    scope?: string;
    qrFailure?: boolean; formal?: boolean; permissions?: string[];
    fontPending?: boolean;
};
const coverageScenarios = ["partial-quotes", "fault-only", "workflow-project", "same-title", "unmatched-quote", "zero-unknown", "multiple-purchases", "free-mainboard", "free-corrosion", "free-fault-phrase", "free-long-text", "apple-no-request", "legacy-no-requirements", "legacy-no-fingerprint", "apple-history", "mixed-quote-groups"] as const;
function coverageFixture(scenario: typeof coverageScenarios[number]) {
    const input = fixture(false);
    if (scenario === "partial-quotes")
        input.data.itemQuotes = [{ item: "屏幕", amountCents: 0 }];
    if (scenario === "fault-only") {
        input.data.services = { screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" } };
        input.data.faults = ["主板：无法开机"];
        input.data.issue = [input.data.faults.join("、"), input.data.issueNote].filter(Boolean).join("；");
        input.data.itemQuotes = [];
    }
    if (scenario === "same-title" || scenario === "mixed-quote-groups")
        input.data.itemQuotes![0].amountCents = 9876;
    if (scenario === "unmatched-quote")
        input.data.itemQuotes!.push({ item: "DEMO historical connector service", amountCents: 12345 });
    if (scenario === "zero-unknown")
        input.data.itemQuotes![1].amountCents = null;
    if (scenario === "apple-no-request" || scenario === "apple-history") {
        input.data.services.battery.quality = "";
        input.data.faults = input.data.faults!.filter(text => !text.startsWith("电池："));
        input.data.issue = [input.data.faults.join("、"), input.data.issueNote].join("；");
    }
    const order = intakeDirectoryEntry(input.data);
    const workflow = initialRepairWorkflow(order);
    const freeRequests: Partial<Record<typeof scenario, string>> = {
        "free-mainboard": "主板",
        "free-corrosion": "需检查腐蚀",
        "free-fault-phrase": "进水：需检查腐蚀",
        "free-long-text": "DEMO 自由要求：主板；需检查腐蚀；进水：需检查腐蚀。Keep the customer's exact original punctuation and wording. ".repeat(12) + "DEMO FREE REQUEST END",
    };
    if (scenario === "workflow-project" || scenario === "same-title" || scenario === "mixed-quote-groups" || scenario.startsWith("free-"))
        workflow.requirements = [{ id: "project:DEMO-added", title: scenario === "same-title" || scenario === "mixed-quote-groups" ? "屏幕" : "DEMO liquid inspection", request: freeRequests[scenario] ?? (scenario === "same-title" || scenario === "mixed-quote-groups" ? "DEMO matte OLED; retain the original display and inspect the connector separately." : "DEMO inspect every connector without heat; record corrosion before proposing replacement."), revision: 3, mode: "pending", confirmed: false, deviceFingerprint: order.deviceFingerprint }];
    input.directory = [order];
    input.workflows = { [input.data.id]: workflow };
    if (scenario === "legacy-no-requirements")
        delete order.requirements;
    if (scenario === "legacy-no-fingerprint")
        for (const row of order.requirements ?? [])
            delete row.sourceFingerprint;
    input.signatures[0].snapshot = intakeSignatureSnapshot(input.data, input.data.policy!);
    if (scenario === "apple-history") {
        expect(matchingIntakeSignature(input.signatures, input.data, input.data.policy!)).toBe(input.signatures[0]);
        input.data.serial = "DEMO-SERIAL-0006";
        input.directory = [intakeDirectoryEntry(input.data)];
        input.workflows = { [input.data.id]: initialRepairWorkflow(input.directory[0]) };
        expect(matchingIntakeSignature(input.signatures, input.data, input.data.policy!)).toBeUndefined();
    }
    if (scenario === "mixed-quote-groups") {
        const quotes = input.data.itemQuotes!;
        input.data.itemQuotes = [{ item: "DEMO unmatched before 1", amountCents: 12345 }, { item: "DEMO unmatched before 2", amountCents: null }, quotes[0], { item: "DEMO unmatched after", amountCents: 54321 }, ...quotes.slice(1)];
    }
    const procurementRecords = scenario === "multiple-purchases" ? [1, 2].map(n => ({ id: `DEMO-PURCHASE-${n}`, repairId: input.data.id, item: "屏幕", supplier: `DEMO PRIVATE SUPPLIER ${n}`, quantity: 1, unitCostCents: 7654321, expectedAt: "", reference: "DEMO PRIVATE COST REFERENCE", events: [], requirementId: "intake:屏幕", requirementRevision: 1 })) : [];
    return { ...input, procurementRecords };
}
let renderer: Browser;
const fixturePdfs = new Map<string, Awaited<ReturnType<typeof renderRepairReceipt>>>();
let pdfjs: typeof import('pdfjs-dist');
const qr = () => { const {MultiFormatWriter,BarcodeFormat}=native('@zxing/library'); const matrix=new MultiFormatWriter().encode('https://www.chinatech.in/app/repairs/LOCAL-0000000000000005',BarcodeFormat.QR_CODE,0,0,new Map());let path='';for(let y=0;y<matrix.getHeight();y++)for(let x=0;x<matrix.getWidth();x++)if(matrix.get(x,y))path+=`M${x} ${y}h1v1h-1z`;return {path,size:matrix.getWidth()}; };
function projection(input: PrintFixture, language: PrintLanguage) { const requirements=currentRepairRequirements(input.directory[0],input.workflows[input.data.id]);return repairPrintProjection({data:input.data,requirements,policy:input.data.policy??input.settings,signature:matchingIntakeSignature(input.signatures,input.data,input.data.policy??input.settings),hasHistory:input.signatures.length>0,language,totalCents:input.data.itemQuotes?.length?itemQuoteTotal(input.data.itemQuotes,requirements.map(r=>r.title)):null,technician:printLabel('unassigned',language),status:input.workflows[input.data.id].status,custody:input.workflows[input.data.id].custody??'unknown',formal:true,qr:qr()}); }
async function generate(input:PrintFixture,paper:'a4'|'a5'|'half'|'double',language:PrintLanguage) {const p=projection(input,language), key=canonicalPrintJson([p,paper]);let result=fixturePdfs.get(key);if(!result){result=await renderRepairReceipt(p,paper,renderer);fixturePdfs.set(key,result);}return {p,...result};}
const normalized=(value:string)=>value.normalize('NFKC').replace(/\s+/g,'');
async function text(bytes:Uint8Array) {const task=pdfjs.getDocument({data:bytes.slice(),useSystemFonts:false});try {const doc=await task.promise;expect(doc.numPages).toBe(1);const page=await doc.getPage(1);return (await page.getTextContent({disableNormalization:true})).items.map(item=>'str'in item?item.str:'').join(' ');}finally{await task.destroy();}}
async function contentProof(input:PrintFixture,paper:'a4'|'a5'|'half'|'double',language:PrintLanguage) {
 const result=await generate(input,paper,language), p=result.p, readableOutput=(await text(result.bytes)).replace(/\s+/g,' '), output=normalized(readableOutput);
 const texts=[p.shopName,p.shopContact,p.orderId,...p.identity.map(r=>r.value),...p.device.map(r=>r.value),...p.shortFacts.map(r=>r.value),...p.serviceFacts.map(r=>r.value),p.total,...p.rows.flatMap(r=>[...r.texts,r.amount]),...p.reviewQuotes.flatMap(q=>[q.label,q.amount,q.note]),...(!p.merged?p.intakeServices:[]),...p.issue.faults,p.issue.note,...p.terms,p.rights,p.acknowledgement,p.scope,p.termsVersion,p.signature?.label??p.signatureHistory,p.labels.tracking,p.labels.scan,p.labels.trackingLimit,p.labels.keepReceipt];
 for(const value of texts.filter(Boolean))expect(output).toContain(normalized(value!));
 expect(output).not.toMatch(/DEMO PRIVATE|76543/);
 for(const metric of result.measurements){expect(metric.heightMm+1).toBeLessThanOrEqual(194);expect(metric.blocks.every(b=>!b.overflow)).toBe(true);expect(metric.bodyPt*receiptSmallScale).toBeGreaterThanOrEqual(10);expect(metric.corePt*receiptSmallScale).toBeGreaterThanOrEqual(11.1);expect(metric.qrMm*receiptSmallScale).toBeGreaterThanOrEqual(20);}
 const doc=await PDFDocument.load(result.bytes),box=doc.getPage(0).getSize(),geometry=receiptPaperGeometry(paper);expect(box.width*25.4/72).toBeCloseTo(geometry.widthMm,6);expect(box.height*25.4/72).toBeCloseTo(geometry.heightMm,6);
 return {...result,output,readableOutput};
}
test.beforeAll(async()=>{mkdirSync(evidence,{recursive:true});await buildFixture();renderer=await launchReceiptBrowser();pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');});
test.afterAll(async()=>{await renderer?.close();});
async function mount(page:Page,input:PrintFixture=fixture(false),mode:{delay?:boolean;error?:string;status?:number}={}) {
 const observed={requests:[] as Array<{id:string;paper:'a4'|'a5'|'half'|'double';language:PrintLanguage;expectedRevision:number}>,errors:[] as string[],external:[] as string[]};let current=input;let release:(()=>void)|undefined;let delayed=mode.delay?new Promise<void>(r=>release=r):null;
 page.on('pageerror',e=>observed.errors.push(e.message));await page.route('**/*',route=>{if(/^(blob:|data:)/.test(route.request().url()))return route.continue();observed.external.push(route.request().url());return route.abort();});
 await page.exposeFunction('fixtureReceiptRequest',async(request:typeof observed.requests[number])=>{observed.requests.push(request);const captured=current;await delayed;if(mode.error)return {status:mode.status??422,code:mode.error};try{const result=await generate(captured,request.paper,request.language);return {status:200,bytes:Array.from(result.bytes)};}catch(e){if(e instanceof ReceiptRenderError)return {status:422,code:e.code==='overflow'?'printOverflow':'printLayoutError',blocks:e.blocks};throw e;}});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.addStyleTag({content:globalCss+'\n'+moduleCss});
 await page.evaluate(({input,worker})=>{Object.assign(window,{printFixture:input,fixturePdfWorker:worker,receiptUrls:[] as string[],receiptRevoked:[] as string[],receiptOpened:[] as string[],receiptBlobs:{} as Record<string,Blob>});const w=window as unknown as Record<string,unknown>;const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);(w.receiptUrls as string[]).push(url);if(blob instanceof Blob)(w.receiptBlobs as Record<string,Blob>)[url]=blob;return url;};URL.revokeObjectURL=url=>{(w.receiptRevoked as string[]).push(url);revoke(url);};const fetch=window.fetch.bind(window);window.fetch=async(url,init)=>{if(String(url)!=='/api/backend/repair-receipt')return fetch(url,init);const result=await (w.fixtureReceiptRequest as (request:unknown)=>Promise<{status:number;bytes:number[];code:string;blocks:string[]}>)(JSON.parse(init!.body as string));return result.status===200?new Response(new Uint8Array(result.bytes),{status:200,headers:{'content-type':'application/pdf'}}):Response.json({code:result.code,blocks:result.blocks},{status:result.status});};}, {input,worker:'data:text/javascript;base64,'+readFileSync(native.resolve('pdfjs-dist/build/pdf.worker.min.mjs')).toString('base64')});
 const pdfModule='data:text/javascript;base64,'+readFileSync(native.resolve('pdfjs-dist/build/pdf.min.mjs')).toString('base64');
 await page.evaluate(async module=>{Object.assign(window,{fixturePdfJs:await import(module)});},pdfModule);
 await page.addScriptTag({content:bundle});
 return {observed,update:async(next:PrintFixture)=>{current=next;await page.evaluate(value=>(window as unknown as {updatePrintFixture:(v:unknown)=>void}).updatePrintFixture(value),next);},release:()=>{delayed=null;release?.();},pause:()=>{delayed=new Promise<void>(r=>release=r);},mode};
}
async function selectPrint(page:Page,paper:string,language:PrintLanguage){await page.locator('select').nth(0).selectOption(paper);await page.locator('select').nth(1).selectOption(language);}
async function ready(page:Page){await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','ready');await expect.poll(()=>page.locator('dialog canvas[aria-hidden="true"]').evaluate((c:HTMLCanvasElement)=>c.width)).toBeGreaterThan(0);await expect(page.locator('dialog canvas[aria-hidden="true"]')).toBeVisible();await expect(page.locator('dialog [role="document"]')).toContainText('DEMO');}
for(const paper of ['a4','a5','half','double'] as const)for(const language of ['it','en','zh'] as PrintLanguage[])test(`单页母版真实PDF ${paper}/${language}`,async({page},info)=>{
 const input=fixture(false);expect(validLocalIntake(input.data)).toBe(true);expect(validIntakeSignature(input.signatures[0])).toBe(true);
 const result=await contentProof(input,paper,language);expect(result.p.merged).toBe(true);expect(result.p.rows).toHaveLength(3);expect(result.p.intakeServices).toHaveLength(4);expect(result.output).toContain(normalized(printLabel('customerCopy',language)));if(paper==='double')expect(result.output).toContain(normalized(printLabel('shopCopy',language)));
 const mounted=await mount(page,input);await selectPrint(page,paper,language);await ready(page);
 const href=await page.getByRole('link',{name:printLabel('pdfDownload',language)}).getAttribute('href');const actual=await page.evaluate(async url=>Array.from(new Uint8Array(await (window as unknown as {receiptBlobs:Record<string,Blob>}).receiptBlobs[url!].arrayBuffer())),href);expect(Buffer.from(actual)).toEqual(Buffer.from(result.bytes));
 const a4=await generate(input,'a4',language),a5=await generate(input,'a5',language);expect(normalized(await text(a4.bytes))).toBe(normalized(await text(a5.bytes)));expect(a4.measurements).toEqual(a5.measurements);expect(a4.measurements[0].density).toBe(language==='zh'?'spacious':'standard');
 writeFileSync(resolve(evidence,`${info.project.name}-${language}-${paper}.pdf`),result.bytes);writeFileSync(resolve(evidence,`${info.project.name}-${language}-${paper}.json`),JSON.stringify({measurements:result.measurements,sha256:createHash('sha256').update(result.bytes).digest('hex'),sourceInputs,cssInputs}));expect(mounted.observed.external).toEqual([]);expect(mounted.observed.errors).toEqual([]);
});
for(const scenario of coverageScenarios)for(const language of ['it','en','zh'] as PrintLanguage[])test(`完整原文真实PDF ${scenario}/${language}`,async({page},info)=>{
 const input=coverageFixture(scenario),p=projection(input,language);expect(validLocalIntake(input.data)).toBe(true);validateRepairRequirements(currentRepairRequirements(input.directory[0],input.workflows[input.data.id]));for(const row of input.procurementRecords)expect(validateProcurementDraft(row)).toEqual(row);
 const html=repairReceiptHtml(p,{latin:'',chinese:''});const plain=await page.evaluate(html=>new DOMParser().parseFromString(html,'text/html').body.textContent!,html);
 for(const row of p.rows)for(const value of row.texts)expect(plain).toContain(value);for(const term of p.terms)expect(plain).toContain(term);
 if(scenario==='apple-history')expect(p.signature).toBeNull();else expect(p.signature).not.toBeNull();
 if(scenario==='legacy-no-requirements'){expect(p.merged).toBe(false);expect(p.rows).toHaveLength(0);}if(scenario==='legacy-no-fingerprint'||scenario==='apple-no-request')expect(p.merged).toBe(false);
 if(scenario.startsWith('free-')){const raw=input.workflows[input.data.id].requirements![0].request;expect(plain).toContain(raw);if(scenario==='free-long-text')expect(raw).toHaveLength(1077);}
 if(scenario==='partial-quotes'){expect(p.rows).toHaveLength(3);expect(p.rows[0].amount).toBe(printMoney(0,language));expect(p.rows.slice(1).every(r=>r.amount===printLabel('define',language))).toBe(true);}
 if(scenario==='same-title'){expect(p.rows.filter(r=>r.ambiguous)).toHaveLength(2);expect(p.reviewQuotes.filter(r=>r.item==='屏幕')).toHaveLength(1);}
 if(scenario==='unmatched-quote')expect(p.reviewQuotes).toHaveLength(1);
 if(scenario==='zero-unknown'){expect(p.rows[0].amount).toBe(printMoney(0,language));expect(p.rows[1].amount).toBe(printLabel('define',language));expect(p.total).toBe(printLabel('unquoted',language));}
 if(scenario==='multiple-purchases'){expect(p.rows).toHaveLength(3);expect(plain).not.toMatch(/DEMO PRIVATE|76543/);}
 if(scenario==='mixed-quote-groups'){expect(p.reviewQuotes.map(r=>r.item)).toEqual(['DEMO unmatched before 1','DEMO unmatched before 2','屏幕','DEMO unmatched after']);expect(p.rows.filter(r=>r.ambiguous)).toHaveLength(2);expect(plain.split(printMoney(9876,language)).length-1).toBe(1);const groups=await page.evaluate(html=>[...new DOMParser().parseFromString(html,'text/html').querySelectorAll('[data-quote-association]')].map(el=>({kind:el.getAttribute('data-quote-association'),text:el.textContent})),html);expect(groups.map(g=>g.kind)).toEqual(['unmatched','ambiguous','unmatched']);expect(groups[0].text).toContain('DEMO unmatched before 1');expect(groups[0].text).toContain('DEMO unmatched before 2');expect(groups[2].text).toContain('DEMO unmatched after');}
 try{const result=await contentProof(input,'a5',language);if(scenario==='apple-history'){const a4=await contentProof(input,'a4',language);expect(a4.output).toBe(result.output);expect(a4.measurements).toEqual(result.measurements);writeFileSync(resolve(evidence,`${info.project.name}-${scenario}-${language}-a4.pdf`),a4.bytes);}expect(scenario).not.toBe('free-long-text');if(language==='en'&&['partial-quotes','zero-unknown'].includes(scenario))expect(result.readableOutput.split(printLabel('define',language)).length-1).toBe(p.rows.filter(row=>!row.ambiguous&&row.amountCents==null).length+1);writeFileSync(resolve(evidence,`${info.project.name}-${scenario}-${language}.pdf`),result.bytes);writeFileSync(resolve(evidence,`${info.project.name}-${scenario}-${language}.json`),JSON.stringify({measurements:result.measurements,sha256:createHash('sha256').update(result.bytes).digest('hex')}));}catch(e){if(!(e instanceof ReceiptRenderError))throw e;expect(e.code).toBe('overflow');expect(e.blocks.length).toBeGreaterThan(0);writeFileSync(resolve(evidence,`${info.project.name}-${scenario}-${language}-overflow.json`),JSON.stringify({code:e.code,blocks:e.blocks,measurements:e.measurements}));if(scenario.startsWith('legacy-')||['apple-no-request','apple-history','partial-quotes','zero-unknown','multiple-purchases'].includes(scenario))throw e;}
});
for(const paper of ['a4','a5','half','double'] as const)for(const language of ['it','en','zh'] as PrintLanguage[])test(`长原文全纸拒绝PDF ${paper}/${language}`,async({page})=>{const input=fixture(true);const mounted=await mount(page,input);await selectPrint(page,paper,language);await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','error');await expect(page.getByRole('alert')).toContainText(printLabel('printOverflow',language));await expect(page.getByRole('button',{name:printLabel('pdfOpenPrint',language),exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:printLabel('pdfDownload',language)})).toHaveCount(0);expect(await page.evaluate('window.receiptUrls')).toEqual([]);expect(mounted.observed.external).toEqual([]);});
for(const width of [1440,1024,390,375])test(`四宽真实PDF预览触控 ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});const mounted=await mount(page);await ready(page);
 for(const target of await page.locator('dialog button:not(select button),dialog a[download],dialog select').all()){if(!await target.isVisible())continue;const b=await target.boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.width).toBeGreaterThanOrEqual(44);}
 const widths=await page.evaluate(()=>({body:document.body.scrollWidth,window:window.innerWidth,dialog:document.querySelector('dialog')!.getBoundingClientRect().width}));expect(widths.body).toBeLessThanOrEqual(widths.window);expect(widths.dialog).toBeLessThanOrEqual(width);
 const pixels=await page.locator('dialog canvas[aria-hidden="true"]').evaluate((canvas:HTMLCanvasElement)=>{const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let dark=0;for(let i=0;i<data.length;i+=4)if(data[i]<150&&data[i+1]<150&&data[i+2]<150)dark++;return dark;});expect(pixels).toBeGreaterThan(100);
 await page.screenshot({path:resolve(evidence,`pdfjs-${info.project.name}-${width}.png`),fullPage:true});
 await page.locator('select').nth(2).selectOption('1');await expect.poll(()=>page.locator('dialog canvas[aria-hidden="true"]').evaluate((c:HTMLCanvasElement)=>parseFloat(c.style.width))).toBeGreaterThan(700);
 await page.locator('select').nth(2).selectOption('fit');await expect.poll(()=>page.locator('dialog canvas[aria-hidden="true"]').evaluate((c:HTMLCanvasElement)=>c.getBoundingClientRect().width)).toBeLessThan(width);
 expect(mounted.observed.errors).toEqual([]);expect(mounted.observed.external).toEqual([]);
});
test('同一PDF字节供预览 下载 打印 纸型语言缓存',async({page})=>{
 const mounted=await mount(page);await ready(page);const link=page.getByRole('link',{name:printLabel('pdfDownload','it')});const initial=await link.getAttribute('href');
 await page.evaluate(()=>{window.open=()=>({opener:null,location:{replace:(url:string)=>(window as unknown as {receiptOpened:string[]}).receiptOpened.push(url)},close:()=>{}} as unknown as Window);});await page.getByRole('button',{name:printLabel('pdfOpenPrint','it'),exact:true}).click();expect(await page.evaluate('window.receiptOpened')).toEqual([initial]);await expect(page.getByRole('status')).toContainText(printLabel('pdfPrintHelp','it'));
 const download=page.waitForEvent('download');await link.click();const saved=await download;expect(saved.suggestedFilename()).toBe('LOCAL-0000000000000005-it-a5.pdf');
 await selectPrint(page,'a5','en');await ready(page);await selectPrint(page,'a5','it');await ready(page);expect(await page.getByRole('link',{name:printLabel('pdfDownload','it')}).getAttribute('href')).toBe(initial);expect(mounted.observed.requests).toHaveLength(2);
 await selectPrint(page,'a4','it');await ready(page);expect(mounted.observed.requests).toHaveLength(3);expect(Object.keys(mounted.observed.requests[0]).sort()).toEqual(['expectedRevision','id','language','paper']);
});
test('保留上一份预览明确标记 当前未ready禁下载打印',async({page})=>{const mounted=await mount(page);await ready(page);const previous=await page.getByRole('link',{name:printLabel('pdfDownload','it')}).getAttribute('href');mounted.pause();await selectPrint(page,'a4','it');await expect(page.getByRole('note')).toHaveText(printLabel('pdfPreviousPreview','it'));await expect(page.locator('dialog [role="document"]')).toContainText('DEMO');await expect(page.getByRole('button',{name:printLabel('pdfOpenPrint','it'),exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:printLabel('pdfDownload','it')})).toHaveCount(0);mounted.mode.error='printFontError';mounted.release();await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','error');await expect(page.getByRole('note')).toHaveText(printLabel('pdfPreviousPreview','it'));expect(await page.evaluate('window.receiptRevoked')).not.toContain(previous);});
for(const status of [401,403])test(`服务端${status}即使前端身份未刷新仍销毁旧PDF`,async({page})=>{const mode={error:'',status};const mounted=await mount(page,fixture(false),mode);await ready(page);const previous=await page.getByRole('link',{name:printLabel('pdfDownload','it')}).getAttribute('href');mode.error='receiptUnavailable';await selectPrint(page,'a4','it');await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','unavailable');await expect(page.locator('dialog [role="document"]')).toHaveCount(0);await expect(page.getByRole('link',{name:printLabel('pdfDownload','it')})).toHaveCount(0);expect(await page.evaluate('window.receiptRevoked')).toContain(previous);await selectPrint(page,'a5','it');expect(mounted.observed.requests).toHaveLength(2);});
test('生成失败就地重试 保留选择且无PDF成功',async({page})=>{const mode={error:'printFontError'};const mounted=await mount(page,fixture(false),mode);await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','error');await expect(page.getByRole('alert')).toContainText(printLabel('printFontError','it'));expect(await page.evaluate('window.receiptUrls')).toEqual([]);mode.error='';await page.getByRole('button',{name:printLabel('printCheckRetry','it')}).click();await ready(page);expect(mounted.observed.requests).toHaveLength(2);});
test('初始资料未就绪阻止生成 就绪后自动生成',async({page})=>{const input=fixture(false);input.unavailable=true;const mounted=await mount(page,input);await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','unavailable');expect(mounted.observed.requests).toHaveLength(0);input.unavailable=false;input.settings.paper='a4';await mounted.update(input);await ready(page);expect(mounted.observed.requests).toHaveLength(1);expect(mounted.observed.requests[0].paper).toBe('a4');});
test('跨scope立即销毁PDF与迟到结果 不能重新回填',async({page})=>{const input=fixture(false);const mounted=await mount(page,input,{delay:true});await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','generating');await expect.poll(()=>mounted.observed.requests.length).toBe(1);await mounted.update({...input,scope:'OTHER-STORE'});mounted.release();await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','unavailable');await expect(page.locator('dialog canvas[aria-hidden="true"]')).toHaveCount(0);await expect(page.getByRole('link',{name:printLabel('pdfDownload','it')})).toHaveCount(0);await expect.poll(()=>page.evaluate('window.receiptUrls.length')).toBe(0);});
test('撤权清除现有Blob URL与预览',async({page})=>{const input=fixture(false),mounted=await mount(page,input);await ready(page);const url=await page.getByRole('link',{name:printLabel('pdfDownload','it')}).getAttribute('href');await mounted.update({...input,permissions:[]});await expect(page.locator('dialog')).toHaveAttribute('data-pdf-phase','unavailable');await expect(page.locator('dialog canvas[aria-hidden="true"]')).toHaveCount(0);expect(await page.evaluate('window.receiptRevoked')).toContain(url);});
test('资料版本变化立即销毁原文件并重新生成',async({page})=>{const input=fixture(false),mounted=await mount(page,input);await ready(page);const url=await page.getByRole('link',{name:printLabel('pdfDownload','it')}).getAttribute('href');const next=structuredClone(input);next.data.revision=2;next.data.model='DEMO Revised Model';await mounted.update(next);await expect.poll(()=>page.evaluate('window.receiptRevoked')).toContain(url);await ready(page);expect(mounted.observed.requests).toHaveLength(2);expect(mounted.observed.requests[1].expectedRevision).toBe(2);});
test('打印窗口失败有三语错误且预览仍可用',async({page})=>{await mount(page);await ready(page);await page.evaluate(()=>{window.open=()=>null;});await page.getByRole('button',{name:printLabel('pdfOpenPrint','it'),exact:true}).click();await expect(page.getByRole('alert')).toContainText(printLabel('printWindowError','it'));await expect(page.locator('dialog canvas[aria-hidden="true"]')).toBeVisible();await expect(page.getByRole('link',{name:printLabel('pdfDownload','it')})).toBeVisible();});
test('关闭清理URL恢复焦点 重新打开重新生成',async({page},info)=>{const mounted=await mount(page);await ready(page);const url=await page.getByRole('link',{name:printLabel('pdfDownload','it')}).getAttribute('href');await page.getByRole('button',{name:printLabel('close','it')}).click();await expect(page.locator('dialog')).toHaveCount(0);expect(await page.evaluate('window.receiptRevoked')).toContain(url);await expect(page.locator('#trigger')).toBeFocused();if(info.project.name==='webkit-touch')await page.locator('#trigger').tap();else await page.locator('#trigger').click();await ready(page);expect(mounted.observed.requests).toHaveLength(2);await page.keyboard.press('Escape');await expect(page.locator('#trigger')).toBeFocused();});
test('DEMO只显示三语限制不创建客户PDF',async({page})=>{const mounted=await mount(page,{...fixture(false),formal:false});for(const language of ['it','en','zh'] as PrintLanguage[]){await selectPrint(page,'a5',language);await expect(page.getByRole('alert')).toContainText(printLabel('receiptFormalOnly',language));await expect(page.getByRole('button',{name:printLabel('pdfOpenPrint',language),exact:true})).toBeDisabled();}expect(mounted.observed.requests).toHaveLength(0);});
test('历史签名失配保留原文提示无原笔迹',async({page},info)=>{const input=fixture(false);input.data.serial='DEMO-SERIAL-CHANGED';for(const language of ['it','en','zh'] as PrintLanguage[]){const p=projection(input,language);expect(p.signature).toBeNull();const html=repairReceiptHtml(p,{latin:'',chinese:''});expect(html).not.toContain('<polyline');expect(html).toContain(p.signatureHistory);const result=await contentProof(input,'a5',language);writeFileSync(resolve(evidence,`${info.project.name}-signature-mismatch-${language}.pdf`),result.bytes);}await mount(page,input);await ready(page);});
test('折线长无空格型号完整保留且跨栏拒绝',async()=>{const input=fixture(false);input.data.model='M'.repeat(160);input.data.policy!.shopName='S'.repeat(200);const p=projection(input,'it');try{const result=await contentProof(input,'a5','it');expect(result.output).toContain(input.data.model);}catch(e){if(!(e instanceof ReceiptRenderError))throw e;expect(e.code).toBe('overflow');expect(e.blocks.length).toBeGreaterThan(0);}expect(repairReceiptHtml(p,{latin:'',chinese:''})).toContain(input.data.model);});
test('签名比例和全部原笔迹保留纯SVG不依赖界面语言',async()=>{const p=projection(fixture(false),'en');const html=repairReceiptHtml(p,{latin:'',chinese:''});expect(html).toContain('viewBox="0 0 800 250"');expect(html).toContain('points="80,150 240,50 400,200 640,75"');expect(html).toContain('preserveAspectRatio="xMinYMid meet"');});
test('打印语言同步zoom标签和值',async({page})=>{await mount(page);await ready(page);for(const language of ['zh','en','it'] as PrintLanguage[])for(const value of ['1','fit']){await page.locator('select').nth(2).selectOption(value);await page.locator('select').nth(1).selectOption(language);await ready(page);const select=page.getByRole('combobox',{name:printLabel('previewZoom',language)});await expect(select).toHaveValue(value);await expect(select.locator('option')).toHaveText([printLabel('fitScreen',language),'100%']);}});

test('中文与兼容部首客户原文逐码点保留可选文本',async()=>{const input=fixture(false),raw='DEMO 原文 客户 戶 门 門 ⻔ 日 ⽇ 月 ⽉ ⼾';input.data.issueNote=raw;input.data.issue=[input.data.faults!.join('、'),raw].join('；');const result=await generate(input,'a5','zh');expect((await text(result.bytes)).replace(/\s+/g,'')).toContain(raw.replace(/\s+/g,''));expect(repairReceiptHtml(result.p,{latin:'',chinese:''})).toContain(raw);});

// Each natural note length gets its own normal test budget. The ordinary
// browser fixture above has three faults and a longer accessory description;
// this boundary fixture starts from the two-fault display sample.
for (let lines = 1; lines <= 12; lines++) test(`自然内容留白边界 ${lines} 行`, async () => {
 const input = fixture(false);
 input.data.faults = input.data.faults!.slice(0, 2);
 input.data.accessories = ['SIM 卡', '数据线'];
 input.data.issueNote = Array.from({ length: lines }, (_, index) => `DEMO original customer detail ${index + 1}. Keep every word.`).join('\n');
 input.data.issue = [...input.data.faults, input.data.issueNote].join('；');
 input.signatures[0].snapshot = intakeSignatureSnapshot(input.data, input.data.policy!);
 input.directory = [intakeDirectoryEntry(input.data)];
 input.workflows = { [input.data.id]: initialRepairWorkflow(input.directory[0]) };
 try {
  const a4 = await contentProof(input, 'a4', 'en'), a5 = await contentProof(input, 'a5', 'en');
  expect(a4.measurements).toEqual(a5.measurements);
  expect(a4.output).toBe(a5.output);
  const metric = a4.measurements[0];
  expect(metric.attempts.at(-1)?.overflow).toEqual([]);
  expect(metric.attempts.slice(0, -1).every(attempt => attempt.overflow.length > 0)).toBe(true);
  if (lines === 1) expect(metric.density).toBe('spacious');
  expect(lines).toBeLessThan(12);
  writeFileSync(resolve(evidence, `natural-density-${lines}.json`), JSON.stringify({ lines, density: metric.density, measurements: a4.measurements }, null, 2));
 } catch (error) {
  if (!(error instanceof ReceiptRenderError)) throw error;
  expect(lines).toBeGreaterThan(1);
  expect(error.code).toBe('overflow');
  expect(error.measurements?.attempts.map(attempt => attempt.density)).toEqual(['spacious', 'standard', 'compact']);
  expect(error.measurements?.attempts.every(attempt => attempt.overflow.length > 0)).toBe(true);
  await expect(generate(input, 'a5', 'en')).rejects.toMatchObject({ code: 'overflow', measurements: error.measurements });
  writeFileSync(resolve(evidence, `natural-density-${lines}.json`), JSON.stringify({ lines, density: 'refused', measurements: error.measurements }, null, 2));
 }
});
