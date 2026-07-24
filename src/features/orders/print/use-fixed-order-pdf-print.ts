"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import {
  clearFixedOrderPdfMemoryCache,
  createFixedOrderPdfWithMetrics,
  printPdfFromCurrentPage,
} from "@/features/orders/print/fixed-order-pdf";
import {
  createPreparedFixedPdf,
  downloadPreparedFixedPdf,
  openPreparedFixedPdf,
  type PreparedFixedPdf,
  releasePreparedFixedPdf,
  sharePreparedFixedPdf,
  shouldUseExplicitMobilePdfDelivery,
} from "@/features/orders/print/fixed-order-pdf-delivery";

export type FixedPdfPrintOutcome = "started" | "ready" | "busy" | "failed";

export const FIXED_PDF_READY_EVENT = "repairdesk:fixed-pdf-ready";

export function useFixedOrderPdfPrint(
  onComplete?: () => void,
  onError?: (error: Error) => void,
  options?: { scopeKey?: string; onPdfReady?: () => void; onInvalidate?: () => void },
) {
  const scopeKey = options?.scopeKey;
  const onPdfReady = options?.onPdfReady;
  const onInvalidate = options?.onInvalidate;
  const activeRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const sharePendingRef = useRef(false);
  const scopeRef = useRef(scopeKey);
  const controllerRef = useRef<AbortController | null>(null);
  const preparedRef = useRef<PreparedFixedPdf | null>(null);
  const handedOffUrlRef = useRef<string | null>(null);
  const [preparedPdf, setPreparedPdf] = useState<PreparedFixedPdf | null>(null);
  const [generationPending, setGenerationPending] = useState(false);
  const [deliveryPending, setDeliveryPending] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string>();

  const replacePreparedPdf = useCallback((next: PreparedFixedPdf | null) => {
    const previous = preparedRef.current;
    if (previous && previous.url !== handedOffUrlRef.current) releasePreparedFixedPdf(previous);
    preparedRef.current = next;
    handedOffUrlRef.current = null;
    setPreparedPdf(next);
    setDeliveryError(undefined);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      controllerRef.current?.abort();
      const prepared = preparedRef.current;
      if (prepared && prepared.url !== handedOffUrlRef.current) releasePreparedFixedPdf(prepared);
      preparedRef.current = null;
      clearFixedOrderPdfMemoryCache();
    };
  }, []);

  useEffect(() => {
    if (scopeRef.current === scopeKey) return;
    scopeRef.current = scopeKey;
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    activeRef.current = false;
    sharePendingRef.current = false;
    setGenerationPending(false);
    replacePreparedPdf(null);
    clearFixedOrderPdfMemoryCache();
    onInvalidate?.();
  }, [onInvalidate, replacePreparedPdf, scopeKey]);

  const requestPrint = useCallback(
    async (
      paperMode: PrintPaperMode,
      filename: string,
      prepare?: (context: {
        signal: AbortSignal;
        isCurrent: () => boolean;
      }) => void | Promise<void>,
    ): Promise<FixedPdfPrintOutcome> => {
      if (activeRef.current) return "busy";
      activeRef.current = true;
      setGenerationPending(true);
      const generation = ++generationRef.current;
      const controller = new AbortController();
      controllerRef.current = controller;
      const readyStartedAt = performance.now();
      const isCurrent = () => mountedRef.current && generationRef.current === generation;
      replacePreparedPdf(null);
      const progressToast = toast.loading("正在准备订单二维码…");
      try {
        const prepareStartedAt = performance.now();
        await prepare?.({ signal: controller.signal, isCurrent });
        const prepareMs = performance.now() - prepareStartedAt;
        if (!isCurrent()) {
          toast.dismiss(progressToast);
          return "failed";
        }
        toast.loading("正在生成固定尺寸 PDF…", { id: progressToast });
        const layoutStartedAt = performance.now();
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const layoutReadyMs = performance.now() - layoutStartedAt;
        if (!isCurrent()) {
          toast.dismiss(progressToast);
          return "failed";
        }
        const { bytes, metrics } = await createFixedOrderPdfWithMetrics(
          paperMode,
          scopeKey,
          controller.signal,
        );
        if (!isCurrent()) {
          toast.dismiss(progressToast);
          return "failed";
        }
        const readyMetrics = {
          ...metrics,
          prepareMs,
          layoutReadyMs,
          pdfMs: metrics.totalPdfReadyMs,
          endToEndReadyMs: performance.now() - readyStartedAt,
        };
        onPdfReady?.();
        window.dispatchEvent(new CustomEvent(FIXED_PDF_READY_EVENT, { detail: readyMetrics }));
        if (shouldUseExplicitMobilePdfDelivery()) {
          replacePreparedPdf(createPreparedFixedPdf(bytes, filename, paperMode, readyMetrics));
          toast.success("PDF 已准备好，请点击“打印或分享”", {
            id: progressToast,
            duration: 3_000,
          });
          return "ready";
        }
        toast.loading("PDF 已生成，正在打开打印预览…", { id: progressToast });
        try {
          await printPdfFromCurrentPage(bytes, filename, { signal: controller.signal });
        } catch {
          if (!isCurrent()) return "failed";
          replacePreparedPdf(createPreparedFixedPdf(bytes, filename, paperMode, readyMetrics));
          toast.warning("自动打印预览未打开，请手动打开 PDF", {
            id: progressToast,
            duration: 4_000,
          });
          return "ready";
        }
        toast.success("打印预览已打开", { id: progressToast, duration: 2_000 });
        if (isCurrent()) onComplete?.();
        return "started";
      } catch (cause) {
        toast.dismiss(progressToast);
        const error = cause instanceof Error ? cause : new Error("无法生成打印 PDF");
        if (isCurrent()) onError?.(error);
        return "failed";
      } finally {
        if (generationRef.current === generation) {
          activeRef.current = false;
          controllerRef.current = null;
          setGenerationPending(false);
        }
      }
    },
    [onComplete, onError, onPdfReady, replacePreparedPdf, scopeKey],
  );

  const dismissPreparedPdf = useCallback(() => {
    sharePendingRef.current = false;
    replacePreparedPdf(null);
    setDeliveryPending(false);
  }, [replacePreparedPdf]);

  const sharePreparedPdf = useCallback(async () => {
    const prepared = preparedRef.current;
    if (!prepared || sharePendingRef.current) return;
    const generation = generationRef.current;
    const isCurrentShare = () =>
      mountedRef.current &&
      generationRef.current === generation &&
      preparedRef.current === prepared;
    sharePendingRef.current = true;
    setDeliveryPending(true);
    setDeliveryError(undefined);
    try {
      const outcome = await sharePreparedFixedPdf(prepared);
      if (!isCurrentShare()) return;
      if (outcome === "unsupported") {
        setDeliveryError("当前浏览器不支持直接分享 PDF，请使用“查看 PDF”或下载备用文件。");
        return;
      }
      if (outcome === "cancelled") {
        toast.info("已取消系统菜单，可再次打开");
        return;
      }
      toast.success("已打开系统打印/分享");
      onComplete?.();
      dismissPreparedPdf();
    } catch {
      if (isCurrentShare()) {
        setDeliveryError("系统打印/分享没有打开，请重试或改用“查看 PDF”。");
      }
    } finally {
      if (isCurrentShare()) {
        sharePendingRef.current = false;
        setDeliveryPending(false);
      }
    }
  }, [dismissPreparedPdf, onComplete]);

  const openPreparedPdf = useCallback(() => {
    const prepared = preparedRef.current;
    if (!prepared) return;
    setDeliveryError(undefined);
    try {
      openPreparedFixedPdf(prepared);
      handedOffUrlRef.current = prepared.url;
      onComplete?.();
    } catch {
      handedOffUrlRef.current = null;
      setDeliveryError("浏览器没有打开 PDF，请重试或使用“下载 PDF”。");
    }
  }, [onComplete]);

  const downloadPreparedPdf = useCallback(() => {
    const prepared = preparedRef.current;
    if (!prepared) return;
    downloadPreparedFixedPdf(prepared);
    toast.success("已发起下载，请在浏览器下载项或“文件”中确认");
  }, []);

  return {
    requestPrint,
    preparedPdf,
    generationPending,
    deliveryPending,
    deliveryError,
    dismissPreparedPdf,
    sharePreparedPdf,
    openPreparedPdf,
    downloadPreparedPdf,
  };
}
