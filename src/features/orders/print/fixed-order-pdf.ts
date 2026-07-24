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
const FIXED_PDF_TEMPLATE_VERSION = "fixed-order-pdf-v2";
const MAX_CAPTURE_CACHE_ENTRIES = 3;
const MAX_PDF_CACHE_ENTRIES = 8;
const TICKET = {
  x: 6 * MM_TO_PT,
  top: 6 * MM_TO_PT,
  width: 198 * MM_TO_PT,
  height: 136 * MM_TO_PT,
};

export type FixedOrderPdfMetrics = {
  paperMode: PrintPaperMode;
  pageCount: number;
  cacheHit: boolean;
  sourceCacheHit: boolean;
  fingerprintMs: number;
  captureMs: number;
  encodeMs: number;
  composeMs: number;
  totalPdfReadyMs: number;
  prepareMs: number;
  layoutReadyMs: number;
  pdfMs: number;
  endToEndReadyMs: number;
};

export type FixedOrderPdfResult = {
  bytes: Uint8Array;
  metrics: FixedOrderPdfMetrics;
};

type CapturedPrintTicket = {
  pages: Uint8Array[];
  captureMs: number;
  encodeMs: number;
};

const capturedTicketCache = new Map<string, Promise<CapturedPrintTicket>>();
const fixedPdfCache = new Map<string, Promise<Uint8Array>>();
let cacheEpoch = 0;

export async function createFixedOrderPdf(paperMode: PrintPaperMode) {
  return (await createFixedOrderPdfWithMetrics(paperMode)).bytes;
}

export async function createFixedOrderPdfWithMetrics(
  paperMode: PrintPaperMode,
  scopeKey = "default",
  signal?: AbortSignal,
): Promise<FixedOrderPdfResult> {
  if (signal?.aborted) throw new DOMException("Printing cancelled", "AbortError");
  const requestEpoch = cacheEpoch;
  const totalStartedAt = now();
  const sourcePages = Array.from(
    document.querySelectorAll<HTMLElement>("body > .repair-print-sheet .repair-print-page-content"),
  );
  if (!sourcePages.length) throw new Error("打印工单尚未准备完成，请重试");

  const fingerprintStartedAt = now();
  const fingerprint = await createPrintSourceFingerprint(sourcePages);
  const fingerprintMs = now() - fingerprintStartedAt;
  const cacheable = canCacheFixedOrderPdf(sourcePages.length);
  const scopedFingerprint = `${scopeKey}:${fingerprint}`;
  const pdfCacheKey = `${FIXED_PDF_TEMPLATE_VERSION}:${paperMode}:${scopedFingerprint}`;
  const cachedPdf = cacheable ? fixedPdfCache.get(pdfCacheKey) : undefined;
  if (cachedPdf) {
    touchCacheEntry(fixedPdfCache, pdfCacheKey, cachedPdf);
    const bytes = await cachedPdf;
    if (signal?.aborted) throw new DOMException("Printing cancelled", "AbortError");
    return {
      bytes: bytes.slice(),
      metrics: {
        paperMode,
        pageCount: sourcePages.length,
        cacheHit: true,
        sourceCacheHit: true,
        fingerprintMs,
        captureMs: 0,
        encodeMs: 0,
        composeMs: 0,
        totalPdfReadyMs: now() - totalStartedAt,
        prepareMs: 0,
        layoutReadyMs: 0,
        pdfMs: now() - totalStartedAt,
        endToEndReadyMs: now() - totalStartedAt,
      },
    };
  }

  let capturePromise = cacheable ? capturedTicketCache.get(scopedFingerprint) : undefined;
  const sourceCacheHit = Boolean(capturePromise);
  if (!capturePromise) {
    capturePromise = capturePrintTicket(sourcePages);
    if (cacheable) {
      rememberCacheEntry(
        capturedTicketCache,
        scopedFingerprint,
        capturePromise,
        MAX_CAPTURE_CACHE_ENTRIES,
      );
      capturePromise.catch(() => capturedTicketCache.delete(scopedFingerprint));
    }
  } else {
    touchCacheEntry(capturedTicketCache, scopedFingerprint, capturePromise);
  }
  const captured = await capturePromise;
  if (signal?.aborted) throw new DOMException("Printing cancelled", "AbortError");
  const composeStartedAt = now();
  const pdfPromise = composeFixedOrderPdf(captured.pages, paperMode);
  if (cacheable && requestEpoch === cacheEpoch) {
    rememberCacheEntry(fixedPdfCache, pdfCacheKey, pdfPromise, MAX_PDF_CACHE_ENTRIES);
    pdfPromise.catch(() => fixedPdfCache.delete(pdfCacheKey));
  }
  const bytes = await pdfPromise;
  const composeMs = now() - composeStartedAt;

  return {
    bytes: bytes.slice(),
    metrics: {
      paperMode,
      pageCount: sourcePages.length,
      cacheHit: false,
      sourceCacheHit,
      fingerprintMs,
      captureMs: sourceCacheHit ? 0 : captured.captureMs,
      encodeMs: sourceCacheHit ? 0 : captured.encodeMs,
      composeMs,
      totalPdfReadyMs: now() - totalStartedAt,
      prepareMs: 0,
      layoutReadyMs: 0,
      pdfMs: now() - totalStartedAt,
      endToEndReadyMs: now() - totalStartedAt,
    },
  };
}

