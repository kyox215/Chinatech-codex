import Link from "next/link";
import { ClipboardList, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

export type DashboardPriorityFilter = "all" | "overdue" | "actionable" | "waiting";

export function DashboardPriorityLoading() {
  const { t } = useLocale();
  return (
    <div
      data-ui="dashboard-priority-loading"
      role="status"
      aria-busy="true"
      aria-label={t("dashboard.loadingPriority")}
      className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-[auto_1fr] lg:gap-3 xl:grid-cols-[minmax(0,1fr)_320px]"
    >
      <section
        className={cn(
          repairOs.adminSection,
          "order-1 min-w-0 p-2 lg:col-start-2 lg:row-start-1 lg:p-3",
        )}
      >
        <Skeleton className="h-4 w-24" />
        <div className="mt-1.5 grid grid-cols-3 gap-1.5 lg:mt-3 lg:grid-cols-1 lg:gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-xl lg:h-14" />
          ))}
        </div>
      </section>
      <section
        className={cn(
          repairOs.adminSection,
          "order-2 min-w-0 p-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:p-3",
        )}
      >
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />
        <div className="mt-2 grid grid-cols-4 gap-1 lg:mt-3 lg:gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-xl" />
          ))}
        </div>
        <div className="mt-2 space-y-1.5 lg:mt-3 lg:space-y-2">
          <Skeleton className="h-48 rounded-2xl lg:h-64" />
          <Skeleton className="h-40 rounded-2xl lg:h-44" />
          <Skeleton className="h-40 rounded-2xl lg:h-44" />
        </div>
      </section>
      <section
        className={cn(
          repairOs.adminSection,
          "order-3 min-w-0 p-2 lg:col-start-2 lg:row-start-2 lg:p-3",
        )}
      >
        <Skeleton className="h-4 w-20" />
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 lg:mt-3 lg:grid-cols-1 lg:gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardPriorityError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <section
      data-ui="dashboard-priority-error"
      role="alert"
      className={cn(
        repairOs.adminSection,
        "grid min-w-0 gap-3 border-status-danger-foreground/25 bg-status-danger/10 p-4 text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t("dashboard.priorityUnavailable")}</p>
        <p className="mt-1 text-xs leading-5 text-status-danger-foreground/80">
          {t("dashboard.priorityErrorDetail")}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="h-11 gap-1.5 rounded-xl border-status-danger-foreground/25 bg-card px-4 text-xs"
      >
        <RefreshCw className="size-3.5" aria-hidden />
        {t("orders.retry")}
      </Button>
    </section>
  );
}

export function DashboardPriorityPermissionError() {
  const { t } = useLocale();
  return (
    <section
      data-ui="dashboard-priority-permission-error"
      role="alert"
      className={cn(
        repairOs.adminSection,
        "min-w-0 border-status-warn-foreground/25 bg-status-warn/10 p-4 text-status-warn-foreground",
      )}
    >
      <p className="text-sm font-semibold">{t("dashboard.permissionDenied")}</p>
      <p className="mt-1 text-xs leading-5 text-status-warn-foreground/80">
        {t("dashboard.permissionDetail")}
      </p>
    </section>
  );
}

export function DashboardPriorityEmpty({ coverage }: { coverage: DashboardSummary["coverage"] }) {
  const { t } = useLocale();
  return (
    <div
      data-ui="dashboard-priority-empty"
      className="mt-2 rounded-2xl border border-dashed border-[var(--border-panel)] px-3 py-4 text-center sm:mt-3 sm:px-4 sm:py-8"
    >
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <ClipboardList className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">
        {coverage === "assigned" ? t("dashboard.noAssignedOrders") : t("dashboard.noActiveOrders")}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {coverage === "assigned" ? t("dashboard.assignmentHelp") : t("dashboard.startQuickOrder")}
      </p>
    </div>
  );
}

export function DashboardFilteredEmpty({
  filter,
  filteredTotal,
  sampledTotal,
}: {
  filter: DashboardPriorityFilter;
  filteredTotal: number;
  sampledTotal: number;
}) {
  const { t } = useLocale();
  const copy: Record<DashboardPriorityFilter, string> = {
    all: t("dashboard.noPriority"),
    overdue: t("dashboard.noOverdue"),
    actionable: t("dashboard.noActionable"),
    waiting: t("dashboard.noWaiting"),
  };
  return (
    <div
      data-ui="dashboard-priority-filter-empty"
      className="mt-2 rounded-2xl border border-dashed border-[var(--border-panel)] px-3 py-4 text-center text-xs text-muted-foreground sm:mt-3 sm:px-4 sm:py-7 sm:text-sm"
    >
      {filteredTotal > 0 ? (
        <div className="space-y-2">
          <p className="font-medium text-foreground">
            {t("dashboard.sampleMissingFilter", {
              sampledTotal,
              filter: getDashboardFilterLabel(filter, t),
            })}
          </p>
          <p className="text-xs leading-5">
            {t("dashboard.queueRemaining", { count: filteredTotal })}
          </p>
          <Button asChild variant="outline" size="sm" className="h-11 rounded-xl px-4 text-xs">
            <Link href="/orders">{t("dashboard.showCompleteQueue")}</Link>
          </Button>
        </div>
      ) : (
        copy[filter]
      )}
    </div>
  );
}

export function getDashboardFilterLabel(
  filter: DashboardPriorityFilter,
  t: (key: MessageKey) => string,
) {
  const labels: Record<DashboardPriorityFilter, string> = {
    all: t("dashboard.filterAll"),
    overdue: t("dashboard.filterOverdue"),
    actionable: t("dashboard.filterActionable"),
    waiting: t("dashboard.filterWaiting"),
  };
  return labels[filter];
}
