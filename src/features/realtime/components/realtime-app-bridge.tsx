"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import type { RepairDeskRealtimeClient } from "@/features/realtime/api/realtime-client";
import type { RepairDeskRealtimeDomain } from "@/features/realtime/model/realtime-events";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";

import { RealtimeSyncProvider } from "./realtime-sync-provider";

export type RealtimeAppBridgeProps = {
  children?: ReactNode;
  client?: RepairDeskRealtimeClient;
  domains?: readonly RepairDeskRealtimeDomain[];
  enabled?: boolean;
};

export function RealtimeAppBridge({
  children = null,
  client,
  domains,
  enabled,
}: RealtimeAppBridgeProps) {
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
    <RealtimeSyncProvider client={client} domains={domains} enabled={enabled} storeId={storeId}>
      <Fragment key={authorityBoundaryKey}>{children}</Fragment>
    </RealtimeSyncProvider>
  );
}
