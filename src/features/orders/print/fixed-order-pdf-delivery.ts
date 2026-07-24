"use client";

import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import type { FixedOrderPdfMetrics } from "@/features/orders/print/fixed-order-pdf";

export type PreparedFixedPdf = {
  filename: string;
  paperMode: PrintPaperMode;
  file: File | null;
  url: string;
  metrics: FixedOrderPdfMetrics;
  canShare: boolean;
};

export type FixedPdfShareOutcome = "shared" | "cancelled" | "unsupported";

export function shouldUseExplicitMobilePdfDelivery() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  const appleMobile = /iPad|iPhone|iPod/i.test(userAgent);
  const ipadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const android = /Android/i.test(userAgent);
  return appleMobile || ipadDesktopMode || android;
}

export function createPreparedFixedPdf(
  bytes: Uint8Array,
  filename: string,
  paperMode: PrintPaperMode,
  metrics: FixedOrderPdfMetrics,
): PreparedFixedPdf {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const file =
    typeof File === "function" ? new File([blob], filename, { type: "application/pdf" }) : null;
  return {
    filename,
    paperMode,
    file,
    url: URL.createObjectURL(blob),
    metrics,
    canShare: canSharePreparedPdf(file),
  };
}

export function releasePreparedFixedPdf(prepared: PreparedFixedPdf | null) {
  if (prepared) URL.revokeObjectURL(prepared.url);
}

export async function sharePreparedFixedPdf(
  prepared: PreparedFixedPdf,
): Promise<FixedPdfShareOutcome> {
  if (!prepared.file || !prepared.canShare || typeof navigator.share !== "function") {
    return "unsupported";
  }
  try {
    await navigator.share({
      files: [prepared.file],
      title: prepared.filename,
    });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export function openPreparedFixedPdf(prepared: PreparedFixedPdf) {
  window.location.assign(prepared.url);
}

export function downloadPreparedFixedPdf(prepared: PreparedFixedPdf) {
  const anchor = document.createElement("a");
  anchor.href = prepared.url;
  anchor.download = prepared.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function canSharePreparedPdf(file: File | null) {
  if (!file || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
