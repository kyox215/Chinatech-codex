"use client";

import { useQuery } from "@tanstack/react-query";

import {
  DashboardDesktopQuickStart,
  DashboardMobileQuickStart,
} from "@/features/dashboard/components/dashboard-quick-start";
import { DashboardPriorityWorkspace } from "@/features/dashboard/components/dashboard-priority-workspace";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { CACHE_TIMES } from "@/lib/query-performance";
import { getDashboardSummary, isRepairDeskAuthorizationError } from "@/lib/repairdesk/api";
import { RepairOsListScaffold } from "@/shared/ui";

const dashboardSummaryInput = { limit: 20 } as const;

export function DashboardScreen() {
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const dashboardQuery = useQuery({
    queryKey: ordersKeys.dashboardSummary(dashboardSummaryInput, activeStoreId),
    queryFn: ({ signal }) => getDashboardSummary(dashboardSummaryInput, { signal }),
    staleTime: CACHE_TIMES.hotList,
  });
  const isInitialLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const hasHardError = dashboardQuery.isError && !dashboardQuery.data;
  const hasPermissionError =
    dashboardQuery.isError && isRepairDeskAuthorizationError(dashboardQuery.error);
  const hasStaleData =
    dashboardQuery.isError && Boolean(dashboardQuery.data) && !hasPermissionError;

  return (
    <RepairOsListScaffold
      title="概览"
      subtitle={
        isInitialLoading
          ? "正在生成处理顺序"
          : hasPermissionError
            ? "优先队列无权查看"
            : hasHardError
              ? "优先队列暂不可用"
              : dashboardQuery.data?.coverage === "assigned"
                ? "按优先级显示我的下一步"
                : "按优先级显示全店下一步"
      }
      eyebrow="工作台 / 概览"
      desktopAction={<DashboardDesktopQuickStart />}
    >
      <div className="min-w-0 space-y-3">
        <DashboardMobileQuickStart />
        <DashboardPriorityWorkspace
          summary={dashboardQuery.data}
          isLoading={isInitialLoading}
          hasHardError={hasHardError}
          hasPermissionError={hasPermissionError}
          hasStaleData={hasStaleData}
          onRetry={() => {
            void dashboardQuery.refetch();
          }}
        />
      </div>
    </RepairOsListScaffold>
  );
}
