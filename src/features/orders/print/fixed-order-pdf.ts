"use client";

import html2canvas from "html2canvas";
import { PDFDocument, rgb } from "pdf-lib";

import type { PrintPaperMode } from "@/features/orders/components/print-portal";

const MM_TO_PT = 72 / 25.4;
const A5_LANDSCAPE = [210 * MM_TO_PT, 148 * MM_TO_PT] as const;
const A4_PORTRAIT = [210 * MM_TO_PT, 297 * MM_TO_PT] as const;
const A4_LANDSCAPE = [297 * MM_TO_PT, 210 * MM_TO_PT] as const;
// Keep the established high-resolution print contract. Performance work must
// optimize conversion and reuse without trading away text or QR sharpness.
const PRINT_CAPTURE_SCALE = 3;
const TICKET = {
  x: 6 * MM_TO_PT,
  top: 6 * MM_TO_PT,
  width: 198 * MM_TO_PT,
  height: 136 * MM_TO_PT,
};

export async function createFixedOrderPdf(paperMode: PrintPaperMode) {
  const sourcePages = Array.from(
    document.querySelectorAll<HTMLElement>("body > .repair-print-sheet .repair-print-page-content"),
  );
  if (!sourcePages.length) throw new Error("打印工单尚未准备完成，请重试");

  const pdf = await PDFDocument.create();
  const sandbox = await createPrintSandbox();
  try {
    for (const source of sourcePages) {
      const target = sandbox.document.createElement("div");
      target.className = "repair-print-page-content";
      target.setAttribute("style", source.getAttribute("style") ?? "");
      target.innerHTML = source.innerHTML;
      sandbox.root.replaceChildren(target);
      await nextFrame(sandbox.window);

      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: PRINT_CAPTURE_SCALE,
        logging: false,
        useCORS: true,
      });
      const image = await pdf.embedPng(await canvasToPngBytes(canvas));
      canvas.width = 0;
      canvas.height = 0;
      const pageSize = getPageSize(paperMode);
      const page = pdf.addPage([...pageSize]);
      const placements = getTicketPlacements(paperMode, pageSize[1]);
      for (const placement of placements) page.drawImage(image, placement);
      if (paperMode === "a4-portrait-half" || paperMode === "a4-portrait-duplicate") {
        const cutY = pageSize[1] - 148.5 * MM_TO_PT;
        page.drawLine({
          start: { x: 6 * MM_TO_PT, y: cutY },
          end: { x: 204 * MM_TO_PT, y: cutY },
          thickness: 0.6,
          color: rgb(0.45, 0.45, 0.45),
          dashArray: [4, 3],
        });
      }
    }
  } finally {
    sandbox.frame.remove();
  }
  return pdf.save();
}

function getPageSize(paperMode: PrintPaperMode) {
  if (paperMode === "a5-landscape") return A5_LANDSCAPE;
  if (paperMode === "a4-landscape-full") return A4_LANDSCAPE;
  return A4_PORTRAIT;
}

function getTicketPlacements(paperMode: PrintPaperMode, pageHeight: number) {
  if (paperMode === "a4-landscape-full") {
    const scale = 297 / 210;
    const x = TICKET.x * scale;
    const top = TICKET.top * scale;
    const height = TICKET.height * scale;
    return [
      {
        x,
        y: pageHeight - top - height,
        width: TICKET.width * scale,
        height,
      },
    ];
  }

  const first = {
    x: TICKET.x,
    y: pageHeight - TICKET.top - TICKET.height,
    width: TICKET.width,
    height: TICKET.height,
  };
  if (paperMode !== "a4-portrait-duplicate") return [first];

  return [
    first,
    {
      ...first,
      y: pageHeight - (148.5 * MM_TO_PT + TICKET.top) - TICKET.height,
    },
  ];
}

export function printPdfFromCurrentPage(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.title = `打印 ${filename}`;
  frame.dataset.repairdeskPdfPrint = "true";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let cleaned = false;
    let cleanupTimer = 0;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.clearTimeout(cleanupTimer);
      frame.remove();
      URL.revokeObjectURL(url);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const loadTimer = window.setTimeout(() => fail("打印文件加载超时，请重试"), 15_000);
    frame.addEventListener(
      "error",
      () => {
        window.clearTimeout(loadTimer);
        fail("无法加载打印文件，请重试");
      },
      { once: true },
    );
    frame.addEventListener(
      "load",
      () => {
        window.clearTimeout(loadTimer);
        const printWindow = frame.contentWindow;
        if (!printWindow) {
          fail("浏览器无法启动打印预览");
          return;
        }
        try {
          printWindow.addEventListener("afterprint", cleanup, { once: true });
          printWindow.focus();
          printWindow.print();
          settled = true;
          if (!cleaned) cleanupTimer = window.setTimeout(cleanup, 10 * 60_000);
          resolve();
        } catch {
          fail("浏览器无法启动打印预览，请检查打印权限");
        }
      },
      { once: true },
    );

    frame.src = url;
    document.body.appendChild(frame);
  });
}

async function createPrintSandbox() {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-12000px;top:0;width:210mm;height:148mm;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error("无法建立打印渲染环境");
  }
  frameDocument.open();
  frameDocument.write(
    `<style>${collectPrintCss()} *,*::before,*::after{box-sizing:border-box} html,body{margin:0!important;background:#fff!important}.repair-print-sheet{display:block!important;position:static!important;visibility:visible!important;pointer-events:auto!important}.repair-print-page-content{position:static!important}</style><div class="repair-print-sheet"><div id="pdf-root"></div></div>`,
  );
  frameDocument.close();
  await frameDocument.fonts?.ready;
  const root = frameDocument.getElementById("pdf-root");
  if (!root) throw new Error("无法准备打印内容");
  return { frame, document: frameDocument, window: frameWindow, root };
}

function collectPrintCss() {
  if (printCssCache !== null) return printCssCache;
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) collectRule(rule, rules);
    } catch {
      // Cross-origin font styles are not required for the Arial print contract.
    }
  }
  printCssCache = rules.join("\n");
  return printCssCache;
}

let printCssCache: string | null = null;

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("无法压缩打印图像，请重试"));
    }, "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function collectRule(rule: CSSRule, output: string[]) {
  if (rule instanceof CSSMediaRule) {
    if (rule.conditionText.includes("print")) {
      for (const child of Array.from(rule.cssRules)) output.push(child.cssText);
    }
    return;
  }
  if (rule instanceof CSSStyleRule && rule.selectorText.includes("repair-print")) {
    output.push(rule.cssText);
  }
}

function nextFrame(targetWindow: Window) {
  return new Promise<void>((resolve) => targetWindow.requestAnimationFrame(() => resolve()));
}
