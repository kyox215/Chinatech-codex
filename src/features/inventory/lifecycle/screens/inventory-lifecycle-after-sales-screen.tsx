"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type {
  InventoryAfterSalesStatus,
  InventoryLifecycleAfterSalesCaseDetail,
} from "@/lib/repairdesk/types";

import { inventoryLifecycleKeys } from "../api/query-keys";
import {
  inventoryLifecycleAfterSalesCaseQueryOptions,
  inventoryLifecycleAfterSalesQueryOptions,
} from "../api/query-options";
import { InventoryLifecyclePageShell } from "../components/inventory-lifecycle-page-shell";
import {
  InventoryAfterSalesCaseWorkspace,
  InventoryAfterSalesCaseEditor,
  InventoryAfterSalesCaseOverview,
  InventoryAfterSalesQueueBody,
} from "../components/inventory-lifecycle-workspaces";
import { InventoryLifecycleUnavailableCard } from "../components/inventory-lifecycle-status";
import type { InventoryLifecycleValidationIssue } from "../components/inventory-lifecycle-field-feedback";
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
import {
  inventoryReadFreshnessBlocksWrites,
  resolveInventoryReadFreshness,
  type InventoryReadFreshnessVerification,
} from "../../model/inventory-read-freshness";
import { InventoryAvailabilityStateCard } from "../../components/inventory-availability-state-card";
import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import { resolveInventoryAvailability } from "../../model/inventory-availability";
import { InventoryNoActionGuidanceCard } from "../../components/inventory-no-action-guidance-card";
import { resolveInventoryNoActionGuidance } from "../../model/inventory-no-action-guidance";
import { getInventoryLifecycleAfterSalesNextStatuses } from "../model/projection";
import { InventoryLifecycleTimeline } from "../components/inventory-lifecycle-timeline";
import { resolveInventoryLedgerTimeline } from "../model/inventory-lifecycle-timeline";

const statusCopy = {
  open: "待检测",
  in_progress: "处理中",
  waiting_customer: "等客户",
  returned: "已返还",
  closed: "已关闭",
} as const;

