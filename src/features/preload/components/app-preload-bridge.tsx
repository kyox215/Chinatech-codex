"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { customerListPageQueryOptions } from "@/features/customers/api";
import { inventorySummaryQueryOptions } from "@/features/inventory";
import { storeSettingsQueryOptions } from "@/features/messages";
import { orderQueueSummaryQueryOptions, orderWorkflowQueryOptions } from "@/features/orders/api";
import { useRealtimeSync } from "@/features/realtime";
import { CACHE_TIMES } from "@/lib/query-performance";

import {
  getRepairDeskPreloadTargets,
  isRepairDeskPreloadEnabled,
  runRepairDeskPreloadQueue,
  type RepairDeskPreloadTarget,
} from "../model/preload-plan";

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

type WindowWithIdleCallback = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

export function AppPreloadBridge({ children = null }: { children?: ReactNode }) {
  const pathname = usePathname();
  const { coordinator, storeId } = useRealtimeSync();

  useEffect(() => {
    if (!isRepairDeskPreloadEnabled() || !coordinator || !storeId || !navigator.onLine) return;

    const connection = (navigator as NavigatorWithConnection).connection;
    const constrainedNetwork =
      Boolean(connection?.saveData) ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g";
    const targets = getRepairDeskPreloadTargets(pathname, constrainedNetwork);
    let cancelled = false;

    const runTarget = (target: RepairDeskPreloadTarget) => {
      if (target === "orders") {
        const options = orderQueueSummaryQueryOptions(undefined, storeId);
        return coordinator.prefetch({
          group: "orders.all",
          queryKey: options.queryKey,
          queryFn: options.queryFn!,
          staleTime: CACHE_TIMES.hotList,
        });
      }
      if (target === "workflow") {
        const options = orderWorkflowQueryOptions(storeId);
        return coordinator.prefetch({
          group: "orders.workflow",
          queryKey: options.queryKey,
          queryFn: options.queryFn!,
          staleTime: CACHE_TIMES.workflow,
        });
      }
      if (target === "settings") {
        const options = storeSettingsQueryOptions(storeId);
        return coordinator.prefetch({
          group: "settings.store",
          queryKey: options.queryKey,
          queryFn: options.queryFn!,
          staleTime: CACHE_TIMES.settings,
        });
      }
      if (target === "customers") {
        const options = customerListPageQueryOptions(undefined, storeId);
        return coordinator.prefetch({
          group: "customers.all",
          queryKey: options.queryKey,
          queryFn: options.queryFn!,
          staleTime: CACHE_TIMES.hotList,
        });
      }
      const options = inventorySummaryQueryOptions(undefined, storeId);
      return coordinator.prefetch({
        group: "inventory.all",
        queryKey: options.queryKey,
        queryFn: options.queryFn!,
        staleTime: CACHE_TIMES.hotList,
      });
    };

    const tasks = targets.map((target: RepairDeskPreloadTarget) => async () => {
      if (cancelled) return;
      await runTarget(target);
    });

    const run = () => {
      if (!cancelled) void runRepairDeskPreloadQueue(tasks, 2);
    };
    const idleWindow = window as WindowWithIdleCallback;
    const idleHandle = idleWindow.requestIdleCallback?.(run, { timeout: 1_500 });
    const timeoutHandle = idleHandle === undefined ? window.setTimeout(run, 350) : undefined;

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, [coordinator, pathname, storeId]);

  return children;
}
