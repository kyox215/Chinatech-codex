"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { customersKeys } from "@/features/customers/api/query-keys";
import { createRepairDeskIndexedDbOfflineStore } from "@/features/offline/model/offline-indexeddb-store";
import {
  buildRepairDeskOfflineOrderCreateSyncInput,
  classifyRepairDeskOfflineOrderSyncError,
} from "@/features/offline/model/offline-order-sync-adapter";
import { createRepairDeskOfflineOutboxSyncRunner } from "@/features/offline/model/offline-outbox-sync-runner";
import { isRepairDeskOfflineSyncEnabled } from "@/features/offline/model/offline-sync-feature";
import type { RepairDeskOfflineResult } from "@/features/offline/model/offline-types";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { getOnboardingStatus, syncOfflineOrderCreate } from "@/lib/repairdesk/api";
import { toast } from "sonner";

export function OfflineOutboxSyncBridge() {
  const shell = useStoreShellContext();
  const queryClient = useQueryClient();
  const syncEnabled = isRepairDeskOfflineSyncEnabled();
  const scope = useMemo(
    () =>
      shell.userId && shell.activeStore?.id
        ? { storeId: shell.activeStore.id, userId: shell.userId }
        : null,
    [shell.activeStore?.id, shell.userId],
  );
  const runner = useMemo(() => {
    if (!scope || typeof window === "undefined") return null;
    const store = createRepairDeskIndexedDbOfflineStore({ scope });
    return createRepairDeskOfflineOutboxSyncRunner({
      store,
      scope,
      enabled: syncEnabled,
      checkApiHealth: async () => {
        if (!navigator.onLine) {
          return success({ online: false, authenticated: false });
        }
        try {
          const status = await getOnboardingStatus({ timeoutMs: 10_000 });
          return success({ online: true, authenticated: Boolean(status.userId) });
        } catch {
          return success({ online: navigator.onLine, authenticated: false });
        }
      },
      getCurrentScope: async () => {
        try {
          const status = await getOnboardingStatus({ timeoutMs: 10_000 });
          return success(
            status.userId && status.activeStore?.id
              ? { storeId: status.activeStore.id, userId: status.userId }
              : null,
          );
        } catch {
          return success(null);
        }
      },
      syncOrder: async (entry) => {
        if (entry.action !== "create") return { status: "blocked" };
        try {
          return await syncOfflineOrderCreate(buildRepairDeskOfflineOrderCreateSyncInput(entry));
        } catch (error) {
          return classifyRepairDeskOfflineOrderSyncError(error);
        }
      },
    });
  }, [scope, syncEnabled]);

  const runOnce = useCallback(async () => {
    if (!runner) return;
    const result = await runner.runOnce();
    if (!result.ok) return;
    if (result.value.blockedCount > 0) {
      toast.warning("有离线工单需要人工检查后再同步");
    } else if (result.value.failedCount > 0) {
      toast.warning("有离线工单暂未同步，系统会在联网后重试");
    }
    if (result.value.syncedCount === 0) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
      queryClient.invalidateQueries({ queryKey: customersKeys.all }),
    ]);
  }, [queryClient, runner]);

  useEffect(() => {
    if (!runner || !syncEnabled) return;
    void runOnce();
    const handleOnline = () => void runOnce();
    window.addEventListener("online", handleOnline);
    const intervalId = window.setInterval(() => {
      if (navigator.onLine) void runOnce();
    }, 60_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(intervalId);
    };
  }, [runOnce, runner, syncEnabled]);

  return null;
}

function success<T>(value: T): RepairDeskOfflineResult<T> {
  return { ok: true, value };
}
