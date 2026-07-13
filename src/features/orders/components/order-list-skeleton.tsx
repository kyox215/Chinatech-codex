import type { CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { orderQueueDesktopGrid } from "./order-list-layout";

function OrderMobileCardSkeleton() {
  return (
    <article className={cn(repairOs.mobileInfoCard, "h-[148px] space-y-2 p-2.5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="space-y-1.5 rounded-lg bg-surface-muted/70 p-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_92px] items-end gap-2 border-t border-[var(--border-panel)] pt-1.5">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="ml-auto h-4 w-14" />
          <Skeleton className="ml-auto h-5 w-20" />
        </div>
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
  return (
    <div
      data-ui="order-list-skeleton"
      className={cn(repairOs.mobileListFloatingPage, "md:pb-8")}
      style={{ "--orders-mobile-header-offset": "22rem" } as CSSProperties}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        正在准备订单管理
      </span>

      <div aria-hidden="true">
        <div className={repairOs.mobileListHeaderShell}>
          <section className={repairOs.mobileFloatingHeaderCard}>
            <header className={repairOs.mobileFloatingHeaderNav}>
              <Skeleton className="size-10 rounded-xl" />
              <div className="mx-auto w-full max-w-32 space-y-1">
                <Skeleton className="mx-auto h-4 w-20" />
                <Skeleton className="mx-auto h-2.5 w-24" />
              </div>
              <Skeleton className="size-10 rounded-xl" />
            </header>
            <div className={cn(repairOs.mobileFloatingHeaderBody, "space-y-1.5")}>
              <div className="grid grid-cols-[minmax(0,1fr)_40px_40px] gap-1.5">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="size-10 rounded-xl" />
              </div>
              <Skeleton className="h-9 rounded-md" />
              <div className="grid grid-cols-2 gap-1">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className={cn("h-10 rounded-lg", index === 0 && "col-span-2")}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        <div
          className={cn(
            repairOs.mobileInfoCard,
            "mb-3 mt-3 hidden min-w-0 gap-2 p-2.5 md:flex md:flex-col",
          )}
        >
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

        <div className="space-y-1.5 lg:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <OrderMobileCardSkeleton key={index} />
          ))}
        </div>

        <div className="hidden space-y-1.5 lg:block">
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
      </div>
    </div>
  );
}
