import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium as playwright, type Browser, type BrowserContext } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { PDFDocument, rgb } from "pdf-lib";
import { repairReceiptHtml, receiptDensities, type ReceiptDensity } from "../repair-receipt-template";
import { receiptMaster, receiptPaperGeometry, type ReceiptPaper, type RepairPrintProjection } from "../repair-print-layout";

export class ReceiptRenderError extends Error {
  constructor(public code: "overflow" | "font" | "layout", public blocks: string[] = [], public measurements?: ReceiptMeasurements) { super(code); }
}
function renderFailure(code: ReceiptRenderError["code"], blocks: string[] = [], measurements?: ReceiptMeasurements) { return new ReceiptRenderError(code, blocks, measurements); }
export type ReceiptMeasurements = { density: ReceiptDensity; lineHeight: number; coreLineHeight: number; attempts: { density: ReceiptDensity; bottomMm: number; overflow: string[] }[]; blocks: { name: string; label: string; bottomMm: number; heightMm: number; widthMm: number; overflow: boolean }[]; heightMm: number; bodyPt: number; corePt: number; qrMm: number };
let fonts: Promise<{ latin: string; chinese: string; chineseBold: string }> | undefined;
export function receiptFonts() {
  fonts ??= Promise.all([readFile(path.join(process.cwd(), "public/fonts/source-sans-3/source-sans-3-roman.woff2")), readFile(path.join(process.cwd(), "server-assets/receipt/NotoSansSC-400.ttf")), readFile(path.join(process.cwd(), "server-assets/receipt/NotoSansSC-700.ttf"))]).then(([latin, chinese, chineseBold]) => ({ latin: latin.toString("base64"), chinese: chinese.toString("base64"), chineseBold: chineseBold.toString("base64") }));
  return fonts;
}
export async function launchReceiptBrowser() {
  // Production always uses the packaged binary; a developer's browser cache is
  // never treated as a deployable runtime. macOS is only an isolated local check.
  return playwright.launch(process.platform === "linux" ? { args: chromium.args, executablePath: await chromium.executablePath(), headless: true } : { headless: true });
}
export async function renderRepairReceipt(projection: RepairPrintProjection, paper: ReceiptPaper, suppliedBrowser?: Browser) {
  const browser = suppliedBrowser ?? await launchReceiptBrowser();
  let context: BrowserContext | undefined;
  const measurements: ReceiptMeasurements[] = [];
  try {
    context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    await context.route("**/*", route => route.abort());
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    const geometry = receiptPaperGeometry(paper), masters: Uint8Array[] = [];
    for (const slot of geometry.slots) {
      await page.setContent(repairReceiptHtml(projection, await receiptFonts(), slot.copy), { waitUntil: "load", timeout: 15000 });
      const fontReady = await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([document.fonts.load('14.4pt ReceiptLatin', document.body.textContent ?? ''), document.fonts.load('14.4pt ReceiptChinese', document.body.textContent ?? ''), document.fonts.load('700 14.4pt ReceiptChinese', document.body.textContent ?? '')]);
        return [...document.fonts].length === 3 && [...document.fonts].every(font => font.status === "loaded");
      });
      if (!fontReady) throw renderFailure("font");
      // Select once on the A4 master from natural content measurements. Paper
      // size never participates; A5 embeds this same layout without reflow.
      const attempts: ReceiptMeasurements["attempts"] = [];
      let metric: ReceiptMeasurements | undefined;
      for (const density of receiptDensities) {
        // Reuse the loaded document and fonts. Only spacing changes between
        // densities; the template fixes the QR and help positions from the facts.
        if (density !== receiptDensities[0]) {
          await page.evaluate(selected => {
            document.querySelector<HTMLElement>("main")!.dataset.density = selected;
          }, density);
        }
        const measured = await page.evaluate(() => {
        const mm = (px: number) => px * 25.4 / 96;
        const blocks = [...document.querySelectorAll<HTMLElement>("[data-block]")].map(element => {
          const b = element.getBoundingClientRect(); let left = b.left, right = b.right, bottom = b.bottom;
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node: Node | null;
          while ((node = walker.nextNode())) if (node.textContent?.trim()) { const range = document.createRange(); range.selectNodeContents(node); for (const r of range.getClientRects()) { left = Math.min(left, r.left); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom); } }
          return { name: element.dataset.block!, label: element.dataset.label!, bottomMm: mm(bottom), heightMm: mm(bottom - b.top), widthMm: mm(right - left), overflow: left < b.left - .1 || right > b.right + .1 || mm(bottom) > 201 };
        });
        const article = document.querySelector("article")!, core = document.querySelector(".core")!;
        return { density: document.querySelector<HTMLElement>("main")!.dataset.density as ReceiptDensity, lineHeight: parseFloat(getComputedStyle(article).lineHeight) / parseFloat(getComputedStyle(article).fontSize), coreLineHeight: parseFloat(getComputedStyle(core).lineHeight) / parseFloat(getComputedStyle(core).fontSize), blocks, heightMm: Math.max(...blocks.map(b => b.bottomMm)) - 8, bodyPt: parseFloat(getComputedStyle(document.body).fontSize) * .75, corePt: parseFloat(getComputedStyle(core).fontSize) * .75, qrMm: mm(document.querySelector(".qr")!.getBoundingClientRect().width) };
        });
        attempts.push({ density, bottomMm: measured.heightMm + 8, overflow: measured.blocks.filter(block => block.overflow).map(block => block.name) });
        metric = { ...measured, attempts: [...attempts] };
        if (metric.bodyPt < receiptMaster.bodyPt - .001 || metric.corePt < receiptMaster.corePt - .001 || metric.qrMm < receiptMaster.qrMm - .05) throw renderFailure("layout", [], metric);
        if (!metric.blocks.some(block => block.overflow)) break;
      }
      if (!metric) throw renderFailure("layout");
      measurements.push(metric);
      const overflow = metric.blocks.filter(block => block.overflow);
      if (overflow.length) throw renderFailure("overflow", [...new Set(overflow.map(block => block.label))], metric);
      const master = await page.pdf({ width: "297mm", height: "210mm", preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, margin: { top: 0, bottom: 0, left: 0, right: 0 }, tagged: true });
      const doc = await PDFDocument.load(master);
      const box = doc.getPages()[0]?.getMediaBox();
      if (doc.getPageCount() !== 1 || !box || Math.abs(box.width - 297 * 72 / 25.4) > 1 || Math.abs(box.height - 210 * 72 / 25.4) > 1) throw renderFailure("layout");
      masters.push(master);
    }
    const output = await PDFDocument.create();
    const point = (mm: number) => mm * 72 / 25.4;
    const result = output.addPage([point(geometry.widthMm), point(geometry.heightMm)]);
    for (let index = 0; index < masters.length; index++) {
      const [embedded] = await output.embedPdf(masters[index]); const slot = geometry.slots[index];
      result.drawPage(embedded, { x: point(slot.xMm), y: point(geometry.heightMm - slot.yMm - slot.heightMm), width: point(slot.widthMm), height: point(slot.heightMm) });
    }
    if (paper === "double") result.drawLine({ start: { x: 0, y: point(148.5) }, end: { x: point(210), y: point(148.5) }, thickness: .4, dashArray: [2, 2], color: rgb(.67, .67, .67) });
    output.setTitle(projection.orderId); output.setLanguage(projection.language); output.setProducer("ChinaTech repair receipt");
    const bytes = await output.save();
    if ((await PDFDocument.load(bytes)).getPageCount() !== 1) throw renderFailure("layout");
    return { bytes, measurements };
  } finally { try { await context?.close(); } finally { if (!suppliedBrowser) await browser.close(); } }
}
