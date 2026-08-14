"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type {
  InventoryLifecycleCommand,
  InventoryLifecycleSaleDetail,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

import { inventoryLifecycleKeys } from "../api/query-keys";
import { inventoryLifecycleSaleQueryOptions } from "../api/query-options";
import { InventoryLifecyclePageShell } from "../components/inventory-lifecycle-page-shell";
import { InventoryLifecycleSaleWorkspace } from "../components/inventory-lifecycle-workspaces";
import {
  InventoryLifecycleStatusBadge,
  InventoryLifecycleUnavailableCard,
} from "../components/inventory-lifecycle-status";
import { InventoryLifecycleReservationScreen } from "./inventory-lifecycle-reservation-screen";
import {
  getInventoryConflictDetails,
  InventoryConflictPanel,
  type InventoryConflictDetails,
} from "../../components/inventory-conflict-panel";
import {
  InventorySyncStatusPanel,
  type InventorySyncStatus,
} from "../../components/inventory-sync-status-panel";
import { InventoryOperationErrorPanel } from "../../components/inventory-operation-error-panel";
import {
  classifyInventoryOperationError,
  type InventoryOperationErrorDetails,
  type InventoryOperationVerificationStatus,
} from "../../model/inventory-operation-error";
import { InventoryOperationReceiptPanel } from "../../components/inventory-operation-receipt-panel";
import {
  resolveInventoryOperationReceipt,
  type InventoryOperationReceipt,
} from "../../model/inventory-operation-receipt";
import { InventoryReadFreshnessPanel } from "../../components/inventory-read-freshness-panel";
import { InventoryAvailabilityStateCard } from "../../components/inventory-availability-state-card";
import {
  inventoryReadFreshnessBlocksWrites,
  resolveInventoryReadFreshness,
  type InventoryReadFreshnessVerification,
} from "../../model/inventory-read-freshness";
import { resolveInventoryAvailability } from "../../model/inventory-availability";
import { InventoryNoActionGuidanceCard } from "../../components/inventory-no-action-guidance-card";
import { resolveInventoryNoActionGuidance } from "../../model/inventory-no-action-guidance";
import {
  AfterSalesIntakePanel,
  CancelPanel,
  CompleteSalePanel,
  InventoryLifecycleSaleMoneyOverview,
  InventoryLifecycleSalePaymentPanel,
  InventoryLifecycleSalePickupPanel,
  WarrantyPanel,
  type InventoryLifecycleSaleSubmit,
} from "../components/inventory-lifecycle-sale-panels";

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

const methods = [
  ["cash", "现金"],
  ["card", "银行卡"],
  ["bancomat", "Bancomat"],
  ["transfer", "转账"],
  ["other", "其他"],
] as const;

export function InventoryLifecycleItemSaleScreen({ itemId }: { itemId: string }) {
  return <InventoryLifecycleReservationScreen itemId={itemId} mode="sale" />;
}

