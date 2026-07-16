import Link from "next/link";
import { ClipboardList, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummary } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export type DashboardPriorityFilter = "all" | "overdue" | "actionable" | "waiting";

export function DashboardPriorityLoading() {
  return (
    <div
      data-ui="dashboard-priority-loading"
      role="status"
      aria-busy="true"
      aria-label="正在生成工单处理顺序"
      className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]"
    >
      <section className={cn(repairOs.adminSection, "min-w-0 p-3")}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-xl" />
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </section>
      <aside className="hidden space-y-3 lg:block">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </aside>
    </div>
  );
}

export function DashboardPriorityError({ onRetry }: { onRetry: () => void }) {
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
        <p className="text-sm font-semibold">暂时无法生成处理顺序</p>
        <p className="mt-1 text-xs leading-5 text-status-danger-foreground/80">
          快速接单和回收报价仍可使用。恢复后会重新读取完整队列，不会用部分工单猜测优先级。
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
        重试
      </Button>
    </section>
  );
}

export function DashboardPriorityPermissionError() {
  return (
    <section
      data-ui="dashboard-priority-permission-error"
      role="alert"
      className={cn(
        repairOs.adminSection,
        "min-w-0 border-status-warn-foreground/25 bg-status-warn/10 p-4 text-status-warn-foreground",
      )}
    >
      <p className="text-sm font-semibold">你没有查看优先队列的权限</p>
      <p className="mt-1 text-xs leading-5 text-status-warn-foreground/80">
        快速接单和回收报价仍可使用。如需查看交接顺序，请联系店长检查账号角色或工单分配。
      </p>
    </section>
  );
}

export function DashboardPriorityEmpty({ coverage }: { coverage: DashboardSummary["coverage"] }) {
  return (
    <div
      data-ui="dashboard-priority-empty"
      className="mt-3 rounded-2xl border border-dashed border-[var(--border-panel)] px-4 py-8 text-center"
    >
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <ClipboardList className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">
        {coverage === "assigned" ? "当前没有分配给你的工单" : "当前还没有活跃工单"}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {coverage === "assigned"
          ? "如需接手其他工单，请由有权限的店长先完成分配。"
          : "可以从快速接单开始第一笔维修业务。"}
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
  const copy: Record<DashboardPriorityFilter, string> = {
    all: "当前没有优先工单",
    overdue: "当前没有超期工单",
    actionable: "当前没有可立即推进的工单",
    waiting: "当前没有等待中的工单",
  };
  return (
    <div
      data-ui="dashboard-priority-filter-empty"
      className="mt-3 rounded-2xl border border-dashed border-[var(--border-panel)] px-4 py-7 text-center text-sm text-muted-foreground"
    >
      {filteredTotal > 0 ? (
        <div className="space-y-2">
          <p className="font-medium text-foreground">
            当前前 {sampledTotal} 个优先项暂未包含{getDashboardFilterLabel(filter)}工单
          </p>
          <p className="text-xs leading-5">完整队列仍有 {filteredTotal} 单，请进入完整队列查看。</p>
          <Button asChild variant="outline" size="sm" className="h-11 rounded-xl px-4 text-xs">
            <Link href="/orders">查看完整队列</Link>
          </Button>
        </div>
      ) : (
        copy[filter]
      )}
    </div>
  );
}

export function getDashboardFilterLabel(filter: DashboardPriorityFilter) {
  const labels: Record<DashboardPriorityFilter, string> = {
    all: "全部优先",
    overdue: "已超期",
    actionable: "可推进",
    waiting: "等待中",
  };
  return labels[filter];
}
