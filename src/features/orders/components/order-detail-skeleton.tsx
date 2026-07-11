import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function OrderDetailSkeleton({
  surface = "page",
  onClose,
}: {
  surface?: "page" | "dialog";
  onClose?: () => void;
}) {
  return (
    <div
      data-ui="order-detail-skeleton"
      data-order-detail-surface={surface}
      className={cn(
        "relative min-w-0 max-w-full overflow-x-clip",
        surface === "page"
          ? cn(
              repairOs.mobileFloatingPage,
              "mx-auto w-full max-w-[430px] px-2 pb-28 pt-0 sm:max-w-[430px] sm:px-2 sm:pb-32 md:max-w-[1200px] md:px-6",
            )
          : cn(detailWorkspace.root, "flex h-full flex-col p-2 sm:p-3"),
      )}
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        正在准备工单详情
      </span>
      {surface === "page" ? (
        <div className="md:hidden">
          <div className={repairOs.mobileFloatingHeaderShell}>
            <section className={repairOs.mobileFloatingHeaderCard}>
              <header className={repairOs.mobileFloatingHeaderNav}>
                <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg">
                  <Link href="/orders" aria-label="返回工单列表">
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
                <div className="min-w-0 text-center">
                  <p className="truncate text-xs font-semibold leading-4">订单详情</p>
                  <Skeleton aria-hidden="true" className="mx-auto mt-1 h-2.5 w-20" />
                </div>
                <Skeleton aria-hidden="true" className="size-8 rounded-lg" />
              </header>
              <div aria-hidden="true" className={repairOs.mobileFloatingHeaderBody}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-5 w-14" />
                </div>
                <Skeleton className="mt-2 h-5 w-full" />
              </div>
            </section>
          </div>
        </div>
      ) : null}
      {surface === "dialog" && onClose ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-2 top-2 z-40 size-8 rounded-full bg-card/95 shadow-[var(--shadow-card)]"
          onClick={onClose}
          aria-label="关闭工单详情"
        >
          <X className="size-4" />
        </Button>
      ) : null}

      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-2">
        <Skeleton className="h-28 w-full shrink-0 rounded-xl md:h-32" />
        <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44 rounded-xl md:h-52" />
          <Skeleton className="h-44 rounded-xl md:h-52" />
          <Skeleton className="h-48 rounded-xl md:h-52" />
          <Skeleton className="h-36 rounded-xl md:col-span-2 xl:col-span-3" />
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
