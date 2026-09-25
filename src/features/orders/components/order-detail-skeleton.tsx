"use client";

import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewportMode } from "@/hooks/use-mobile";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

function DetailCardSkeleton({
  name,
  className,
  emphasized = false,
}: {
  name: string;
  className?: string;
  emphasized?: boolean;
}) {
  return (
    <section
      data-order-detail-skeleton-section={name}
      className={cn(
        repairOs.mobileInfoCard,
        "min-w-0 space-y-3 rounded-xl p-3 shadow-none",
        emphasized && "bg-[var(--surface-panel-muted)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24 max-w-[55%]" />
        <Skeleton className="h-4 w-16 max-w-[35%]" />
      </div>
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </section>
  );
}

function MobileDetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2">
      <div className="grid min-w-0 items-start gap-2 md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)] md:gap-3">
        <div className="grid min-w-0 content-start gap-2">
          <DetailCardSkeleton name="customer" />
          <DetailCardSkeleton name="device" className="min-h-40" />
          <DetailCardSkeleton name="fault" />
        </div>
        <div className="grid min-w-0 content-start gap-2">
          <DetailCardSkeleton name="money" emphasized className="min-h-44" />
          <DetailCardSkeleton name="people" />
        </div>
      </div>
    </div>
  );
}

function DesktopDetailSkeleton({ surface }: { surface: "page" | "dialog" }) {
  return (
    <div
      aria-hidden="true"
      data-order-detail-skeleton-desktop="true"
      className={cn(
        "min-h-0 min-w-0 flex-1 flex-col gap-3",
        surface === "page" ? "hidden lg:flex" : "flex",
      )}
    >
      <section
        data-order-detail-skeleton-hero="true"
        className={cn(detailWorkspace.orderDetailContent, detailWorkspace.flatHero, "space-y-3")}
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-3/5" />
      </section>

      <div className="mx-auto flex w-full max-w-[1320px] min-w-0 items-center justify-between gap-3">
        <Skeleton className="h-9 w-72 max-w-[45%] rounded-lg" />
        <Skeleton className="h-9 w-40 max-w-[35%] rounded-lg" />
      </div>

      <div
        data-order-detail-skeleton-workbench="true"
        className={cn(
          detailWorkspace.orderDetailContent,
          "grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]",
        )}
      >
        <div className="grid min-w-0 content-start gap-3">
          <DetailCardSkeleton name="customer" />
          <DetailCardSkeleton name="device" className="min-h-48" />
          <DetailCardSkeleton name="supplement" />
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <DetailCardSkeleton name="money" emphasized className="min-h-52" />
          <DetailCardSkeleton name="fault-quote" className="min-h-44" />
        </div>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton({
  surface = "page",
  onClose,
  renderMode = "pending",
}: {
  surface?: "page" | "dialog";
  onClose?: () => void;
  renderMode?: ViewportMode;
}) {
  const { t } = useLocale();

  return (
    <div
      data-ui="order-detail-skeleton"
      data-order-detail-surface={surface}
      data-order-detail-render-mode={renderMode}
      className={cn(
        "@container/order-detail order-touch-workbench order-unified-workbench relative min-w-0 max-w-full overflow-x-clip",
        surface === "page"
          ? "mx-auto w-full max-w-[430px] px-2 pb-28 pt-0 sm:max-w-[430px] sm:px-2 sm:pb-32 md:max-w-[1200px] md:px-5 lg:space-y-3 lg:pb-8"
          : cn(detailWorkspace.root, "flex h-full flex-col p-2 sm:p-3"),
      )}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {t("orders2b2.loading")}
      </span>

      {surface === "page" ? (
        <div data-mobile-order-page="true" className={cn(repairOs.mobileFloatingPage, "lg:hidden")}>
          <div data-order-detail-skeleton-nav="true">
            <div
              data-mobile-order-header="true"
              className={cn(repairOs.mobileFloatingHeaderShell, "lg:!hidden")}
            >
              <section className={repairOs.mobileFloatingHeaderCard}>
                <header className={repairOs.mobileFloatingHeaderNav}>
                  <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg">
                    <Link
                      href="/orders"
                      aria-label={t("orders2b2.backOrdersAria")}
                      data-order-detail-skeleton-back="true"
                    >
                      <ArrowLeft className="size-4" />
                    </Link>
                  </Button>
                  <div className="min-w-0 text-center">
                    <p className="truncate text-xs font-semibold leading-4">
                      {t("orders2b2.title")}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] leading-3 text-muted-foreground">
                      {t("orders2b2.loading")}
                    </p>
                  </div>
                  <span aria-hidden="true" className="size-8" />
                </header>
                <div aria-hidden="true" className={repairOs.mobileFloatingHeaderBody}>
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-5 w-14" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </div>
              </section>
            </div>
          </div>
          <MobileDetailSkeleton />
        </div>
      ) : null}

      {surface === "dialog" && onClose ? (
        <div className="absolute right-4 top-4 z-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-lg bg-card/95 shadow-[var(--shadow-card)]"
            onClick={onClose}
            aria-label={t("orders2b2.close")}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <DesktopDetailSkeleton surface={surface} />
    </div>
  );
}
