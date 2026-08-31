"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useViewportMode } from "@/hooks/use-mobile";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import {
  orderMobileFluidDensity,
  orderMobileQueueAllSpan,
  orderMobileQueueGrid,
  orderMobileSkeletonHeaderOffsetClass,
  orderQueueDesktopGrid,
} from "./order-list-layout";

function OrderMobileCardSkeleton() {
  return (
    <article
      className={cn(
        repairOs.mobileInfoCard,
        orderMobileFluidDensity,
        "h-[clamp(7rem,31vw,7.625rem)] space-y-[var(--order-mobile-inline)] rounded-[var(--order-mobile-radius)] p-[var(--order-mobile-pad)]",
      )}
    >
      <div className="flex items-center justify-between gap-[var(--order-mobile-gap)]">
        <div className="flex min-w-0 flex-1 items-center gap-[var(--order-mobile-gap)]">
          <Skeleton className="size-5 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-[18px] w-24" />
      </div>
      <div className="flex items-center gap-[var(--order-mobile-gap)] rounded-lg bg-surface-muted/70 px-[var(--order-mobile-pad)] py-1">
        <Skeleton className="h-3.5 min-w-0 flex-1" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-3 w-4/5" />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-[var(--order-mobile-gap)] border-t border-[var(--border-panel)] pt-[var(--order-mobile-gap)]">
        <div className="space-y-1">
          <Skeleton className="h-[18px] w-20" />
          <Skeleton className="h-1 w-full" />
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
    </article>
  );
}

function OrderDesktopRowSkeleton() {
  return (
    <div
      className={cn(
        orderQueueDesktopGrid,
        "min-h-[58px] rounded-md border border-border/45 bg-card/80 px-1",
      )}
    >
      <Skeleton className="mx-auto size-4" />
      <div className="space-y-1 px-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="space-y-1 px-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <div className="space-y-1 px-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="space-y-1 px-2">
        <Skeleton className="ml-auto h-3.5 w-16" />
        <Skeleton className="ml-auto h-2.5 w-12" />
      </div>
      <div className="space-y-1 px-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-2.5 w-14" />
      </div>
      <Skeleton className="mx-auto size-6" />
    </div>
  );
}

export function OrderListSkeleton() {
  const { t } = useLocale();
  const viewportMode = useViewportMode();

  if (viewportMode === "pending") {
    return (
      <div
        data-ui="order-list-skeleton"
        data-ui-viewport="pending"
        className="mx-auto w-full min-w-0 max-w-7xl space-y-2 overflow-hidden px-2 py-3 sm:px-4 sm:py-5 md:px-6 lg:px-8"
        aria-busy="true"
      >
        <span className="sr-only" role="status" aria-live="polite">
          {t("orders.loadingList")}
        </span>
        <div aria-hidden="true" className="space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-ui="order-list-skeleton"
      className={cn(
        repairOs.mobileListFloatingPage,
        orderMobileSkeletonHeaderOffsetClass,
        "md:pb-8",
      )}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {t("orders.loadingList")}
      </span>

      <div aria-hidden="true">
        {viewportMode === "compact" ? (
          <div className={repairOs.mobileListHeaderShell}>
            <section
              className={cn(
                repairOs.mobileFloatingHeaderCard,
                orderMobileFluidDensity,
                "rounded-[var(--order-mobile-radius)] px-[var(--order-mobile-pad)] py-[var(--order-mobile-tight-gap)]",
              )}
            >
              <header
                className={cn(repairOs.mobileFloatingHeaderNav, "gap-[var(--order-mobile-gap)]")}
              >
                <Skeleton className="size-9 rounded-lg" />
                <div className="mx-auto w-full max-w-32 space-y-1">
                  <Skeleton className="mx-auto h-4 w-20" />
                  <Skeleton className="mx-auto h-2.5 w-24" />
                </div>
                <Skeleton className="size-9 rounded-lg" />
              </header>
              <div className="mt-[var(--order-mobile-inline)] min-w-0 space-y-[var(--order-mobile-content)] border-t border-[var(--border-panel)] pt-[var(--order-mobile-inline)]">
                <div className="grid grid-cols-[minmax(0,1fr)_36px_36px] gap-[var(--order-mobile-cluster)]">
                  <Skeleton className="h-9 rounded-lg" />
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="size-9 rounded-lg" />
                </div>
                <Skeleton className="h-8 rounded-md" />
                <div className={cn("grid", orderMobileQueueGrid)}>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className={cn(
                        "h-8 rounded-[var(--order-mobile-radius)]",
                        index === 0 && orderMobileQueueAllSpan,
                      )}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {viewportMode === "desktop" ? (
          <div className={cn(repairOs.mobileInfoCard, "mb-3 mt-3 min-w-0 space-y-2 p-2.5")}>
            <div className="grid flex-1 grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-9" />
              ))}
            </div>
            <div className="flex min-w-0 flex-1 gap-2">
              <Skeleton className="h-9 min-w-0 flex-1" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        ) : null}

        {viewportMode === "compact" ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <OrderMobileCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {viewportMode === "desktop" ? (
          <div className="space-y-1.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <div
              className={cn(
                orderQueueDesktopGrid,
                "rounded-lg border border-border/40 bg-surface/45 px-1 py-1.5",
              )}
            >
              <Skeleton className="mx-auto size-4" />
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="mx-2 h-3" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <OrderDesktopRowSkeleton key={index} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
