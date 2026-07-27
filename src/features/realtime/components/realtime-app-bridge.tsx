"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { RepairDeskRealtimeClient } from "@/features/realtime/api/realtime-client";
import type { RepairDeskRealtimeDomain } from "@/features/realtime/model/realtime-events";
import { repairDeskRealtimeDomains } from "@/features/realtime/model/realtime-events";
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
  const resolvedDomains = useMemo(() => {
    if (domains) return domains;
    const base = repairDeskRealtimeDomains.filter((domain) => domain !== "memos");
    return pathname?.startsWith("/memos") && shell.permissions?.canReadMemos
      ? [...base, "memos" as const]
      : base;
  }, [domains, pathname, shell.permissions?.canReadMemos]);
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
      domains={resolvedDomains}
      enabled={enabled}
      foregroundReconcileDomains={getRepairDeskForegroundReconcileDomains(
        pathname,
        shell.permissions?.canReadMemos === true,
      )}
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
  canReadMemos = false,
): readonly RepairDeskRealtimeDomain[] {
  if (pathname === "/orders" || pathname?.startsWith("/orders/")) return ["orders"];
  if (canReadMemos && (pathname === "/memos" || pathname?.startsWith("/memos/"))) return ["memos"];
  return [];
}
