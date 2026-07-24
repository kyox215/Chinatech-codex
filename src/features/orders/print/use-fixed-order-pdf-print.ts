"use client";

import { useCallback, useRef } from "react";

import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import {
  createFixedOrderPdf,
  openPdfLoadingWindow,
  showPdfInWindow,
} from "@/features/orders/print/fixed-order-pdf";

export type FixedPdfPrintOutcome = "started" | "busy" | "failed";

export function useFixedOrderPdfPrint(onComplete?: () => void, onError?: (error: Error) => void) {
  const activeRef = useRef(false);
  return useCallback(
    async (
      paperMode: PrintPaperMode,
      filename: string,
      prepare?: () => void | Promise<void>,
    ): Promise<FixedPdfPrintOutcome> => {
      if (activeRef.current) return "busy";
      let popup: Window;
      try {
        popup = openPdfLoadingWindow();
      } catch (cause) {
        onError?.(cause instanceof Error ? cause : new Error("无法打开打印窗口"));
        return "failed";
      }
      activeRef.current = true;
      try {
        await prepare?.();
        popup.document.body.innerHTML =
          '<p style="font:16px system-ui;padding:24px">正在渲染工单内容…</p>';
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const bytes = await createFixedOrderPdf(paperMode);
        popup.document.body.innerHTML =
          '<p style="font:16px system-ui;padding:24px">正在打开固定尺寸 PDF…</p>';
        showPdfInWindow(popup, bytes, filename);
        onComplete?.();
        return "started";
      } catch (cause) {
        popup.close();
        const error = cause instanceof Error ? cause : new Error("无法生成打印 PDF");
        onError?.(error);
        return "failed";
      } finally {
        activeRef.current = false;
      }
    },
    [onComplete, onError],
  );
}