export function clearFixedOrderPdfMemoryCache() {
  cacheEpoch += 1;
  capturedTicketCache.clear();
  fixedPdfCache.clear();
}

export function canCacheFixedOrderPdf(pageCount: number) {
  return pageCount === 1;
}

async function capturePrintTicket(sourcePages: HTMLElement[]): Promise<CapturedPrintTicket> {
  const sandbox = await createPrintSandbox();
  const pages: Uint8Array[] = [];
  let captureMs = 0;
  let encodeMs = 0;
  try {
    for (const source of sourcePages) {
      const target = sandbox.document.createElement("div");
      target.className = "repair-print-page-content";
      target.setAttribute("style", source.getAttribute("style") ?? "");
      target.innerHTML = source.innerHTML;
      sandbox.root.replaceChildren(target);
      await nextFrame(sandbox.window);

      const captureStartedAt = now();
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: PRINT_CAPTURE_SCALE,
        logging: false,
        useCORS: true,
      });
      captureMs += now() - captureStartedAt;
      const encodeStartedAt = now();
      pages.push(await canvasToPngBytes(canvas));
      encodeMs += now() - encodeStartedAt;
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    sandbox.frame.remove();
  }
  return { pages, captureMs, encodeMs };
}

async function composeFixedOrderPdf(sourcePages: Uint8Array[], paperMode: PrintPaperMode) {
  const pdf = await PDFDocument.create();
  for (const sourcePage of sourcePages) {
    const image = await pdf.embedPng(sourcePage);
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

export function printPdfFromCurrentPage(
  bytes: Uint8Array,
  filename: string,
  options?: { signal?: AbortSignal },
) {
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
      options?.signal?.removeEventListener("abort", abort);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const abort = () => fail("打印已取消");

    if (options?.signal?.aborted) {
      abort();
      return;
    }
    options?.signal?.addEventListener("abort", abort, { once: true });

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
        if (options?.signal?.aborted) {
          abort();
          return;
        }
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

async function createPrintSourceFingerprint(sourcePages: HTMLElement[]) {
  const source = sourcePages
    .map(
      (page) => `${page.getAttribute("style") ?? ""}\u001f${page.className}\u001f${page.innerHTML}`,
    )
    .join("\u001e");
  const input = new TextEncoder().encode(`${FIXED_PDF_TEMPLATE_VERSION}\u001d${source}`);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  let hash = 2166136261;
  for (const byte of input) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length}-${(hash >>> 0).toString(16)}`;
}

function rememberCacheEntry<K, V>(cache: Map<K, V>, key: K, value: V, limit: number) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function touchCacheEntry<K, V>(cache: Map<K, V>, key: K, value: V) {
  cache.delete(key);
  cache.set(key, value);
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
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
