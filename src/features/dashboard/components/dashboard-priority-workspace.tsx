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

const filterOptions = [
  { id: "all", label: "全部优先" },
  { id: "overdue", label: "已超期" },
  { id: "actionable", label: "可推进" },
  { id: "waiting", label: "等待中" },
] satisfies Array<{ id: DashboardPriorityFilter; label: string }>;

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
          title="现在先处理"
          description={
            summary.coverage === "assigned"
              ? "已按你的已分配工单排好下一步"
              : "已按全店当前工单排好下一步"
          }
          action={
            <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 gap-1 px-2 text-xs">
              <Link href="/orders">
                完整队列
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
            <span>当前显示上次读取的顺序，数据可能已经变化。</span>
          </div>
        ) : null}

        <div
          role="group"
          aria-label="优先工单筛选"
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
                {filter === "all" ? "已显示最高优先级" : "当前优先列表显示"}的 {visibleItems.length}{" "}
                单；
                {filter === "all"
                  ? "完整队列"
                  : `${getDashboardFilterLabel(filter)}完整队列`}共 {filteredTotal} 单。
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