export function InventoryLifecycleAfterSalesQueueScreen() {
  const router = useRouter();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const enabled = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const query = useQuery({ ...inventoryLifecycleAfterSalesQueryOptions(storeId), enabled });
  const [availabilityRetrying, setAvailabilityRetrying] = useState(false);
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

  if (!enabled) {
    return (
      <InventoryLifecyclePageShell
        title="售后队列"
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
        title="售后队列"
        context="正在读取售后队列"
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard availability={availability} />
      </InventoryLifecyclePageShell>
    );
  }
  if (query.isError && !query.data) {
    return (
      <InventoryLifecyclePageShell
        title="售后队列"
        context="队列不可用"
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
  return (
    <InventoryLifecyclePageShell
      title="售后队列"
      context="返修、保修判断与返还"
      onBack={() => router.push("/inventory")}
    >
      <InventoryAfterSalesQueueBody
        items={query.data ?? []}
        onOpen={(item) => router.push(`/inventory/after-sales/${encodeURIComponent(item.case_id)}`)}
      />
    </InventoryLifecyclePageShell>
  );
}

export function InventoryLifecycleAfterSalesCaseScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext({ monitorAuthority: true });
  const storeId = shell.activeStore?.id;
  const enabled = Boolean(
    storeId &&
    shell.permissions?.canReadInventory &&
    shell.permissions.inventoryLifecycleUiEnabled === true,
  );
  const currentAfterSalesKey = `${storeId ?? ""}:${caseId}`;
  const query = useQuery({
    ...inventoryLifecycleAfterSalesCaseQueryOptions(caseId, storeId),
    enabled,
  });
  const [lastAfterSalesSnapshot, setLastAfterSalesSnapshot] = useState<
    { key: string; data: InventoryLifecycleAfterSalesCaseDetail; readAt: number } | undefined
  >();
  const previousAfterSalesKeyRef = useRef(currentAfterSalesKey);
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnosisError, setDiagnosisError] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [coverage, setCoverage] = useState("pending");
  const [status, setStatus] = useState<InventoryAfterSalesStatus>("in_progress");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [operationReceipt, setOperationReceipt] = useState<InventoryOperationReceipt | null>(null);
  const [operationReceiptKey, setOperationReceiptKey] = useState(0);
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
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const closeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const syncBlocked = Boolean(syncStatus && syncStatus !== "recovered");
  const idempotencyKey = useRef(crypto.randomUUID());
  const afterSalesBaselineRef = useRef<
    | {
        key: string;
        version: number;
        diagnosis: string;
        status: InventoryAfterSalesStatus;
        coverage: string;
      }
    | undefined
  >(undefined);
  const selfCommitReadbackRef = useRef<
    | {
        key: string;
        previousVersion: number;
        expectedVersion?: number;
      }
    | undefined
  >(undefined);
  const draftValuesRef = useRef({ diagnosis, status, coverage });
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
      selfCommitReadbackRef.current = {
        key: currentAfterSalesKey,
        previousVersion: afterSalesBaselineRef.current?.version ?? query.data?.version ?? 0,
        expectedVersion: result.case_version ?? result.version,
      };
      idempotencyKey.current = crypto.randomUUID();
      setConflict(null);
      setOperationError(null);
      setOperationVerification("idle");
      setOperationAcknowledged(false);
      setFreshnessVerification("idle");
      setRecoveryMessage("");
      setOperationReceipt(resolveInventoryOperationReceipt(input.command, result));
      setOperationReceiptKey((current) => current + 1);
      void syncCommittedAfterSales();
    },
    onError: (error) => {
      const nextConflict = getInventoryConflictDetails(error);
      setCloseDialogOpen(false);
      setConflict(nextConflict);
      setOperationError(nextConflict ? null : classifyInventoryOperationError(error));
      setOperationReceipt(null);
      setOperationVerification("idle");
      setOperationAcknowledged(false);
      setCloseDialogOpen(false);
    },
  });
  useEffect(() => {
    if (previousAfterSalesKeyRef.current === currentAfterSalesKey) return;
    previousAfterSalesKeyRef.current = currentAfterSalesKey;
    setLastAfterSalesSnapshot(undefined);
    setSyncStatus(undefined);
    setConflict(null);
    setOperationError(null);
    setOperationReceipt(null);
    setRecoveryMessage("");
    setOperationVerification("idle");
    setOperationAcknowledged(false);
    setFreshnessVerification("idle");
    afterSalesBaselineRef.current = undefined;
    selfCommitReadbackRef.current = undefined;
    mutation.reset();
  }, [currentAfterSalesKey, mutation]);
  useEffect(() => {
    draftValuesRef.current = { diagnosis, status, coverage };
  }, [coverage, diagnosis, status]);
  useEffect(() => {
    if (
      !query.isSuccess ||
      !query.data ||
      previousAfterSalesKeyRef.current !== currentAfterSalesKey
    )
      return;
    const data = query.data;
    setLastAfterSalesSnapshot((previous) =>
      previous?.key === currentAfterSalesKey && previous.data === data
        ? previous
        : { key: currentAfterSalesKey, data, readAt: Date.now() },
    );
  }, [currentAfterSalesKey, query.data, query.isSuccess]);
  const syncCommittedAfterSales = async () => {
    setSyncStatus("committed-refreshing");
    try {
      await queryClient.invalidateQueries({ queryKey: inventoryLifecycleKeys.all });
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("无法读取最新售后案件");
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
      if (!result.isSuccess || !result.data) throw new Error("after-sales-readback-unavailable");
      mutation.reset();
      setOperationVerification("verified");
    } catch {
      setOperationVerification("failed");
    }
  };
  useEffect(() => {
    if (!query.data) return;
    const incoming = {
      key: currentAfterSalesKey,
      version: query.data.version,
      diagnosis: query.data.diagnosis ?? "",
      status: query.data.status,
      coverage: query.data.coverage_decision ?? "pending",
    };
    const baseline = afterSalesBaselineRef.current;
    if (!baseline || baseline.key !== currentAfterSalesKey) {
      afterSalesBaselineRef.current = incoming;
      setStatus(query.data.allowed_next_statuses?.[0] ?? query.data.status);
      setCoverage(incoming.coverage);
      setDiagnosis(incoming.diagnosis);
      return;
    }
    const serverChanged =
      baseline.version !== incoming.version ||
      baseline.diagnosis !== incoming.diagnosis ||
      baseline.status !== incoming.status ||
      baseline.coverage !== incoming.coverage;
    const draftDirty =
      draftValuesRef.current.diagnosis !== baseline.diagnosis ||
      draftValuesRef.current.status !== baseline.status ||
      draftValuesRef.current.coverage !== baseline.coverage;
    const selfCommit = selfCommitReadbackRef.current;
    const selfCommitReadback =
      selfCommit?.key === currentAfterSalesKey &&
      incoming.version > selfCommit.previousVersion &&
      (selfCommit.expectedVersion === undefined || incoming.version >= selfCommit.expectedVersion);
    if (selfCommitReadback) {
      selfCommitReadbackRef.current = undefined;
      afterSalesBaselineRef.current = incoming;
      setStatus(query.data.allowed_next_statuses?.[0] ?? query.data.status);
      setCoverage(incoming.coverage);
      setDiagnosis(incoming.diagnosis);
      setConflict(null);
      return;
    }
    if (serverChanged && draftDirty) {
      setConflict(
        (current) =>
          current ?? {
            status: 409,
            code: "stale_draft",
            kind: "version",
            title: "服务端案件已变化",
            description:
              "本地未保存说明与服务端最新版本存在差异。请加载最新资料后再保存；不会自动覆盖或重放写入。",
          },
      );
      return;
    }
    afterSalesBaselineRef.current = incoming;
    setStatus(query.data.allowed_next_statuses?.[0] ?? query.data.status);
    setCoverage(incoming.coverage);
    setDiagnosis(incoming.diagnosis);
  }, [currentAfterSalesKey, query.data]);
  if (!enabled)
    return (
      <InventoryLifecyclePageShell
        title="售后详情"
        context="商品生命周期"
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard
          availability={availability}
          onBack={() => router.push("/inventory")}
        />
      </InventoryLifecyclePageShell>
    );
  if (query.isLoading)
    return (
      <InventoryLifecyclePageShell
        title="售后详情"
        context="正在读取案件"
        onBack={() => router.push("/inventory/after-sales")}
      >
        <InventoryAvailabilityStateCard availability={availability} />
      </InventoryLifecyclePageShell>
    );
  const snapshot =
    syncBlocked && lastAfterSalesSnapshot?.key === currentAfterSalesKey
      ? lastAfterSalesSnapshot.data
      : undefined;
  const keyAligned = previousAfterSalesKeyRef.current === currentAfterSalesKey;
  const item = keyAligned ? (query.data ?? snapshot) : undefined;
  if (!item || (query.isError && !query.data && !snapshot))
    return (
      <InventoryLifecyclePageShell
        title="售后详情"
        context="案件不可用"
        onBack={() => router.push("/inventory/after-sales")}
      >
        <InventoryAvailabilityStateCard
          availability={availability}
          onRetry={availability.retryable ? retryAvailability : undefined}
          onBack={() => router.push("/inventory/after-sales")}
        />
      </InventoryLifecyclePageShell>
    );
  const nextStatuses =
    item.allowed_next_statuses ?? getInventoryLifecycleAfterSalesNextStatuses(item.status);
  const canUpdate =
    (item.allowed_actions.includes("after_sales.update") ||
      item.allowed_actions.includes("after_sales.close")) &&
    nextStatuses.length > 0;
  const noActionGuidance = resolveInventoryNoActionGuidance({
    hasData: true,
    projectionMode: "compatible",
    status: item.status,
    allowedActions: item.status === "closed" ? [] : item.allowed_actions,
    targetCommand: item.status === "closed" ? undefined : "after_sales.update",
    transitionTargetsAvailable: nextStatuses.length > 0,
  });
  const recoverConflict = async () => {
    if (isRecoveringConflict) return;
    setIsRecoveringConflict(true);
    try {
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("无法读取最新售后案件");
      const latest = result.data;
      afterSalesBaselineRef.current = {
        key: currentAfterSalesKey,
        version: latest.version,
        diagnosis: latest.diagnosis ?? "",
        status: latest.status,
        coverage: latest.coverage_decision ?? "pending",
      };
      setStatus(latest.allowed_next_statuses?.[0] ?? latest.status);
      setCoverage(latest.coverage_decision ?? "pending");
      setDiagnosis(latest.diagnosis ?? "");
      mutation.reset();
      idempotencyKey.current = crypto.randomUUID();
      setConflict(null);
      setRecoveryMessage("已读取最新案件；本地未保存说明按服务端最新值重载，没有自动重放写入。");
    } finally {
      setIsRecoveringConflict(false);
    }
  };
  const operationWriteBlocked =
    operationError?.kind === "outcome-unknown" &&
    (operationVerification !== "verified" || !operationAcknowledged);
  const freshness = resolveInventoryReadFreshness({
    hasData: Boolean(item),
    keyMatches: keyAligned,
    queryState: query.isError
      ? "error"
      : query.isLoading
        ? "loading"
        : query.isSuccess
          ? "success"
          : "idle",
    verification: freshnessVerification,
    lastSuccessAt:
      lastAfterSalesSnapshot?.key === currentAfterSalesKey
        ? lastAfterSalesSnapshot.readAt
        : undefined,
    // Cached case data is read-only after any background read failure; a later
    // query error must re-lock writes even after an outcome is acknowledged.
    suppressStaleGuard: false,
  });
  const staleReadBlocked = inventoryReadFreshnessBlocksWrites(freshness);
  const verifyFreshness = async () => {
    if (freshnessVerification === "verifying") return;
    setFreshnessVerification("verifying");
    try {
      const result = await query.refetch();
      if (!result.isSuccess || !result.data) throw new Error("after-sales-readback-unavailable");
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
  const writePending = mutation.isPending || writeBlocked;
  const validationIssues: InventoryLifecycleValidationIssue[] = diagnosisError
    ? [
        {
          fieldId: "inventory-after-sales-diagnosis",
          label: "检测与处理说明",
          message: diagnosisError,
        },
      ]
    : [];
  const submitLifecycleMutation = () => {
    if (writePending) return;
    if (!diagnosis.trim()) {
      setValidationAttempt((current) => current + 1);
      setDiagnosisError("请补充检测与处理说明。");
      return;
    }
    setDiagnosisError("");
    setOperationReceipt(null);
    setRecoveryMessage("");
    setFreshnessVerification("idle");
    if (status === "closed") setCloseDialogOpen(false);
    mutation.mutate({
      command: status === "closed" ? "after_sales.close" : "after_sales.update",
      idempotency_key: idempotencyKey.current,
      payload: {
        case_id: item.case_id,
        expected_case_version: item.version,
        status,
        diagnosis: diagnosis.trim(),
        coverage_decision: coverage,
        ...(status === "returned" ? { returned_at: new Date().toISOString() } : {}),
      },
    });
  };
  return (
    <InventoryAfterSalesCaseWorkspace
      title="售后详情"
      context={`${item.sku} · ${statusCopy[item.status]}`}
      onBack={() => router.push("/inventory/after-sales")}
      overview={<InventoryAfterSalesCaseOverview item={item} />}
      feedback={
        <>
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
              onRetry={
                syncStatus === "committed-refresh-failed" ? syncCommittedAfterSales : undefined
              }
            />
          ) : null}
          {conflict ? (
            <InventoryConflictPanel
              conflict={conflict}
              onRecover={recoverConflict}
              pending={isRecoveringConflict}
              privacyRedacted={false}
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
        </>
      }
      editor={
        canUpdate ? (
          <InventoryAfterSalesCaseEditor
            status={status}
            nextStatuses={nextStatuses}
            coverage={coverage}
            diagnosis={diagnosis}
            diagnosisError={diagnosisError}
            validationIssues={validationIssues}
            validationAttempt={validationAttempt}
            writePending={writePending}
            mutationPending={mutation.isPending}
            onStatusChange={setStatus}
            onCoverageChange={setCoverage}
            onDiagnosisChange={(value) => {
              setDiagnosis(value);
              setDiagnosisError("");
            }}
            onPrimary={() => {
              if (status === "closed") {
                setCloseDialogOpen(true);
                return;
              }
              submitLifecycleMutation();
            }}
            primaryLabel={
              mutation.isPending
                ? "正在保存…"
                : writeBlocked
                  ? "当前不可写入"
                  : status === "closed"
                    ? "确认关闭案件"
                    : "保存并追加历史"
            }
            closeTriggerRef={closeTriggerRef}
          />
        ) : undefined
      }
      noAction={
        canUpdate ? undefined : noActionGuidance ? (
          <InventoryNoActionGuidanceCard guidance={noActionGuidance} />
        ) : (
          <InventoryLifecycleUnavailableCard
            title="当前案件暂不可推进"
            body="服务端未提供当前目标动作；请只读核对最新案件状态。"
          />
        )
      }
      timeline={
        <InventoryLifecycleTimeline
          source="ledger-event"
          result={resolveInventoryLedgerTimeline(item.events)}
        />
      }
      closeDialog={
        <InventoryConsequenceDialog
          open={closeDialogOpen}
          title="确认关闭售后案件？"
          description="关闭会追加一条售后状态记录；不会删除案件，也不会自动重放其他写入。"
          consequences={[
            "请先确认检测与处理说明已填写完整。",
            "关闭后只能按服务端返回的后续动作继续核对。",
          ]}
          confirmLabel="确认关闭案件"
          cancelLabel="继续编辑"
          tone="danger"
          pending={mutation.isPending}
          blocked={writeBlocked}
          returnFocusRef={closeTriggerRef}
          onOpenChange={setCloseDialogOpen}
          onConfirm={async () => {
            submitLifecycleMutation();
          }}
        />
      }
    />
  );
}
