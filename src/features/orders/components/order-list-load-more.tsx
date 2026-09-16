"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n/locale-provider";

export function OrderListLoadMore({
  hasMore,
  loading,
  failed,
  disabled,
  onLoad,
  onRetry,
}: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  disabled: boolean;
  onLoad: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading || failed || disabled) return;
    let armed = false;
    let frame = 0;
    const check = () => {
      frame = 0;
      const bounds = sentinel.current?.getBoundingClientRect();
      if (armed && bounds && bounds.top < window.innerHeight + 160 && bounds.bottom > 0) {
        armed = false;
        onLoad();
      }
    };
    const arm = () => {
      armed = true;
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    const scroll = () => {
      if (armed && !frame) frame = window.requestAnimationFrame(check);
    };
    const key = (event: KeyboardEvent) => {
      if (["PageDown", "End", "ArrowDown", " "].includes(event.key)) arm();
    };
    const scrollbar = (event: PointerEvent) => {
      if (event.clientX >= document.documentElement.clientWidth - 20) arm();
    };
    window.addEventListener("wheel", arm, { passive: true });
    window.addEventListener("touchmove", arm, { passive: true });
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", scrollbar, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("wheel", arm);
      window.removeEventListener("touchmove", arm);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", scrollbar);
      window.removeEventListener("scroll", scroll, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [disabled, failed, hasMore, loading, onLoad]);
  return (
    <div
      ref={sentinel}
      data-order-load-more="true"
      aria-busy={loading}
      className="flex min-h-16 flex-col items-center justify-center gap-2 py-3"
    >
      {failed ? (
        <p role="alert" className="text-xs text-status-danger-foreground">
          {t("orders.loadMoreFailed")}
        </p>
      ) : null}
      {hasMore || failed || loading ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-40"
          disabled={disabled || loading}
          onClick={failed ? onRetry : onLoad}
        >
          {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {t(failed ? "orders.retry" : loading ? "orders.loadingMore" : "orders.loadMore")}
        </Button>
      ) : (
        <p role="status" className="text-xs text-muted-foreground">
          {t("orders.allLoaded")}
        </p>
      )}
    </div>
  );
}
