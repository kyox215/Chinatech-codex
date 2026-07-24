"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";

import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import {
  createFixedOrderPdf,
  printPdfFromCurrentPage,
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
      activeRef.current = true;
      const progressToast = toast.loading("正在准备订单二维码…");
      try {
        await prepare?.();
        toast.loading("正在生成固定尺寸 PDF…", { id: progressToast });
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const bytes = await createFixedOrderPdf(paperMode);
        toast.loading("PDF 已生成，正在打开打印预览…", { id: progressToast });
        await printPdfFromCurrentPage(bytes, filename);
        toast.success("打印预览已打开", { id: progressToast, duration: 2_000 });
        onComplete?.();
        return "started";
      } catch (cause) {
        toast.dismiss(progressToast);
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
