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
import { repairPrintProjection, canonicalPrintJson, receiptProjectionHash, receiptMaster, receiptSmallScale, receiptPaperGeometry } from "../../lib/repair-print-layout";
import { itemQuoteTotal } from "../../lib/repair-item-pricing";
import { printDate, printLabel, printMoney, type PrintLanguage } from "../../lib/print-language";
import { repairIntakeTerms, repairIntakeTermsVersion } from "../../lib/repair-print-terms";
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
let cssModules: Record<string, Record<string, string>>;
let cssInputs: Record<string, string>;
let sourceInputs: Record<string, string>;
const provider = `
export const useBackendState = () => ({formal:true,active:window.printFixture.active!==false,snapshot:{storeId:window.printFixture.scope??'DEMO-STORE',staff:{currentId:'DEMO-MEMBER',members:[{id:'DEMO-MEMBER',revision:1,permissions:['repairs.view'],accountStatus:'active',membershipStatus:'active',role:'technician'}]}}});
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
function Fixture(){const[open,setOpen]=useState(true);const[,update]=useState(0);window.updatePrintFixture=value=>{window.printFixture=value;update(n=>n+1)};return <><button id="trigger" onClick={()=>setOpen(true)}>DEMO print</button>{open&&<IntakeReceipt data={window.printFixture.data} onClose={()=>setOpen(false)}/>}</>}
document.getElementById('root').innerHTML='<button id="initial-focus">DEMO focus</button>';
document.getElementById('initial-focus').focus();
createRoot(document.getElementById('root')).render(<OperationFeedbackProvider><Fixture/></OperationFeedbackProvider>);
`;
async function buildFixture() {
    sourceInputs = Object.fromEntries(["components/repairs/intake-receipt.tsx", moduleFile, globalsFile, "lib/print-language.ts", "lib/repair-print-terms.ts", "lib/repair-requirements.ts", "lib/repair-detail-view.ts", "lib/repair-item-pricing.ts", "lib/repair-requirement-display.ts", "lib/repair-print-layout.ts", "components/operation-feedback.tsx", "components/operation-feedback.module.css"].map(file => [file, createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")]));
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
    classes = cssModules[moduleFile];
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
        classes = cssModules[moduleFile];
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
        else if (file === "virtual:qr")
            code = `const actual=__require(${add(native.resolve("@zxing/library"))});module.exports={...actual,MultiFormatWriter:class extends actual.MultiFormatWriter{encode(...args){if(window.printFixture.qrFailure)throw new Error('DEMO QR failure');return super.encode(...args)}}};`;
        else {
            let raw = file === "virtual:providers.tsx" ? provider : file === "virtual:entry.tsx" ? entry : file === "virtual:signature.tsx" ? `import React from 'react';const styles={image:'signature-image'};const useLanguage=()=>({t:text=>text});\n${readFileSync(resolve(root, "components/repairs/intake-signature.tsx"), "utf8").split("export function SignatureImage")[1].split("function SignaturePad")[0].replace(/^/, "export function SignatureImage")}` : readFileSync(file, "utf8");
            // about:blank has origin "null". Supply only the QR payload base, while
            // preserving the real writer/QR matrix; this URL is never requested.
            if (file === resolve(root, "components/repairs/intake-receipt.tsx"))
                raw = raw.replace("window.location.origin", '"https://print-fixture.invalid"');
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
    qrFailure?: boolean;
    fontPending?: boolean;
};
async function mount(page: Page, data: PrintFixture = fixture(false), moduleFirst = false) {
    const requests: string[] = [], errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>');
    await page.addStyleTag({ content: moduleFirst ? moduleCss + globalCss : globalCss + moduleCss });
    await page.evaluate(value => { Object.assign(window, { printFixture: value }); }, data);
    await page.addScriptTag({ content: `(()=>{const active=new Set();const Native=window.ResizeObserver;window.ResizeObserver=class extends Native{observe(...args){active.add(this);return super.observe(...args)}disconnect(){active.delete(this);return super.disconnect()}};window.printFixtureObserverCount=()=>active.size;const descriptor=Object.getOwnPropertyDescriptor(FontFaceSet.prototype,'status');Object.defineProperty(FontFaceSet.prototype,'status',{configurable:true,get(){return window.printFixture.fontPending?'loading':descriptor.get.call(this)}})})()` });
    await page.addScriptTag({ content: bundle });
    await expect(page.locator("dialog[open]")).toBeVisible();
    if (!data.qrFailure && data.active !== false)
        await expect(page.locator(`.${classes.viewer} .${classes.qr} path`)).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    return { requests, errors };
}
test.beforeAll(async () => { mkdirSync(evidence, { recursive: true }); await buildFixture(); });
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
function visibleCopies(page: Page) { return page.locator(`.${classes.viewer} .${classes.copy}`); }
async function selectPrint(page: Page, paper: string, language: PrintLanguage) { const current = await page.locator('select').nth(1).inputValue() as PrintLanguage; await page.getByRole("combobox", { name: printLabel("paper", current), exact: true }).selectOption(paper); await page.getByRole("combobox", { name: printLabel("printLanguage", current), exact: true }).selectOption(language); }
async function fitMetrics(page: Page) { return page.evaluate(names => { const dialog = document.querySelector("dialog")!; const master = document.querySelector(`.${names.measure} [data-master-content]`)!; const rect = master.getBoundingClientRect(); return { phase: dialog.getAttribute("data-fit-phase"), allowed: dialog.getAttribute("data-print-allowed"), naturalMm: Number(dialog.getAttribute("data-natural-height-mm")), smallMm: Number(dialog.getAttribute("data-small-height-mm")), contentMm: rect.height * 25.4 / 96, masterWidthMm: master.parentElement!.getBoundingClientRect().width * 25.4 / 96, fontStatus: document.fonts.status, hash: dialog.getAttribute("data-projection-hash"), qr: [...document.querySelectorAll(`.${names.viewer} .${names.qr}`)].map(e => ({ widthMm: e.getBoundingClientRect().width * 25.4 / 96, heightMm: e.getBoundingClientRect().height * 25.4 / 96 })), bodies: [...document.querySelectorAll(`.${names.viewer} .${names.copy}`)].map(e => { const copy = e.cloneNode(true) as HTMLElement; copy.querySelector('[data-copy-label]')?.remove(); return copy.textContent; }), boxes: [...document.querySelectorAll(`.${names.viewer} .${names.copy}`)].map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) }; }, classes); }
async function expectedProjection(page: Page, input: ReturnType<typeof fixture>, language: PrintLanguage, qr: {
    path: string;
    size: number;
}) {
    const data = input.data, policy = data.policy!, requirements = currentRepairRequirements(input.directory[0], input.workflows[data.id]), signature = matchingIntakeSignature(input.signatures, data, policy);
    const projection = repairPrintProjection({ data, requirements, policy, signature, hasHistory: input.signatures.length > 0, language, totalCents: itemQuoteTotal(data.itemQuotes, requirements.map(row => row.title)), technician: printLabel("unassigned", language), status: "diagnosis", custody: data.custody ?? "unknown", formal: true, qr });
    // Intl formatting punctuation is engine-specific. Obtain only the two display
    // dates in the tested engine; retain all raw facts and strict canonical hashing.
    const dates = await page.evaluate(({ preview, signed, language }) => { const render = (window as unknown as {
        fixturePrintDate: (value: string, language: PrintLanguage) => string;
    }).fixturePrintDate; return { preview: render(preview, language), signed: signed ? render(signed, language) : null }; }, { preview: data.previewAt, signed: signature?.signedAt, language });
    projection.identity.find(row => row.key === 'date')!.value = dates.preview;
    if (projection.signature && signature && dates.signed)
        projection.signature.label = projection.signature.label.replace(printDate(signature.signedAt, language), dates.signed);
    const body = Object.fromEntries(Object.entries(projection).filter(([key]) => key !== 'serialized' && key !== 'canonicalProjectionHash'));
    projection.serialized = canonicalPrintJson(body);
    projection.canonicalProjectionHash = receiptProjectionHash(projection.serialized);
    return projection;
}
async function contentProof(page: Page, input: ReturnType<typeof fixture>, language: PrintLanguage) {
    const svg = visibleCopies(page).first().locator(`.${classes.qr}`), qr = { path: (await svg.locator('path').getAttribute('d'))!, size: Number((await svg.getAttribute('viewBox'))!.split(' ')[2]) };
    const projection = await expectedProjection(page, input, language, qr);
    await expect(page.locator('dialog')).toHaveAttribute('data-projection-hash', projection.canonicalProjectionHash);
    for (const copy of await visibleCopies(page).all()) {
        await expect(copy).toContainText(input.data.model);
        await expect(copy).toContainText(input.data.issueNote!);
        for (const text of projection.intakeServices)
            await expect(copy).toContainText(text);
        for (const text of projection.issue.faults)
            await expect(copy).toContainText(text);
        for (const row of projection.rows)
            for (const text of row.texts)
                expect(await copy.textContent()).toContain(text);
        for (const quote of projection.reviewQuotes) {
            const row = copy.locator(`tr[data-quote-item="${quote.item}"]`);
            await expect(row).toContainText(quote.label);
            await expect(row.locator('td').last()).toHaveText(quote.amount);
            await expect(row).toHaveAttribute('data-association-kind', quote.associationKind);
            const noteId = await row.getAttribute('aria-describedby');
            expect(await copy.locator(`[id="${noteId}"]`).textContent()).toBe(quote.note);
        }
        await expect(copy.locator(`.${classes.terms} ol li`)).toHaveText([...repairIntakeTerms[language]]);
        for (const text of [projection.rights, projection.acknowledgement, projection.scope, projection.termsVersion])
            await expect(copy).toContainText(text);
        await expect(copy.locator('tr[data-requirement-id]')).toHaveCount(projection.rows.length);
        for (const row of projection.rows) {
            const tr = copy.locator(`tr[data-requirement-id="${row.id}"]`);
            await expect(tr).toHaveAttribute('data-requirement-revision', String(row.revision));
            await expect(tr).toHaveAttribute('data-requirement-request', row.rawRequest);
            await expect(tr.locator('td').last()).toHaveText(row.amount);
        }
        if (projection.signature) {
            await expect(copy.locator(`.${classes.signatureInk} svg`)).toHaveAttribute('viewBox', '0 0 800 250');
            await expect(copy.locator(`.${classes.signatureInk} polyline`)).toHaveAttribute('points', '80,150 240,50 400,200 640,75');
        } else {
            await expect(copy.locator(`.${classes.signatureInk} svg`)).toHaveCount(0);
            await expect(copy).toContainText(projection.signatureHistory);
        }
    }
    return projection;
}
async function installPrintCounter(page: Page) { await page.evaluate(() => { Object.assign(window, { printCalls: 0 }); window.print = () => { (window as unknown as {
    printCalls: number;
}).printCalls++; window.dispatchEvent(new Event('beforeprint')); }; }); }
async function updateFixture(page: Page, input: PrintFixture) { await page.evaluate(value => (window as unknown as {
    updatePrintFixture: (value: unknown) => void;
}).updatePrintFixture(value), input); }
async function pdfGeometry(page: Page) {
    return page.evaluate(names => {
        const box = (rect: DOMRect) => ({ x: rect.x * .75, y: rect.y * .75, width: rect.width * .75, height: rect.height * .75 });
        const elementBox = (element: Element) => box(element.getBoundingClientRect());
        const coreTextBoxes = (element: Element) => {
            const boxes: Array<ReturnType<typeof box>> = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (!node.textContent?.trim() || node.parentElement?.closest('.' + names.rowWarning)) continue;
                const range = document.createRange(); range.selectNodeContents(node);
                for (const rect of range.getClientRects()) boxes.push(box(rect));
            }
            return boxes;
        };
        return [...document.querySelectorAll(`.${names.viewer} .${names.copy}`)].map(copy => ({
            copy: copy.getAttribute('data-copy'), box: elementBox(copy), copyLabel: elementBox(copy.querySelector('[data-copy-label]')!), qr: elementBox(copy.querySelector(`.${names.qr}`)!),
            core: [...copy.querySelectorAll(`.${names.model} .${names.core},.${names.total},.${names.requests} tbody td,.${names.faults} p,.${names.separateIntake} .${names.core}`)].flatMap(coreTextBoxes),
            panels: [...copy.querySelectorAll('[data-fold]')].map(panel => ({ name: panel.getAttribute('data-fold'), box: elementBox(panel) })),
            bodyPt: parseFloat(getComputedStyle(copy).fontSize) * .75,
        }));
    }, classes);
}

async function nativeBlocked(page: Page, name: string, browserName: string, language: PrintLanguage) {
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.locator('dialog')).toHaveAttribute('data-print-allowed', 'false');
    await expect(page.locator('[data-print-blocked]')).toBeVisible();
    await expect(page.locator('[data-print-blocked]')).toContainText(printLabel('printBlocked', language));
    await expect(page.locator(`.${classes.viewer}`)).not.toBeVisible();
    let pages: number | undefined;
    if (browserName === 'chromium') {
        const bytes = await page.pdf({ path: resolve(evidence, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        pages = (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
        expect(pages).toBe(1);
    }
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    return pages;
}
const normalBodies = new Map<string, {
    hash: string;
    body: string;
}>();
for (const paper of ['a4', 'a5', 'half', 'double'] as const)
    for (const language of ['it', 'en', 'zh'] as PrintLanguage[]) {
        test(`单页母版 normal ${paper}/${language}`, async ({ page, browserName }, info) => {
            const input = fixture(false);
            expect(validLocalIntake(input.data)).toBe(true);
            expect(validIntakeSignature(input.signatures[0])).toBe(true);
            const observed = await mount(page, input);
            await selectPrint(page, paper, language);
            await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
            const projection = await contentProof(page, input, language);
            expect(projection.merged).toBe(true);
            expect(projection.rows).toHaveLength(3);
            expect(projection.intakeServices).toHaveLength(4);
            await expect(visibleCopies(page)).toHaveCount(paper === 'double' ? 2 : 1);
            const metrics = await fitMetrics(page);
            expect(metrics.naturalMm + receiptMaster.reserveMm).toBeLessThanOrEqual(receiptMaster.innerHeightMm);
            expect(metrics.smallMm + receiptMaster.reserveMm).toBeLessThanOrEqual(receiptMaster.innerHeightMm);
            expect(metrics.masterWidthMm).toBeCloseTo(receiptMaster.widthMm, 2);
            for (const body of metrics.bodies)
                expect(body).toBe(metrics.bodies[0]);
            const cache = normalBodies.get(info.project.name + language);
            if (cache) {
                expect(projection.canonicalProjectionHash).toBe(cache.hash);
                expect(metrics.bodies[0]).toBe(cache.body);
            }
            else
                normalBodies.set(info.project.name + language, { hash: projection.canonicalProjectionHash, body: metrics.bodies[0]! });
            await installPrintCounter(page);
            await page.getByRole('button', { name: printLabel('print', language), exact: true }).click();
            expect(await page.evaluate('window.printCalls')).toBe(1);
            await expect(page.getByRole('button', { name: printLabel('print', language), exact: true })).toBeDisabled();
            await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
            await expect(page.getByRole('button', { name: printLabel('print', language), exact: true })).toBeEnabled();
            await page.emulateMedia({ media: 'print' });
            await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
            await expect(page.locator('dialog')).toHaveAttribute('data-print-allowed', 'true');
            const name = `normal-${paper}-${language}-${info.project.name}`, geometry = await pdfGeometry(page);
            let pages: number | undefined;
            if (browserName === 'chromium') {
                const bytes = await page.pdf({ path: resolve(evidence, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
                pages = (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
                expect(pages).toBe(1);
            }
            const expectedGeometry = receiptPaperGeometry(paper);
            for (const [index, copy] of geometry.entries()) {
                const expected = expectedGeometry.slots[index];
                expect(copy.box.x / 72 * 25.4).toBeCloseTo(expected.xMm, 1);
                expect(copy.box.y / 72 * 25.4).toBeCloseTo(expected.yMm, 1);
                expect(copy.qr.width / 72 * 25.4).toBeGreaterThanOrEqual(20);
                expect(copy.qr.height / 72 * 25.4).toBeGreaterThanOrEqual(20);
                if (paper !== 'a4')
                    expect(expected.scale).toBe(receiptSmallScale);
            }
            writeFileSync(resolve(evidence, name + '.json'), JSON.stringify({ paper, language, projection, metrics, geometry, pages, observed, sourceInputs, cssInputs }, null, 2));
            await page.emulateMedia({ media: 'screen' });
            await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
            await page.evaluate(async () => { await document.fonts.ready; for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
            await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
            await expect(page.getByRole('button', { name: printLabel('print', language), exact: true })).toBeEnabled();
            await page.screenshot({ path: resolve(evidence, name + '.png'), fullPage: true, animations: 'disabled' });
            expect(observed.requests).toEqual([]);
            expect(observed.errors).toEqual([]);
        });
    }
for (const scenario of coverageScenarios)
    for (const language of ['it', 'en', 'zh'] as PrintLanguage[]) {
        test(`完整原文 ${scenario}/${language}`, async ({ page, browserName }, info) => {
            const input = coverageFixture(scenario);
            expect(validLocalIntake(input.data)).toBe(true);
            validateRepairRequirements(currentRepairRequirements(input.directory[0], input.workflows[input.data.id]));
            for (const row of input.procurementRecords)
                expect(validateProcurementDraft(row)).toEqual(row);
            const observed = await mount(page, input);
            await selectPrint(page, 'a5', language);
            await expect.poll(async () => (await fitMetrics(page)).phase).toMatch(/^(fit|overflow)$/);
            const projection = await contentProof(page, input, language), metrics = await fitMetrics(page);
            const name = `coverage-${scenario}-${language}-${info.project.name}`;
            if (scenario.startsWith('legacy-') || scenario === 'apple-no-request' || scenario === 'apple-history') expect(metrics.phase).toBe('fit');
            if (scenario === 'apple-history') expect(projection.signature).toBeNull();
            else expect(projection.signature).not.toBeNull();
            if (scenario === 'free-long-text')
                expect(metrics.phase).toBe('overflow');
            if (scenario === 'legacy-no-requirements') {
                expect(projection.merged).toBe(false);
                expect(projection.rows).toHaveLength(0);
            }
            if (scenario === 'legacy-no-fingerprint' || scenario === 'apple-no-request')
                expect(projection.merged).toBe(false);
            if (scenario.startsWith('free-')) {
                const raw = input.workflows[input.data.id].requirements![0].request;
                expect(raw.length).toBeGreaterThan(0);
                expect(await visibleCopies(page).first().textContent()).toContain(raw);
                if (scenario === 'free-long-text')
                    expect(raw).toHaveLength(1077);
            }
            if (scenario === 'partial-quotes') {
                expect(projection.rows).toHaveLength(3);
                expect(projection.rows[0].amount).toBe(printMoney(0, language));
                expect(projection.rows.slice(1).every(row => row.amount === printLabel('define', language))).toBe(true);
            }
            if (scenario === 'same-title') {
                expect(projection.rows.filter(row => row.ambiguous)).toHaveLength(2);
                expect(projection.reviewQuotes.filter(row => row.item === '屏幕')).toHaveLength(1);
                expect(await visibleCopies(page).first().textContent()).not.toContain('76543');
            }
            if (scenario === 'unmatched-quote')
                expect(projection.reviewQuotes).toHaveLength(1);
            if (scenario === 'zero-unknown') {
                expect(projection.rows[0].amount).toBe(printMoney(0, language));
                expect(projection.rows[1].amount).toBe(printLabel('define', language));
                expect(projection.total).toBe(printLabel('unquoted', language));
            }
            if (scenario === 'multiple-purchases') {
                expect(projection.rows).toHaveLength(3);
                expect(await visibleCopies(page).first().textContent()).not.toMatch(/DEMO PRIVATE|76543/);
            }
            if (scenario === 'mixed-quote-groups') {
                const copy = visibleCopies(page).first();
                expect(projection.reviewQuotes.map(row => row.item)).toEqual(['DEMO unmatched before 1', 'DEMO unmatched before 2', '屏幕', 'DEMO unmatched after']);
                expect(await copy.locator('[data-quote-group]').evaluateAll(groups => groups.map(group => group.getAttribute('data-quote-group')))).toEqual(['unmatched', 'ambiguous', 'unmatched']);
                expect(await copy.locator('[data-quote-group]').evaluateAll(groups => groups.map(group => [...group.querySelectorAll('[data-quote-item]')].map(row => row.getAttribute('data-quote-item'))))).toEqual([['DEMO unmatched before 1', 'DEMO unmatched before 2'], ['屏幕'], ['DEMO unmatched after']]);
                expect(await copy.locator('[data-quote-group]').evaluateAll(groups => groups.map(group => group.querySelectorAll('p[id]').length))).toEqual([1, 1, 1]);
                expect(projection.rows.filter(row => row.ambiguous)).toHaveLength(2);
                expect((await copy.textContent())!.split(printMoney(9876, language)).length - 1).toBe(1);
            }
            await installPrintCounter(page);
            let pages: number | undefined, geometry: Awaited<ReturnType<typeof pdfGeometry>> | undefined;
            if (metrics.phase === 'overflow') {
                await expect(page.getByRole('button', { name: printLabel('print', language), exact: true })).toBeDisabled();
                expect(await page.evaluate('window.printCalls')).toBe(0);
                pages = await nativeBlocked(page, name, browserName, language);
            }
            else {
                expect(metrics.naturalMm + 1).toBeLessThanOrEqual(194);
                expect(metrics.smallMm + 1).toBeLessThanOrEqual(194);
                await page.emulateMedia({ media: 'print' });
                await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
                geometry = await pdfGeometry(page);
                if (browserName === 'chromium') {
                    const bytes = await page.pdf({ path: resolve(evidence, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
                    pages = (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
                    expect(pages).toBe(1);
                }
                await page.emulateMedia({ media: 'screen' });
                await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
            }
            writeFileSync(resolve(evidence, name + '.json'), JSON.stringify({ scenario, paper: 'a5', language, projection, metrics, geometry, pages, observed, sourceInputs, cssInputs }, null, 2));
            if (process.env.REPAIR_PRINT_LEGACY_DESIGN_DIR && scenario.startsWith('legacy-') && language === 'it') {
                const destination = resolve(process.env.REPAIR_PRINT_LEGACY_DESIGN_DIR);
                mkdirSync(destination, { recursive: true });
                const master = await visibleCopies(page).first().evaluate(element => element.outerHTML);
                writeFileSync(resolve(destination, scenario + '.html'), `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEMO ${scenario}</title><style>${globalCss}\n${moduleCss}</style></head><body><div class="${classes.root}">${master}</div></body></html>`);
                writeFileSync(resolve(destination, scenario + '.full-dom.html'), await page.content());
                writeFileSync(resolve(destination, scenario + '.json'), JSON.stringify({ scenario, fixture: input, projection, metrics, classes, sourceInputs, cssInputs, notes: 'Actual React master outerHTML at unscaled 297 mm; all font bytes, QR paths and original signature strokes inline. Separate intake/current blocks retained. Full DOM also retained, with offscreen measurement clones.' }, null, 2));
            }
            if (language === 'it')
                await page.screenshot({ path: resolve(evidence, name + '.png'), fullPage: true, animations: 'disabled' });
            expect(observed.requests).toEqual([]);
            expect(observed.errors).toEqual([]);
        });
    }
for (const paper of ['a4', 'a5', 'half', 'double'])
    for (const language of ['it', 'en', 'zh'] as PrintLanguage[]) {
        test(`长原文全纸阻印 ${paper}/${language}`, async ({ page, browserName }, info) => {
            const input = fixture(true, true), observed = await mount(page, input);
            await selectPrint(page, paper, language);
            await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'overflow');
            const projection = await contentProof(page, input, language);
            expect(projection.rows).toHaveLength(27);
            expect(projection.rows.at(-1)!.amount).toBe(printLabel('define', language));
            expect(projection.total).toBe(printLabel('unquoted', language));
            const metrics = await fitMetrics(page);
            expect(Math.max(metrics.naturalMm, metrics.smallMm) + 1).toBeGreaterThan(194);
            await expect(visibleCopies(page)).toHaveCount(1);
            expect(await visibleCopies(page).first().textContent()).toContain(input.data.issueNote!);
            await installPrintCounter(page);
            await expect(page.getByRole('button', { name: printLabel('print', language), exact: true })).toBeDisabled();
            expect(await page.evaluate('window.printCalls')).toBe(0);
            const name = `overflow-${paper}-${language}-${info.project.name}`, pages = await nativeBlocked(page, name, browserName, language);
            await expect(visibleCopies(page)).toHaveCount(1);
            writeFileSync(resolve(evidence, name + '.json'), JSON.stringify({ paper, language, projection, metrics, pages, blocked: true, observed, sourceInputs, cssInputs }, null, 2));
            if (paper === 'a5' && language === 'it')
                await page.screenshot({ path: resolve(evidence, name + '.png'), fullPage: true, animations: 'disabled' });
            expect(observed.requests).toEqual([]);
            expect(observed.errors).toEqual([]);
        });
    }
test('状态 workflow pending/error 恢复需新测量', async ({ page, browserName }, info) => {
    const input = fixture(false), observed = await mount(page, input);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    const before = await page.locator('dialog').getAttribute('data-fit-generation');
    const body = await visibleCopies(page).first().textContent();
    await installPrintCounter(page);
    for (const failure of [{ workflowReady: false, workflowError: '' }, { workflowReady: true, workflowError: 'DEMO workflow parse error' }]) {
        await updateFixture(page, { ...input, ...failure });
        await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'unavailable');
        await expect(page.getByRole('button', { name: printLabel('print', 'it'), exact: true })).toBeDisabled();
        expect(await visibleCopies(page).first().textContent()).toBe(body);
        expect(await page.evaluate('window.printCalls')).toBe(0);
        await nativeBlocked(page, `workflow-${failure.workflowReady ? 'error' : 'pending'}-${info.project.name}`, browserName, 'it');
        await updateFixture(page, input);
        await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
        expect(Number(await page.locator('dialog').getAttribute('data-fit-generation'))).toBeGreaterThan(Number(before));
    }
    await page.getByRole('button', { name: printLabel('print', 'it'), exact: true }).click();
    expect(await page.evaluate('window.printCalls')).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
});
test('状态 initial unavailable 与同scope读取恢复重绑预览', async ({ page }) => {
    const input = fixture(false), observed = await mount(page, { ...input, active: false });
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'unavailable');
    await expect(visibleCopies(page)).toHaveCount(0);
    await updateFixture(page, input);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await expect.poll(() => page.evaluate('window.printFixtureObserverCount()')).toBe(2);
    const body = await visibleCopies(page).first().textContent();
    await updateFixture(page, { ...input, unavailable: true });
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'unavailable');
    expect(await visibleCopies(page).first().textContent()).toBe(body);
    await updateFixture(page, input);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    const metrics = await fitMetrics(page);
    expect(metrics.boxes[0].width).toBeLessThanOrEqual(await page.locator(`.${classes.viewer}`).evaluate(e => e.clientWidth));
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
});
test('状态 跨scope立即隔离且迟到旧资料不回填', async ({ page, browserName }, info) => {
    const input = fixture(false), observed = await mount(page, input);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await updateFixture(page, { ...input, scope: 'DEMO-STORE-B' });
    await expect(visibleCopies(page)).toHaveCount(0);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'unavailable');
    await expect(page.locator('dialog')).not.toContainText(input.data.customerName);
    await updateFixture(page, { ...input, scope: 'DEMO-STORE-C' });
    await expect(visibleCopies(page)).toHaveCount(0);
    await expect(page.locator('dialog')).not.toContainText(input.data.model);
    await nativeBlocked(page, `scope-blocked-${info.project.name}`, browserName, 'it');
    await expect(visibleCopies(page)).toHaveCount(0);
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
});
test('状态 print抛错就地反馈 保预览可重试取消无假成功', async ({ page }) => {
    const input = fixture(false), observed = await mount(page, input);
    await selectPrint(page, 'half', 'en');
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    const body = await visibleCopies(page).first().textContent(), hash = await page.locator('dialog').getAttribute('data-projection-hash');
    await page.evaluate(() => { window.print = () => { throw new Error('DEMO print window refused'); }; });
    await page.getByRole('button', { name: printLabel('print', 'en'), exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(printLabel('printWindowError', 'en'));
    await expect(page.getByRole('button', { name: printLabel('print', 'en'), exact: true })).toBeEnabled();
    expect(await visibleCopies(page).first().textContent()).toBe(body);
    await expect(page.locator('dialog')).toHaveAttribute('data-projection-hash', hash!);
    await expect(page.locator('select').nth(0)).toHaveValue('half');
    await expect(page.locator('select').nth(1)).toHaveValue('en');
    await installPrintCounter(page);
    await page.getByRole('button', { name: printLabel('print', 'en'), exact: true }).click();
    expect(await page.evaluate('window.printCalls')).toBe(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.getByRole('button', { name: printLabel('print', 'en'), exact: true })).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(await visibleCopies(page).first().textContent()).toBe(body);
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
});
test('状态 QR失败保内容 重试真实QR后恢复', async ({ page }) => {
    const input = fixture(false), observed = await mount(page, { ...input, qrFailure: true });
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'error');
    await expect(visibleCopies(page).first()).toContainText(input.data.issueNote!);
    await expect(page.getByRole('button', { name: printLabel('print', 'it'), exact: true })).toBeDisabled();
    await updateFixture(page, input);
    await page.getByRole('button', { name: printLabel('qrRetry', 'it'), exact: true }).click();
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await expect(visibleCopies(page).first().locator(`.${classes.qr} path`)).toHaveCount(1);
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
});
test('状态 fonts pending/error/恢复与native同步门控', async ({ page, browserName }, info) => {
    const input = fixture(false), observed = await mount(page, { ...input, fontPending: true });
    await selectPrint(page, 'a5', 'zh');
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'measuring');
    await expect(page.getByRole('button', { name: printLabel('print', 'zh'), exact: true })).toBeDisabled();
    await nativeBlocked(page, `font-pending-${info.project.name}`, browserName, 'zh');
    await updateFixture(page, input);
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await page.evaluate(async () => { const bad = new FontFace('Source Sans 3', 'url(data:font/woff2;base64,AAAA)'); document.fonts.add(bad); Object.assign(window, { badPrintFont: bad }); await bad.load().catch(() => { }); document.fonts.dispatchEvent(new Event('loadingerror')); });
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'error');
    await expect(page.getByRole('alert')).toContainText(printLabel('printFontError', 'zh'));
    await expect(visibleCopies(page).first()).toContainText(input.data.customerName);
    await nativeBlocked(page, `font-error-${info.project.name}`, browserName, 'zh');
    await page.getByRole('button', { name: printLabel('printCheckRetry', 'zh'), exact: true }).click();
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'error');
    await expect(page.getByRole('button', { name: printLabel('print', 'zh'), exact: true })).toBeDisabled();
    const failedRecheck = { metrics: await fitMetrics(page), faceStatus: await page.evaluate(() => (window as unknown as { badPrintFont: FontFace }).badPrintFont.status) };
    await page.evaluate(() => { document.fonts.delete((window as unknown as {
        badPrintFont: FontFace;
    }).badPrintFont); document.fonts.dispatchEvent(new Event('loadingdone')); });
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await expect(page.locator('dialog')).toHaveAttribute('data-print-allowed', 'true');
    await expect(page.getByRole('button', { name: printLabel('print', 'zh'), exact: true })).toBeEnabled();
    const externallyRecovered = await fitMetrics(page);
    const allowed = await page.evaluate(() => { document.fonts.dispatchEvent(new Event('loading')); window.dispatchEvent(new Event('beforeprint')); return document.querySelector('dialog')!.getAttribute('data-print-allowed'); });
    expect(allowed).toBe('false');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
    writeFileSync(resolve(evidence, `font-state-${info.project.name}.json`), JSON.stringify({ actualNode: process.version, failedRecheck, externallyRecovered, sameTickNativeAllowed: allowed, observed, sourceInputs, cssInputs }, null, 2));
});
test('状态 快速纸型语言切换 点击复测 双击锁 关闭清理焦点', async ({ page }) => {
    const input = fixture(false), observed = await mount(page, input);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await selectPrint(page, 'double', 'zh');
    await selectPrint(page, 'a4', 'en');
    await selectPrint(page, 'a5', 'it');
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await installPrintCounter(page);
    await page.getByRole('button', { name: printLabel('print', 'it'), exact: true }).evaluate(e => { (e as HTMLButtonElement).click(); (e as HTMLButtonElement).click(); });
    expect(await page.evaluate('window.printCalls')).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    const originalHeight = await visibleCopies(page).first().locator('[data-master-content]').evaluate(e => e.getBoundingClientRect().height);
    await page.locator(`.${classes.measure} [data-master-content]`).first().evaluate(e => { (e as HTMLElement).style.paddingBottom = '100mm'; });
    await page.getByRole('button', { name: printLabel('print', 'it'), exact: true }).evaluate(e => (e as HTMLButtonElement).click());
    expect(await page.evaluate('window.printCalls')).toBe(1);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'overflow');
    expect(await visibleCopies(page).first().locator('[data-master-content]').evaluate(e => e.getBoundingClientRect().height)).toBe(originalHeight);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect.poll(() => page.evaluate('window.printFixtureObserverCount()')).toBe(0);
    await page.locator('#trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await page.keyboard.press('Escape');
    await expect(page.locator('#trigger')).toBeFocused();
    await expect.poll(() => page.evaluate('window.printFixtureObserverCount()')).toBe(0);
    expect(observed.errors).toEqual([]);
    expect(observed.requests).toEqual([]);
});
for (const width of [1440, 1024, 390, 375])
    test(`四宽触控与预览 ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const observed = await mount(page, fixture(false), width === 390);
        await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
        for (const target of await page.locator('.intake-receipt-toolbar > button,.intake-receipt-options > button,.intake-receipt-options select').all()) {
            const box = await target.boundingBox();
            expect(box!.width).toBeGreaterThanOrEqual(44);
            expect(box!.height).toBeGreaterThanOrEqual(44);
            if (width < 768 && await target.evaluate(e => e.tagName === 'SELECT'))
                expect(await target.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
        }
        const geometry = await fitMetrics(page), viewerWidth = await page.locator(`.${classes.viewer}`).evaluate(e => e.clientWidth);
        expect(geometry.boxes[0].width).toBeLessThanOrEqual(viewerWidth);
        expect(await page.locator('dialog').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
        await page.getByRole('combobox', { name: printLabel('previewZoom', 'it'), exact: true }).selectOption('1');
        await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
        expect((await fitMetrics(page)).masterWidthMm).toBeCloseTo(297, 2);
        expect(observed.errors).toEqual([]);
        expect(observed.requests).toEqual([]);
    });

test('历史签名真实资料失配 无旧笔迹保留历史提示和原文', async ({ page }, info) => {
    const input = fixture(false, true);
    expect(validLocalIntake(input.data)).toBe(true);
    expect(validIntakeSignature(input.signatures[0])).toBe(true);
    expect(matchingIntakeSignature(input.signatures, input.data, input.data.policy!)).toBe(input.signatures[0]);
    const originalSignature = JSON.stringify(input.signatures[0]);
    const originalSerial = input.data.serial;
    input.data.serial = originalSerial + '-CORRECTED';
    input.directory = [intakeDirectoryEntry(input.data)];
    input.workflows = { [input.data.id]: initialRepairWorkflow(input.directory[0]) };
    expect(validLocalIntake(input.data)).toBe(true);
    expect(matchingIntakeSignature(input.signatures, input.data, input.data.policy!)).toBeUndefined();
    expect(input.signatures.some(row => row.orderId === input.data.id)).toBe(true);
    expect(JSON.stringify(input.signatures[0])).toBe(originalSignature);

    const observed = await mount(page, input);
    // Open from a connected, focused trigger so focus restoration is observable.
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    await page.locator('#trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]')).toBeVisible();
    const checks: Array<Record<string, unknown>> = [];
    for (const language of ['it', 'en', 'zh'] as PrintLanguage[]) {
        await selectPrint(page, 'a5', language);
        await expect.poll(async () => (await fitMetrics(page)).phase).toMatch(/^(fit|overflow)$/);
        const copy = visibleCopies(page).first();
        await expect(copy.locator(`.${classes.signatureInk} svg`)).toHaveCount(0);
        await expect(copy.locator(`.${classes.signatureInk} polyline`)).toHaveCount(0);
        await expect(copy.locator(`.${classes.signature}`)).toContainText(printLabel('historicalSignature', language));
        await expect(copy.locator(`svg.${classes.qr} path`)).toHaveCount(1);
        await expect(copy.locator('[data-fact="serial"] span')).toHaveText(input.data.serial);
        expect(await copy.textContent()).toContain(input.data.issueNote!);
        expect(await copy.textContent()).toContain(input.data.model);
        const qr = copy.locator(`.${classes.qr}`);
        const projection = await expectedProjection(page, input, language, {
            path: (await qr.locator('path').getAttribute('d'))!,
            size: Number((await qr.getAttribute('viewBox'))!.split(' ')[2]),
        });
        expect(projection.signature).toBeNull();
        expect(projection.signatureHistory).toBe(printLabel('historicalSignature', language));
        expect(projection.facts.hasHistory).toBe(true);
        expect(projection.total).toBe(printLabel('unquoted', language));
        await expect(page.locator('dialog')).toHaveAttribute('data-projection-hash', projection.canonicalProjectionHash);
        await expect(copy.locator('[data-fact="total"]')).toContainText(projection.total);
        await expect(copy.locator('tr[data-requirement-id="intake:屏幕"] td').last()).toHaveText(printMoney(0, language));
        await expect(copy.locator('tr[data-requirement-id="intake:电池"] td').last()).toHaveText(printLabel('define', language));
        for (const text of [...projection.intakeServices, ...projection.issue.faults, projection.issue.note, projection.rights, projection.scope, projection.acknowledgement, projection.termsVersion]) {
            expect(await copy.textContent()).toContain(text);
        }
        await expect(copy.locator(`.${classes.terms} ol li`)).toHaveText([...repairIntakeTerms[language]]);
        checks.push({ language, metrics: await fitMetrics(page), canonicalProjectionHash: projection.canonicalProjectionHash,
            signature: projection.signature, hasHistory: projection.facts.hasHistory, signatureHistory: projection.signatureHistory,
            signatureSvgCount: await copy.locator(`.${classes.signatureInk} svg`).count(), qrPathCount: await copy.locator(`svg.${classes.qr} path`).count(),
            rawNote: input.data.issueNote, serial: input.data.serial, total: projection.total, amounts: projection.rows.map(row => ({ id: row.id, amount: row.amount })) });
    }
    await page.screenshot({ path: resolve(evidence, `signature-mismatch-${info.project.name}.png`), fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('#trigger')).toBeFocused();
    await expect.poll(() => page.evaluate('window.printFixtureObserverCount()')).toBe(0);
    expect(JSON.stringify(input.signatures[0])).toBe(originalSignature);
    expect(observed.requests).toEqual([]);
    expect(observed.errors).toEqual([]);
    writeFileSync(resolve(evidence, `signature-mismatch-${info.project.name}.json`), JSON.stringify({
        actualNode: process.version, originalSerial, correctedSerial: input.data.serial,
        originalSignatureSha256: createHash('sha256').update(originalSignature).digest('hex'),
        originalSignatureUnchanged: JSON.stringify(input.signatures[0]) === originalSignature,
        realMatchingIntakeSignatureAfterChange: 'undefined', hasHistory: true, checks, restoredFocus: '#trigger', observersAfterClose: 0,
        observed, sourceInputs, cssInputs,
    }, null, 2));
});

test('折线 长不换行型号门店名完整换行且不串栏', async ({ page, browserName }, info) => {
    const input = fixture(false);
    input.data.model = 'DEMO-' + 'M'.repeat(72);
    input.data.policy!.shopName = 'DEMO-' + 'SHOP'.repeat(14);
    input.settings.shopName = input.data.policy!.shopName;
    input.directory = [intakeDirectoryEntry(input.data)];
    input.workflows = { [input.data.id]: initialRepairWorkflow(input.directory[0]) };
    input.signatures[0].snapshot = intakeSignatureSnapshot(input.data, input.data.policy!);
    expect(validLocalIntake(input.data)).toBe(true);
    const observed = await mount(page, input);
    await selectPrint(page, 'a5', 'it');
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    const projection = await contentProof(page, input, 'it'), metrics = await fitMetrics(page);
    expect(await visibleCopies(page).first().textContent()).toContain(input.data.policy!.shopName);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    const geometry = await pdfGeometry(page), name = `long-token-a5-it-${info.project.name}`;
    let pages: number | undefined;
    if (browserName === 'chromium') {
        const bytes = await page.pdf({ path: resolve(evidence, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        pages = (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
        expect(pages).toBe(1);
    }
    writeFileSync(resolve(evidence, name + '.json'), JSON.stringify({ paper: 'a5', language: 'it', projection, metrics, geometry, pages, observed, sourceInputs, cssInputs }, null, 2));
    expect(observed.requests).toEqual([]);
    expect(observed.errors).toEqual([]);
});

test('折线 栏内溢出同步禁印即使仍在整体281mm内', async ({ page, browserName }, info) => {
    const input = fixture(false), observed = await mount(page, input);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'fit');
    await installPrintCounter(page);
    const before = await fitMetrics(page);
    const synchronous = await page.evaluate(names => {
        const content = document.querySelector<HTMLElement>(`.${names.measure} [data-master-content]`)!;
        const panel = content.querySelector<HTMLElement>('[data-fold="order"]')!;
        panel.style.position = 'relative';
        const text = document.createElement('span');
        text.textContent = 'DEMO PANEL BOUNDARY';
        Object.assign(text.style, { position: 'absolute', left: '130mm', top: '0', width: '40mm' });
        panel.append(text);
        const span = text.getBoundingClientRect(), outer = content.getBoundingClientRect(), inner = panel.getBoundingClientRect();
        const button = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Stampa')!;
        button.click();
        return { textRight: span.right, panelRight: inner.right, masterRight: outer.right, allowed: document.querySelector('dialog')!.getAttribute('data-print-allowed'), calls: (window as unknown as { printCalls: number }).printCalls };
    }, classes);
    expect(synchronous.textRight).toBeGreaterThan(synchronous.panelRight);
    expect(synchronous.textRight).toBeLessThan(synchronous.masterRight);
    expect(synchronous.allowed).toBe('false');
    expect(synchronous.calls).toBe(0);
    await expect(page.locator('dialog')).toHaveAttribute('data-fit-phase', 'overflow');
    const after = await fitMetrics(page);
    expect(after.masterWidthMm).toBe(before.masterWidthMm);
    expect(after.naturalMm + 1).toBeLessThanOrEqual(194);
    const name = `panel-overflow-${info.project.name}`, pages = await nativeBlocked(page, name, browserName, 'it');
    writeFileSync(resolve(evidence, name + '.json'), JSON.stringify({ blocked: true, paper: 'a5', language: 'it', before, after, synchronous, pages, observed, sourceInputs, cssInputs }, null, 2));
    expect(observed.requests).toEqual([]);
    expect(observed.errors).toEqual([]);
});

test('打印语言刷新zoom实际显示标签并保fit或100值', async ({ page }, info) => {
    const observed = await mount(page), checks: Array<Record<string, unknown>> = [];
    for (const value of ['fit', '1']) {
        for (const language of ['it', 'en', 'zh'] as PrintLanguage[]) {
            const current = await page.locator('select').nth(1).inputValue() as PrintLanguage;
            await page.getByRole('combobox', { name: printLabel('previewZoom', current), exact: true }).selectOption(value);
            await selectPrint(page, 'a5', language);
            const select = page.getByRole('combobox', { name: printLabel('previewZoom', language), exact: true });
            await expect(select).toHaveValue(value);
            await expect(select.locator('option')).toHaveText([printLabel('fitScreen', language), '100%']);
            const selected = value === 'fit' ? printLabel('fitScreen', language) : '100%';
            if (await select.evaluate(() => CSS.supports('appearance', 'base-select'))) {
                await expect(select.locator('selectedcontent')).toHaveText(selected);
            }
            expect(await select.evaluate(element => (element as HTMLSelectElement).selectedOptions[0].textContent)).toBe(selected);
            checks.push({ language, value, selected, enhancedValue: await select.locator('selectedcontent').count() ? await select.locator('selectedcontent').textContent() : null });
        }
    }
    writeFileSync(resolve(evidence, `zoom-language-${info.project.name}.json`), JSON.stringify({ checks, observed, sourceInputs, cssInputs }, null, 2));
    expect(observed.requests).toEqual([]);
    expect(observed.errors).toEqual([]);
});
