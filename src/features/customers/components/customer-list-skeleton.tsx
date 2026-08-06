"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useViewportMode } from "@/hooks/use-mobile";
import { dataDisplay, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

function CustomerMobileCardSkeleton() {
  return (
    <div className={cn(repairOs.mobileInfoCard, "h-24 p-2.5")}>
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function CustomerListSkeleton() {
  const viewportMode = useViewportMode();

  if (viewportMode === "pending") {
    return (
      <div
        data-ui="customer-list-skeleton"
        data-ui-viewport="pending"
        className="mx-auto w-full min-w-0 max-w-7xl space-y-2 overflow-hidden px-2 py-3 sm:px-4 sm:py-5 md:px-6 lg:px-8"
        aria-busy="true"
      >
        <span className="sr-only" role="status" aria-live="polite">
          正在准备客户管理
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
      data-ui="customer-list-skeleton"
      className={repairOs.mobileUnifiedListPage}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        正在准备客户管理
      </span>

      <div aria-hidden="true">
        {viewportMode === "compact" ? (
          <div className={repairOs.mobileListHeaderShell}>
            <section className={repairOs.mobileFloatingHeaderCard}>
              <header className={repairOs.mobileFloatingHeaderNav}>
                <Skeleton className="size-9 rounded-lg" />
                <div className="mx-auto w-full max-w-32 space-y-1">
                  <Skeleton className="mx-auto h-4 w-20" />
                  <Skeleton className="mx-auto h-2.5 w-24" />
                </div>
                <Skeleton className="size-9 rounded-lg" />
              </header>
              <div className={cn(repairOs.mobileFloatingHeaderBody, "space-y-2")}>
                <div className="grid grid-cols-[minmax(0,1fr)_40px_40px] gap-1.5">
                  <Skeleton className="h-10 rounded-xl" />
                  <Skeleton className="size-10 rounded-xl" />
                  <Skeleton className="size-10 rounded-xl" />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 rounded-lg" />
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {viewportMode === "desktop" ? (
          <div className="mb-4 space-y-3">
            <div className="flex justify-end">
              <Skeleton className="h-9 w-28" />
            </div>
            <div className={dataDisplay.kpiGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
              ))}
            </div>
            <div className={cn(repairOs.toolbar, "space-y-2 p-3")}>
              <div className="flex gap-2">
                <Skeleton className="h-9 min-w-0 flex-1" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-20" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-8" />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {viewportMode === "compact" ? (
          <div className={repairOs.listCardStack}>
            {Array.from({ length: 5 }).map((_, index) => (
              <CustomerMobileCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {viewportMode === "desktop" ? (
          <div className="max-w-full overflow-x-auto rounded-lg border border-border/40 bg-card">
            <div className="grid min-w-[840px] grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_104px_104px_112px_72px] gap-2 border-b border-border/40 px-3 py-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-3" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, row) => (
              <div
                key={row}
                className="grid min-h-14 min-w-[840px] grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_104px_104px_112px_72px] items-center gap-2 border-b border-border/30 px-3 py-2"
              >
                {Array.from({ length: 6 }).map((_, cell) => (
                  <Skeleton key={cell} className={cn("h-3", cell < 2 ? "w-3/4" : "w-2/3")} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
