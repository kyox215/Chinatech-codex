"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { density, layoutGuards, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

function CustomerMobileCardSkeleton() {
  return (
    <div
      data-customer-mobile-skeleton-card="true"
      className={cn(repairOs.businessCardDense, "min-h-[7.5rem] space-y-2.5")}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <Skeleton className="size-7 rounded-lg" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-28 max-w-full" />
          <Skeleton className="h-3 w-44 max-w-full" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

function CustomerMobileLoadingHeader() {
  const { t } = useLocale();

  return (
    <div className={repairOs.mobileListHeaderShell} data-customer-skeleton-mobile-header="true">
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header
          className={cn(repairOs.mobileFloatingHeaderNav, "grid-cols-[44px_minmax(0,1fr)_44px]")}
        >
          <SidebarTrigger className="size-11 rounded-lg bg-transparent shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">{t("customers.title")}</p>
            <p className="mt-0.5 truncate text-[9px] leading-3 text-muted-foreground">
              {t("customers.list.preparing")}
            </p>
          </div>
          <span aria-hidden="true" className="size-11" />
        </header>
        <div
          aria-hidden="true"
          className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_44px_44px] gap-1 pb-1"
        >
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="size-11 rounded-xl" />
        </div>
        <div aria-hidden="true" className="grid grid-cols-4 gap-1 pt-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}

export function CustomerListSkeleton() {
  const { t } = useLocale();

  return (
    <div
      data-ui="customer-list-skeleton"
      data-ui-viewport="responsive"
      className={repairOs.mobileUnifiedListPage}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {t("customers.list.preparing")}
      </span>

      <div className="lg:hidden">
        <CustomerMobileLoadingHeader />
        <div aria-hidden="true" className={repairOs.listCardStack}>
          {Array.from({ length: 5 }).map((_, index) => (
            <CustomerMobileCardSkeleton key={index} />
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="hidden lg:block">
        <section
          data-ui="customer-list-skeleton-desktop-header"
          className="sticky top-14 z-20 mb-6 rounded-xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-9 min-w-0 flex-1" />
            <Skeleton className="h-9 w-24 shrink-0" />
            <Skeleton className="h-9 w-24 shrink-0" />
            <Skeleton className="h-9 w-28 shrink-0" />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
          </div>
        </section>

        <div className="mb-2 flex items-center justify-between">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div
          data-customer-desktop-skeleton-list="true"
          className="glass-card min-w-0 max-w-full overflow-hidden"
        >
          <table
            className={cn(density.tableDense, "w-full table-fixed", layoutGuards.noPageOverflow)}
          >
            <thead>
              <tr className="border-b border-border/40">
                {["29%", "21%", "13%", "29%", "8%"].map((width, index) => (
                  <th key={`${width}-${index}`} style={{ width }} className="px-2 py-2">
                    <Skeleton
                      className={cn("h-3", index === 2 || index === 4 ? "ml-auto w-12" : "w-20")}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, row) => (
                <tr
                  key={row}
                  data-customer-desktop-skeleton-row="true"
                  className="h-[5.5rem] border-b border-border/30"
                >
                  <td className="px-3 py-2.5">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32 max-w-full" />
                      <Skeleton className="h-3 w-44 max-w-full" />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Skeleton className="h-3 w-4/5" />
                  </td>
                  <td className="px-2 py-2">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-24 max-w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Skeleton className="ml-auto h-8 w-12" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
