"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardPriorityCard } from "@/features/dashboard/components/dashboard-priority-card";
import {
  DashboardAttentionSummary,
  DashboardBusinessLinks,
} from "@/features/dashboard/components/dashboard-priority-sidebar";
import {
  DashboardFilteredEmpty,
  DashboardPriorityEmpty,
  DashboardPriorityError,
  DashboardPriorityLoading,
  DashboardPriorityPermissionError,
  getDashboardFilterLabel,
  type DashboardPriorityFilter,
} from "@/features/dashboard/components/dashboard-priority-states";
import type { DashboardPriorityItem, DashboardSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsSectionHeader } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";

export function DashboardPriorityWorkspace({
  summary,
  isLoading,
  hasHardError,
  hasPermissionError,
  hasStaleData,
  onRetry,
}: {
  summary?: DashboardSummary;
  isLoading: boolean;
  hasHardError: boolean;
  hasPermissionError?: boolean;
  hasStaleData: boolean;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const filterOptions = [
    { id: "all", label: t("dashboard.filterAll") },
    { id: "overdue", label: t("dashboard.filterOverdue") },
    { id: "actionable", label: t("dashboard.filterActionable") },
    { id: "waiting", label: t("dashboard.filterWaiting") },
  ] satisfies Array<{ id: DashboardPriorityFilter; label: string }>;
  const [filter, setFilter] = useState<DashboardPriorityFilter>("all");
  const filteredItems = useMemo(
    () => (summary ? summary.items.filter((item) => matchesFilter(item, filter)) : []),
    [filter, summary],
  );

  if (isLoading) return <DashboardPriorityLoading />;
  if (hasPermissionError) return <DashboardPriorityPermissionError />;
  if (hasHardError || !summary) return <DashboardPriorityError onRetry={onRetry} />;

  const filteredTotal = getFilterTotal(summary, filter);
  const visibleItems = filteredItems.slice(0, 5);

  return (
    <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-[auto_1fr] lg:gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
        <DashboardAttentionSummary summary={summary} />
      </div>

      <section
        className={cn(
          repairOs.adminSection,
          "order-2 min-w-0 p-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:p-3",
        )}
      >
        <RepairOsSectionHeader
          title={t("dashboard.nowProcess")}
          description={
            summary.coverage === "assigned"
              ? t("dashboard.assignedNextSteps")
              : t("dashboard.storeNextStepsDescription")
          }
          action={
            <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 gap-1 px-2 text-xs">
              <Link href="/orders">
                {t("dashboard.completeQueue")}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          }
        />

        {hasStaleData ? (
          <div
            data-ui="dashboard-priority-stale"
            aria-live="polite"
            className="mt-3 flex min-w-0 items-start gap-2 rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{t("dashboard.stalePriority")}</span>
          </div>
        ) : null}

        <div
          role="group"
          aria-label={t("dashboard.priorityFilter")}
          className="mt-2 grid min-w-0 grid-cols-4 gap-1 lg:mt-3 lg:gap-2"
        >
          {filterOptions.map((option) => {
            const selected = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                data-dashboard-priority-filter={option.id}
                onClick={() => setFilter(option.id)}
                className={cn(
                  "h-11 min-w-0 truncate rounded-xl border px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[360px]:px-2 min-[360px]:text-xs",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[var(--border-panel)] bg-card text-muted-foreground hover:bg-accent/60",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {summary.totalCandidates === 0 ? (
          <DashboardPriorityEmpty coverage={summary.coverage} />
        ) : filteredItems.length === 0 ? (
          <DashboardFilteredEmpty
            filter={filter}
            filteredTotal={filteredTotal}
            sampledTotal={summary.items.length}
          />
        ) : (
          <div
            className="mt-2 min-w-0 space-y-1.5 lg:mt-3 lg:space-y-2"
            data-ui="dashboard-priority-list"
          >
            <DashboardPriorityCard item={visibleItems[0]} primary />
            {visibleItems.slice(1).map((item) => (
              <DashboardPriorityCard key={item.orderId} item={item} />
            ))}
            {filteredTotal > visibleItems.length ? (
              <div className="rounded-xl border border-dashed border-[var(--border-panel)] px-3 py-2 text-center text-xs text-muted-foreground">
                {t("dashboard.summaryVisible", {
                  prefix:
                    filter === "all"
                      ? t("dashboard.showingTop")
                      : t("dashboard.currentPriorityList"),
                  count: visibleItems.length,
                  suffix:
                    filter === "all"
                      ? t("dashboard.completeQueue")
                      : `${getDashboardFilterLabel(filter, t)}${t("dashboard.completeQueue")}`,
                  total: filteredTotal,
                })}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div className="order-3 min-w-0 lg:col-start-2 lg:row-start-2">
        <DashboardBusinessLinks />
      </div>
    </div>
  );
}

function matchesFilter(item: DashboardPriorityItem, filter: DashboardPriorityFilter) {
  if (filter === "overdue") return item.isOverdue;
  if (filter === "actionable") return item.isActionable;
  if (filter === "waiting") return item.tier === "waiting";
  return true;
}

function getFilterTotal(summary: DashboardSummary, filter: DashboardPriorityFilter) {
  if (filter === "overdue") return summary.counts.overdue;
  if (filter === "actionable") {
    return summary.counts.overdue + summary.counts.ready + summary.counts.active;
  }
  if (filter === "waiting") return summary.counts.waiting;
  return summary.totalCandidates;
}
