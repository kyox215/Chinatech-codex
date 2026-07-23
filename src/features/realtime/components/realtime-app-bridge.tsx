"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { RepairDeskRealtimeClient } from "@/features/realtime/api/realtime-client";
import type { RepairDeskRealtimeDomain } from "@/features/realtime/model/realtime-events";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";

import { RealtimeSyncProvider } from "./realtime-sync-provider";

export type RealtimeAppBridgeProps = {
  children?: ReactNode;
  client?: RepairDeskRealtimeClient;
  domains?: readonly RepairDeskRealtimeDomain[];
  enabled?: boolean;
  revisionCheckEnabled?: boolean;
};

export function RealtimeAppBridge({
  children = null,
  client,
  domains,
  enabled,
  revisionCheckEnabled,
}: RealtimeAppBridgeProps) {
  const pathname = usePathname();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.status === "active" ? shell.activeStore.id : null;
  const [authorityBoundaryKey, setAuthorityBoundaryKey] = useState("authority-bootstrap");
  const stableAuthorityFingerprintRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (shell.isLoading || shell.isRefreshing) return;

    const previousFingerprint = stableAuthorityFingerprintRef.current;
    stableAuthorityFingerprintRef.current = shell.authorityFingerprint;
    if (!previousFingerprint || previousFingerprint === shell.authorityFingerprint) return;

    setAuthorityBoundaryKey(shell.authorityFingerprint);
  }, [shell.authorityFingerprint, shell.isLoading, shell.isRefreshing]);

  return (
    <RealtimeSyncProvider
      client={client}
      domains={domains}
      enabled={enabled}
      foregroundReconcileDomains={getRepairDeskForegroundReconcileDomains(pathname)}
      revisionCheckEnabled={
        revisionCheckEnabled ?? process.env.NEXT_PUBLIC_REPAIRDESK_REVISION_CHECK_ENABLED === "1"
      }
      storeId={storeId}
    >
      <Fragment key={authorityBoundaryKey}>{children}</Fragment>
    </RealtimeSyncProvider>
  );
}

export function getRepairDeskForegroundReconcileDomains(
  pathname?: string | null,
): readonly RepairDeskRealtimeDomain[] {
  return pathname === "/orders" || pathname?.startsWith("/orders/") ? ["orders"] : [];
}
