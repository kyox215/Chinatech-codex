"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/shared/i18n/locale-provider";

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
  const { t } = useLocale();
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
    setDeliveryPending(false);
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
      const progressToast = toast.loading(t("orders2b2.pdf.preparingQr"));
      try {
        const prepareStartedAt = performance.now();
        await prepare?.({ signal: controller.signal, isCurrent });
        const prepareMs = performance.now() - prepareStartedAt;
        if (!isCurrent()) {
          toast.dismiss(progressToast);
          return "failed";
        }
        toast.loading(t("orders2b2.pdf.generating"), { id: progressToast });
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
          toast.success(t("orders2b2.pdf.readyFeedback"), {
            id: progressToast,
            duration: 3_000,
          });
          return "ready";
        }
        toast.loading(t("orders2b2.pdf.openingPreview"), { id: progressToast });
        try {
          await printPdfFromCurrentPage(bytes, filename, { signal: controller.signal });
        } catch {
          if (!isCurrent()) return "failed";
          replacePreparedPdf(createPreparedFixedPdf(bytes, filename, paperMode, readyMetrics));
          toast.warning(t("orders2b2.pdf.previewFallback"), {
            id: progressToast,
            duration: 4_000,
          });
          return "ready";
        }
        toast.success(t("orders2b2.pdf.previewOpened"), { id: progressToast, duration: 2_000 });
        if (isCurrent()) onComplete?.();
        return "started";
      } catch (cause) {
        toast.dismiss(progressToast);
        const error = cause instanceof Error ? cause : new Error(t("orders2b2.pdf.generateFailed"));
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
    [onComplete, onError, onPdfReady, replacePreparedPdf, scopeKey, t],
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
        setDeliveryError(t("orders2b2.pdf.shareUnsupported"));
        return;
      }
      if (outcome === "cancelled") {
        toast.info(t("orders2b2.pdf.shareCancelled"));
        return;
      }
      toast.success(t("orders2b2.pdf.shareOpened"));
      onComplete?.();
      dismissPreparedPdf();
    } catch {
      if (isCurrentShare()) {
        setDeliveryError(t("orders2b2.pdf.shareFailed"));
      }
    } finally {
      if (isCurrentShare()) {
        sharePendingRef.current = false;
        setDeliveryPending(false);
      }
    }
  }, [dismissPreparedPdf, onComplete, t]);

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
      setDeliveryError(t("orders2b2.pdf.openFailed"));
    }
  }, [onComplete, t]);

  const downloadPreparedPdf = useCallback(() => {
    const prepared = preparedRef.current;
    if (!prepared) return;
    downloadPreparedFixedPdf(prepared);
    toast.success(t("orders2b2.pdf.downloadStarted"));
  }, [t]);

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
