"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { appShell, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

import {
  orderMobileFluidDensity,
  orderMobileSkeletonHeaderOffsetClass,
  orderQueueDesktopGrid,
} from "./order-list-layout";

function OrderMobileCardSkeleton() {
  return (
    <article
      data-order-mobile-skeleton-card="true"
      className={cn(
        repairOs.mobileInfoCard,
        orderMobileFluidDensity,
        "min-h-[9.5rem] space-y-2 rounded-[var(--order-mobile-radius)] p-2.5",
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24 max-w-full" />
          <Skeleton className="h-4 w-40 max-w-[85%]" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="ml-auto h-5 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      </div>
      <div className="border-t border-[var(--border-panel)] pt-2">
        <Skeleton className="h-3 w-2/3" />
      </div>
    </article>
  );
}

function OrderDesktopRowSkeleton() {
  return (
    <div
      data-order-desktop-skeleton-row="true"
      className={cn(
        orderQueueDesktopGrid,
        "min-h-[5.5rem] rounded-md border border-border/45 bg-card/80 px-1",
      )}
    >
      <Skeleton className="mx-auto size-4" />
      <div className="col-[2/4] min-w-0 space-y-2 px-2">
        <Skeleton className="h-3.5 w-36 max-w-full" />
        <Skeleton className="h-3 w-52 max-w-[85%]" />
      </div>
      <div className="col-[4/6] min-w-0 space-y-2 px-2">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-[75%]" />
      </div>
      <Skeleton className="col-[6/7] mx-2 h-4" />
      <Skeleton className="col-[7/8] mx-2 h-4" />
      <Skeleton className="col-[8/9] mx-auto size-6" />
    </div>
  );
}

function OrderMobileLoadingHeader() {
  const { t } = useLocale();

  return (
    <div className={repairOs.mobileListHeaderShell} data-order-skeleton-mobile-header="true">
      <section
        className={cn(
          repairOs.mobileFloatingHeaderCard,
          orderMobileFluidDensity,
          "rounded-[var(--order-mobile-radius)] px-1.5 py-1",
        )}
      >
        <header
          className={cn(
            repairOs.mobileFloatingHeaderNav,
            "grid-cols-[44px_minmax(0,1fr)_44px] gap-1 py-0",
          )}
        >
          <SidebarTrigger className="size-11 rounded-lg bg-transparent shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">{t("orders.title")}</p>
            <p className="mt-0.5 truncate text-[9px] leading-3 text-muted-foreground">
              {t("orders.loadingList")}
            </p>
          </div>
          <span aria-hidden="true" className="size-11" />
        </header>
        <div
          aria-hidden="true"
          className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_44px_44px] gap-1 pb-1"
        >
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="size-11 rounded-lg" />
          <Skeleton className="size-11 rounded-lg" />
        </div>
      </section>
      <div
        aria-hidden="true"
        className="mx-auto grid w-full min-w-0 max-w-[430px] grid-cols-3 gap-1 pt-1 md:max-w-none"
      >
        <Skeleton className="h-8 rounded-lg" />
        <Skeleton className="h-8 rounded-lg" />
        <Skeleton className="h-8 rounded-lg" />
      </div>
    </div>
  );
}

export function OrderListSkeleton() {
  const { t } = useLocale();

  return (
    <div
      data-ui="order-list-skeleton"
      data-ui-viewport="responsive"
      className={cn(
        repairOs.mobileListFloatingPage,
        appShell.orderList,
        orderMobileSkeletonHeaderOffsetClass,
        "md:pb-8",
      )}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {t("orders.loadingList")}
      </span>

      <div className="lg:hidden">
        <OrderMobileLoadingHeader />
        <div aria-hidden="true" className="grid gap-2 md:grid-cols-2" role="presentation">
          {Array.from({ length: 4 }).map((_, index) => (
            <OrderMobileCardSkeleton key={index} />
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="hidden lg:block">
        <div
          data-order-skeleton-desktop-toolbar="true"
          className={cn(repairOs.mobileInfoCard, "mb-3 mt-1 min-w-0 space-y-2 p-2.5")}
        >
          <div className="grid min-w-0 grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
          </div>
          <div className="flex min-w-0 gap-2">
            <Skeleton className="h-11 min-w-0 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-24 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="mb-2 flex items-center justify-between px-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div
            data-order-skeleton-desktop-headings="true"
            className={cn(
              orderQueueDesktopGrid,
              "rounded-lg border border-border/40 bg-surface/45 px-1 py-1.5",
            )}
          >
            <Skeleton className="mx-auto size-4" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="mx-2 h-3" />
            ))}
            <span />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <OrderDesktopRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
