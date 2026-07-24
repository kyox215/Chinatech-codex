"use client";

import { useCallback, useEffect, useRef } from "react";

const PRINT_CLEANUP_FALLBACK_MS = 30_000;

export type PrintRequestOutcome = "started" | "busy" | "failed";
export type PrintPrepare = () => void | Promise<void>;

export function usePrintLifecycle(onComplete?: () => void, onError?: (error: Error) => void) {
  const activeRef = useRef(false);
  const frameRef = useRef<number[]>([]);
  const fallbackRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const clearScheduledWork = useCallback(() => {
    frameRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    frameRef.current = [];
    if (fallbackRef.current) {
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  const complete = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearScheduledWork();
    onCompleteRef.current?.();
  }, [clearScheduledWork]);

  useEffect(() => {
    const media = window.matchMedia?.("print");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (!event.matches) complete();
    };
    window.addEventListener("afterprint", complete);
    media?.addEventListener?.("change", handleMediaChange);
    return () => {
      window.removeEventListener("afterprint", complete);
      media?.removeEventListener?.("change", handleMediaChange);
      activeRef.current = false;
      clearScheduledWork();
    };
  }, [clearScheduledWork, complete]);

  return useCallback(
    async (prepare?: PrintPrepare): Promise<PrintRequestOutcome> => {
      if (activeRef.current) return "busy";
      activeRef.current = true;
      try {
        await prepare?.();
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error("无法准备打印内容");
        complete();
        onErrorRef.current?.(error);
        return "failed";
      }
      if (!activeRef.current) return "failed";

      const firstFrame = window.requestAnimationFrame(() => {
        const secondFrame = window.requestAnimationFrame(() => {
          frameRef.current = [];
          const overflowPage = document.querySelector('[data-print-overflow="true"]');
          if (overflowPage) {
            const error = new Error("打印内容过长，无法在一张 A5 纸内保持清晰，请缩短备注后重试");
            complete();
            onErrorRef.current?.(error);
            return;
          }
          fallbackRef.current = window.setTimeout(complete, PRINT_CLEANUP_FALLBACK_MS);
          try {
            window.print();
          } catch (cause) {
            const error = cause instanceof Error ? cause : new Error("无法打开打印预览");
            complete();
            onErrorRef.current?.(error);
          }
        });
        frameRef.current = [secondFrame];
      });
      frameRef.current = [firstFrame];
      return "started";
    },
    [complete],
  );
}
