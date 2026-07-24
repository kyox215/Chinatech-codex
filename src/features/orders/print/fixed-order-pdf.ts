"use client";

import html2canvas from "html2canvas";
import { PDFDocument, rgb } from "pdf-lib";

import type { PrintPaperMode } from "@/features/orders/components/print-portal";

const MM_TO_PT = 72 / 25.4;
const A5_LANDSCAPE = [210 * MM_TO_PT, 148 * MM_TO_PT] as const;
const A4_PORTRAIT = [210 * MM_TO_PT, 297 * MM_TO_PT] as const;
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
        scale: 3,
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const image = await pdf.embedPng(dataUrl);
      const pageSize = paperMode === "a5-landscape" ? A5_LANDSCAPE : A4_PORTRAIT;
      const page = pdf.addPage([...pageSize]);
      page.drawImage(image, {
        x: TICKET.x,
        y: pageSize[1] - TICKET.top - TICKET.height,
        width: TICKET.width,
        height: TICKET.height,
      });
      if (paperMode === "a4-portrait-half") {
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

export function openPdfLoadingWindow() {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("浏览器阻止了打印窗口，请允许此网站打开弹窗后重试");
  popup.document.title = "正在生成打印文件";
  popup.document.body.innerHTML =
    '<p style="font:16px system-ui;padding:24px">正在生成固定尺寸 PDF，请稍候…</p>';
  return popup;
}

export function showPdfInWindow(popup: Window, bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  popup.document.title = filename;
  popup.document.documentElement.style.height = "100%";
  popup.document.body.style.cssText = "height:100%;margin:0;overflow:hidden";
  popup.document.body.innerHTML = `<embed id="repairdesk-fixed-pdf" src="${url}" type="application/pdf" style="width:100%;height:100%;border:0" />`;
  window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
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
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) collectRule(rule, rules);
    } catch {
      // Cross-origin font styles are not required for the Arial print contract.
    }
  }
  return rules.join("\n");
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