export function InventoryLifecycleSaleScreen({ saleOrderId }: { saleOrderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const enabled = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const currentSaleKey = `${storeId ?? ""}:${saleOrderId}`;
  const query = useQuery({
    ...inventoryLifecycleSaleQueryOptions(saleOrderId, storeId),
    enabled,
  });
  const [lastSaleSnapshot, setLastSaleSnapshot] = useState<
    { key: string; data: InventoryLifecycleSaleDetail; readAt: number } | undefined
  >();
  const previousSaleKeyRef = useRef(currentSaleKey);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [operationReceipt, setOperationReceipt] = useState<InventoryOperationReceipt | null>(null);
  const [operationReceiptKey, setOperationReceiptKey] = useState(0);
  const idempotencyKeys = useRef(new Map<InventoryLifecycleCommand, string>());
  const lastCommandRef = useRef<InventoryLifecycleCommand | undefined>(undefined);
  const [conflict, setConflict] = useState<InventoryConflictDetails | null>(null);
  const [isRecoveringConflict, setIsRecoveringConflict] = useState(false);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus>();
  const [operationError, setOperationError] = useState<InventoryOperationErrorDetails | null>(null);
  const [operationVerification, setOperationVerification] =
    useState<InventoryOperationVerificationStatus>("idle");
  const [operationAcknowledged, setOperationAcknowledged] = useState(false);
  const [freshnessVerification, setFreshnessVerification] =
    useState<InventoryReadFreshnessVerification>("idle");
  const [availabilityRetrying, setAvailabilityRetrying] = useState(false);
  const syncBlocked = Boolean(syncStatus && syncStatus !== "recovered");
  const availability = resolveInventoryAvailability({
    shellLoading: shell.isLoading,
    hasPermission: shell.permissions?.canReadInventory === true,
    featureEnabled: shell.permissions?.inventoryLifecycleUiEnabled === true,
    queryState: query.isError
      ? "error"
      : query.isLoading
        ? "loading"
        : query.isSuccess
          ? "success"
          : "idle",
    hasData: Boolean(query.data),
    isRetrying: availabilityRetrying,
    error: query.error,
  });
  const retryAvailability = async () => {
    if (availabilityRetrying) return;
    setAvailabilityRetrying(true);
    try {
      await query.refetch();
    } finally {
      setAvailabilityRetrying(false);
    }
  };
  const mutation = useMutation({
    mutationFn: runInventoryLifecycleCommand,
    onSuccess: (result, input) => {
      idempotencyKeys.current.delete(input.command);
      lastCommandRef.current = undefined;
      setConflict(null);
      setOperationError(null);
      setOperationVerification("idle");
      setOperationAcknowledged(false);
      setRecoveryMessage("");
      setOperationReceipt(resolveInventoryOperationReceipt(input.command, result));
      setOperationReceiptKey((current) => current + 1);
      void syncCommittedSale();
    },
    onError: (error) => {
      const nextConflict = getInventoryConflictDetails(error);
      setConflict(nextConflict);
      setOperationError(nextConflict ? null : classifyInventoryOperationError(error));
      setOperationReceipt(null);
      setOperationVerification("idle");
      setOperationAcknowledged(false);
      if (nextConflict?.kind === "idempotency" && lastCommandRef.current) {
        idempotencyKeys.current.delete(lastCommandRef.current);
      }
    },
  });
  useEffect(() => {
    if (previousSaleKeyRef.current === currentSaleKey) return;
    previousSaleKeyRef.current = currentSaleKey;
    setLastSaleSnapshot(undefined);
    setSyncStatus(undefined);
    setConflict(null);
    setOperationError(null);
    setOperationReceipt(null);
    setRecoveryMessage("");
    setFreshnessVerification("idle");
    setOperationVerification("idle");
    setOperationAcknowledged(false);
    mutation.reset();
  }, [currentSaleKey, mutation]);
  useEffect(() => {
    if (!query.isSuccess || !query.data || previousSaleKeyRef.current !== currentSaleKey) return;
    const data = query.data;
    setLastSaleSnapshot({ key: currentSaleKey, data, readAt: Date.now() });
  }, [currentSaleKey, query.data, query.isSuccess]);
  const syncCommittedSale = async () => {
    setSyncStatus("committed-refreshing");
    try {
      await queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("无法读取最新销售账");
      setSyncStatus("recovered");
    } catch {
      setSyncStatus("committed-refresh-failed");
    }
  };
  const verifyOperation = async () => {
    if (operationVerification === "verifying") return;
    setOperationAcknowledged(false);
    setOperationVerification("verifying");
    try {
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("sale-readback-unavailable");
      mutation.reset();
      setOperationVerification("verified");
    } catch {
      setOperationVerification("failed");
    }
  };
  const submitCommand: InventoryLifecycleSaleSubmit = (commandName, payload) => {
    if (
      syncBlocked ||
      operationWriteBlocked ||
      staleReadBlocked ||
      conflict ||
      isRecoveringConflict
    )
      return;
    const existingKey = idempotencyKeys.current.get(commandName);
    const idempotencyKey = existingKey ?? crypto.randomUUID();
    idempotencyKeys.current.set(commandName, idempotencyKey);
    lastCommandRef.current = commandName;
    setConflict(null);
    setOperationError(null);
    setOperationVerification("idle");
    setOperationAcknowledged(false);
    setSyncStatus(undefined);
    setFreshnessVerification("idle");
    mutation.mutate({ command: commandName, idempotency_key: idempotencyKey, payload });
  };

  const recoverConflict = async () => {
    if (isRecoveringConflict) return;
    setIsRecoveringConflict(true);
    if (lastCommandRef.current) idempotencyKeys.current.delete(lastCommandRef.current);
    lastCommandRef.current = undefined;
    mutation.reset();
    try {
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("无法读取最新销售账");
      setConflict(null);
      setRecoveryMessage("已读取最新销售账；没有自动重放刚才的写入，请重新核对可用动作。");
    } finally {
      setIsRecoveringConflict(false);
    }
  };

  if (!enabled) {
    return (
      <InventoryLifecyclePageShell
        title="销售与取走"
        context="商品生命周期"
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard
          availability={availability}
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  }
  if (query.isLoading) {
    return (
      <InventoryLifecyclePageShell
        title="销售与取走"
        context="正在读取业务账"
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard availability={availability} />
      </InventoryLifecyclePageShell>
    );
  }
  const snapshot =
    syncBlocked && lastSaleSnapshot?.key === currentSaleKey ? lastSaleSnapshot.data : undefined;
  const keyAligned = previousSaleKeyRef.current === currentSaleKey;
  const sale = keyAligned ? (query.data ?? snapshot) : undefined;
  if (!sale || (query.isError && !query.data && !snapshot)) {
    return (
      <InventoryLifecyclePageShell
        title="销售与取走"
        context="业务账不可用"
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard
          availability={availability}
          onRetry={availability.retryable ? retryAvailability : undefined}
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  }
  const operationWriteBlocked =
    operationError?.kind === "outcome-unknown" &&
    (operationVerification !== "verified" || !operationAcknowledged);
  const freshness = resolveInventoryReadFreshness({
    hasData: Boolean(sale),
    keyMatches: keyAligned,
    queryState: query.isError
      ? "error"
      : query.isLoading
        ? "loading"
        : query.isSuccess
          ? "success"
          : "idle",
    verification: freshnessVerification,
    lastSuccessAt: lastSaleSnapshot?.key === currentSaleKey ? lastSaleSnapshot.readAt : undefined,
    // A cached payload remains read-only even while another recovery panel is
    // visible; a later query error must re-lock writes after acknowledgement.
    suppressStaleGuard: false,
  });
  const staleReadBlocked = inventoryReadFreshnessBlocksWrites(freshness);
  const verifyFreshness = async () => {
    if (freshnessVerification === "verifying") return;
    setFreshnessVerification("verifying");
    try {
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("sale-readback-unavailable");
      setFreshnessVerification("recovered");
    } catch {
      setFreshnessVerification("failed");
    }
  };
  const writeBlocked =
    syncBlocked ||
    operationWriteBlocked ||
    staleReadBlocked ||
    Boolean(conflict) ||
    isRecoveringConflict;
  const primaryAction = [
    "payment.append",
    "sale.complete",
    "pickup.confirm",
    "after_sales.create",
    "warranty.adjust",
  ].find((action) => sale.allowed_actions.includes(action as InventoryLifecycleCommand));
  const secondaryActions = sale.allowed_actions.filter(
    (action) =>
      action !== primaryAction && ["reservation.cancel", "warranty.adjust"].includes(action),
  );
  const noActionGuidance = resolveInventoryNoActionGuidance({
    hasData: true,
    projectionMode: sale.projection?.mode ?? "compatible",
    projection: sale.projection,
    status: sale.status,
    allowedActions: sale.allowed_actions,
  });
  return (
    <InventoryLifecycleSaleWorkspace
      title={sale.status === "reserved" ? "预订与收款" : "销售与取走"}
      context={`${sale.sku} · 业务单 ${shortId(sale.sale_order_id)}`}
      status={<InventoryLifecycleStatusBadge status={sale.business_status} />}
      onBack={() => router.push(`/inventory/${encodeURIComponent(sale.inventory_item_id)}`)}
    >
      <InventoryLifecycleSaleMoneyOverview sale={sale} />
      {recoveryMessage ? (
        <p
          className="rounded-xl bg-status-success px-3 py-2 text-xs text-status-success-foreground"
          role="status"
          aria-live="polite"
        >
          {recoveryMessage}
        </p>
      ) : null}
      {operationReceipt ? (
        <InventoryOperationReceiptPanel
          receipt={operationReceipt}
          receiptKey={operationReceiptKey}
        />
      ) : null}
      {!freshness.hidden ? (
        <InventoryReadFreshnessPanel freshness={freshness} onVerify={verifyFreshness} />
      ) : null}
      {syncStatus ? (
        <InventorySyncStatusPanel
          status={syncStatus}
          pending={syncStatus === "committed-refreshing"}
          onRetry={syncStatus === "committed-refresh-failed" ? syncCommittedSale : undefined}
        />
      ) : null}
      {conflict ? (
        <InventoryConflictPanel
          conflict={conflict}
          onRecover={recoverConflict}
          pending={isRecoveringConflict}
        />
      ) : null}
      {operationError ? (
        <InventoryOperationErrorPanel
          error={operationError}
          verificationStatus={operationVerification}
          acknowledged={operationAcknowledged}
          onAcknowledge={() => {
            setOperationAcknowledged(true);
            setOperationError(null);
            setRecoveryMessage("已确认只读核对结果；没有自动重放写入。");
          }}
          onVerify={operationError.kind === "outcome-unknown" ? verifyOperation : undefined}
        />
      ) : null}
      <div className="grid gap-2">
        {primaryAction === "payment.append" ? (
          <InventoryLifecycleSalePaymentPanel
            sale={sale}
            pending={mutation.isPending}
            writeBlocked={writeBlocked}
            submit={submitCommand}
          />
        ) : null}
        {primaryAction === "sale.complete" ? (
          <CompleteSalePanel
            sale={sale}
            pending={mutation.isPending}
            writeBlocked={writeBlocked}
            submit={submitCommand}
          />
        ) : null}
        {primaryAction === "pickup.confirm" ? (
          <InventoryLifecycleSalePickupPanel
            sale={sale}
            pending={mutation.isPending}
            writeBlocked={writeBlocked}
            submit={submitCommand}
          />
        ) : null}
        {primaryAction === "warranty.adjust" ? (
          <WarrantyPanel
            sale={sale}
            pending={mutation.isPending}
            writeBlocked={writeBlocked}
            submit={submitCommand}
          />
        ) : null}
        {primaryAction === "after_sales.create" ? (
          <AfterSalesIntakePanel
            sale={sale}
            pending={mutation.isPending}
            writeBlocked={writeBlocked}
            submit={submitCommand}
          />
        ) : null}
      </div>
      {secondaryActions.length ? (
        <details className={cn(repairOs.mobileInfoCard, "p-3 sm:p-4")}>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
            更多管理操作
          </summary>
          <div className="mt-2 grid gap-2">
            {secondaryActions.includes("warranty.adjust") ? (
              <WarrantyPanel
                sale={sale}
                pending={mutation.isPending}
                writeBlocked={writeBlocked}
                submit={submitCommand}
              />
            ) : null}
            {secondaryActions.includes("reservation.cancel") ? (
              <CancelPanel
                sale={sale}
                pending={mutation.isPending}
                writeBlocked={writeBlocked}
                submit={submitCommand}
              />
            ) : null}
          </div>
        </details>
      ) : null}
      {noActionGuidance ? <InventoryNoActionGuidanceCard guidance={noActionGuidance} /> : null}
    </InventoryLifecycleSaleWorkspace>
  );
}
