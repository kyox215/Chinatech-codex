"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { customerListPageQueryOptions } from "@/features/customers/api";
import { inventorySummaryQueryOptions } from "@/features/inventory";
import { storeSettingsQueryOptions } from "@/features/messages";
import { orderListPageQueryOptions, orderWorkflowQueryOptions } from "@/features/orders/api";
import { useRealtimeSync } from "@/features/realtime";
import { CACHE_TIMES } from "@/lib/query-performance";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";

import {
  getRepairDeskPreloadTargets,
  isRepairDeskPreloadEnabled,
  isRepairDeskPreloadTargetOwnedByWorkspaceHome,
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
  const shell = useStoreShellContext();
  const canReadInventory = Boolean(shell.permissions?.canReadInventory);
  const canReadStoreSettings = shell.permissions?.canReadStoreSettings === true;

  useEffect(() => {
    if (
      !isRepairDeskPreloadEnabled() ||
      !coordinator ||
      !storeId ||
      shell.isRefreshing ||
      !navigator.onLine
    ) {
      return;
    }

    const connection = (navigator as NavigatorWithConnection).connection;
    const constrainedNetwork =
      Boolean(connection?.saveData) ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g";
    const currentPathname = window.location.pathname || pathname;
    const targets = getRepairDeskPreloadTargets(pathname, constrainedNetwork).filter(
      (target) =>
        !isRepairDeskPreloadTargetOwnedByWorkspaceHome(currentPathname, target) &&
        (target !== "inventory" || canReadInventory) &&
        (target !== "settings" || canReadStoreSettings),
    );
    let cancelled = false;

    const runTarget = (target: RepairDeskPreloadTarget) => {
      if (target === "orders") {
        const options = orderListPageQueryOptions(undefined, storeId);
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
      if (
        cancelled ||
        isRepairDeskPreloadTargetOwnedByWorkspaceHome(window.location.pathname, target)
      ) {
        return;
      }
      await runTarget(target);
    });

    const idleWindow = window as WindowWithIdleCallback;
    let idleHandle: number | undefined;
    let secondaryTimeoutHandle: number | undefined;

    const runSecondary = async () => {
      if (cancelled) return;
      await runRepairDeskPreloadQueue(tasks.slice(2), 2);
    };
    const scheduleSecondary = () => {
      if (cancelled) return;
      idleHandle = idleWindow.requestIdleCallback?.(() => void runSecondary(), { timeout: 1_000 });
      if (idleHandle === undefined) {
        secondaryTimeoutHandle = window.setTimeout(() => void runSecondary(), 200);
      }
    };
    const criticalTimeoutHandle = window.setTimeout(() => {
      void runRepairDeskPreloadQueue(tasks.slice(0, 2), 2).then(scheduleSecondary);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(criticalTimeoutHandle);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (secondaryTimeoutHandle !== undefined) window.clearTimeout(secondaryTimeoutHandle);
    };
  }, [canReadInventory, canReadStoreSettings, coordinator, pathname, shell.isRefreshing, storeId]);

  return children;
}
