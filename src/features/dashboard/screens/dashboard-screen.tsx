"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  DashboardDesktopQuickStart,
  DashboardMobileQuickStart,
} from "@/features/dashboard/components/dashboard-quick-start";
import { DashboardPriorityWorkspace } from "@/features/dashboard/components/dashboard-priority-workspace";
import { NewOrderDialog } from "@/features/orders/components/new-order-dialog";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { CACHE_TIMES } from "@/lib/query-performance";
import { getDashboardSummary, isRepairDeskAuthorizationError } from "@/lib/repairdesk/api";
import { RepairOsListScaffold } from "@/shared/ui";

const dashboardSummaryInput = { limit: 20 } as const;

export function DashboardScreen() {
  const router = useRouter();
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderSessionKey, setNewOrderSessionKey] = useState(0);
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const dashboardQuery = useQuery({
    queryKey: ordersKeys.dashboardSummary(dashboardSummaryInput, activeStoreId),
    queryFn: ({ signal }) => getDashboardSummary(dashboardSummaryInput, { signal }),
    enabled: Boolean(activeStoreId),
    staleTime: CACHE_TIMES.hotList,
  });
  const isInitialLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const hasHardError = dashboardQuery.isError && !dashboardQuery.data;
  const hasPermissionError =
    dashboardQuery.isError && isRepairDeskAuthorizationError(dashboardQuery.error);
  const hasStaleData =
    dashboardQuery.isError && Boolean(dashboardQuery.data) && !hasPermissionError;
  const openNewOrder = useCallback(() => {
    setNewOrderSessionKey((current) => current + 1);
    setNewOrderOpen(true);
  }, []);
  const handleNewOrderCreated = useCallback(
    (id: string) => {
      setNewOrderOpen(false);
      router.push(buildOrderDetailWorkspaceHref(id, { source: "dashboard" }));
    },
    [router],
  );

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
      desktopAction={<DashboardDesktopQuickStart onCreateOrder={openNewOrder} />}
    >
      <div className="min-w-0 space-y-3">
        <DashboardMobileQuickStart onCreateOrder={openNewOrder} />
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
      <NewOrderDialog
        open={newOrderOpen}
        sessionKey={newOrderSessionKey}
        onOpenChange={setNewOrderOpen}
        onCreated={handleNewOrderCreated}
      />
    </RepairOsListScaffold>
  );
}
