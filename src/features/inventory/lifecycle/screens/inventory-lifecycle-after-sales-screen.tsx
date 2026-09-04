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
import { useLocale } from "@/shared/i18n/locale-provider";

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
import { localizeInventoryAfterSalesStatus } from "../model/inventory-lifecycle-i18n";

const statusCopy = {
  open: "待检测",
  in_progress: "处理中",
  waiting_customer: "等客户",
  returned: "已返还",
  closed: "已关闭",
} as const;

export function InventoryLifecycleAfterSalesQueueScreen() {
  const { t } = useLocale();
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
        title={t("inventory2b4.afterSales.queueTitle")}
        context={t("inventory2b4.afterSales.context")}
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
        title={t("inventory2b4.afterSales.queueTitle")}
        context={t("inventory2b4.afterSales.queueLoading")}
        onBack={() => router.push("/inventory")}
      >
        <InventoryAvailabilityStateCard availability={availability} />
      </InventoryLifecyclePageShell>
    );
  }
  if (query.isError && !query.data) {
    return (
      <InventoryLifecyclePageShell
        title={t("inventory2b4.afterSales.queueTitle")}
        context={t("inventory2b4.afterSales.queueUnavailable")}
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
      title={t("inventory2b4.afterSales.queueTitle")}
      context={t("inventory2b4.afterSales.queueDescription")}
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
  const { t } = useLocale();
  const translateRef = useRef(t);
  translateRef.current = t;
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
  const [preflightError, setPreflightError] = useState("");
  const closeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const submitLock = useRef(false);
  const syncBlocked = Boolean(syncStatus && syncStatus !== "recovered");
  const idempotencyAttempt = useRef<
    { fingerprint: string; key: string; returnedAt?: string } | undefined
  >(undefined);
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
      submitLock.current = false;
      selfCommitReadbackRef.current = {
        key: currentAfterSalesKey,
        previousVersion: afterSalesBaselineRef.current?.version ?? query.data?.version ?? 0,
        expectedVersion: result.case_version ?? result.version,
      };
      idempotencyAttempt.current = undefined;
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
      submitLock.current = false;
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
    idempotencyAttempt.current = undefined;
    submitLock.current = false;
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
      idempotencyAttempt.current = undefined;
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
            title: translateRef.current("inventory2b4.afterSales.conflictTitle"),
            description: translateRef.current("inventory2b4.afterSales.conflictDescription"),
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
        title={t("inventory2b4.afterSales.caseTitle")}
        context={t("inventory2b4.afterSales.context")}
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
        title={t("inventory2b4.afterSales.caseTitle")}
        context={t("inventory2b4.afterSales.caseLoading")}
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
        title={t("inventory2b4.afterSales.caseTitle")}
        context={t("inventory2b4.afterSales.caseUnavailable")}
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
      idempotencyAttempt.current = undefined;
      setConflict(null);
      setRecoveryMessage(t("inventory2b4.afterSales.recovered"));
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
          label: t("inventory2b4.afterSales.diagnosis"),
          message: diagnosisError,
        },
      ]
    : [];
  const submitLifecycleMutation = () => {
    if (writePending || submitLock.current) return;
    if (!diagnosis.trim()) {
      setValidationAttempt((current) => current + 1);
      setDiagnosisError(t("inventory2b4.afterSales.diagnosisRequired"));
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPreflightError(t("inventory2b4.afterSales.offline"));
      return;
    }
    submitLock.current = true;
    setPreflightError("");
    setDiagnosisError("");
    setOperationReceipt(null);
    setRecoveryMessage("");
    setFreshnessVerification("idle");
    if (status === "closed") setCloseDialogOpen(false);
    const command = status === "closed" ? "after_sales.close" : "after_sales.update";
    const semanticPayload = {
      case_id: item.case_id,
      expected_case_version: item.version,
      status,
      diagnosis: diagnosis.trim(),
      coverage_decision: coverage,
    };
    const fingerprint = `${command}:${JSON.stringify(semanticPayload)}`;
    const existingAttempt = idempotencyAttempt.current;
    const sameAttempt = existingAttempt?.fingerprint === fingerprint;
    const returnedAt =
      status === "returned"
        ? sameAttempt
          ? existingAttempt.returnedAt
          : new Date().toISOString()
        : undefined;
    const nextAttempt = sameAttempt
      ? existingAttempt
      : { fingerprint, key: crypto.randomUUID(), returnedAt };
    idempotencyAttempt.current = nextAttempt;
    mutation.mutate({
      command,
      idempotency_key: nextAttempt.key,
      payload: {
        ...semanticPayload,
        ...(returnedAt ? { returned_at: returnedAt } : {}),
      },
    });
  };
  return (
    <InventoryAfterSalesCaseWorkspace
      title={t("inventory2b4.afterSales.caseTitle")}
      context={`${item.sku} · ${localizeInventoryAfterSalesStatus(
        item.status,
        statusCopy[item.status] ?? item.status,
        t,
      )}`}
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
          {preflightError ? (
            <p
              className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {preflightError}
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
                setRecoveryMessage(t("inventory2b4.afterSales.acknowledged"));
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
                ? t("inventory2b4.afterSales.savePending")
                : writeBlocked
                  ? t("inventory2b4.afterSales.writeBlocked")
                  : status === "closed"
                    ? t("inventory2b4.afterSales.close")
                    : t("inventory2b4.afterSales.save")
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
            title={t("inventory2b4.afterSales.noActionTitle")}
            body={t("inventory2b4.afterSales.noActionBody")}
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
          title={t("inventory2b4.afterSales.closeTitle")}
          description={t("inventory2b4.afterSales.closeDescription")}
          consequences={[
            t("inventory2b4.afterSales.closeConsequenceDiagnosis"),
            t("inventory2b4.afterSales.closeConsequenceActions"),
          ]}
          confirmLabel={t("inventory2b4.afterSales.close")}
          cancelLabel={t("inventory2b4.sale.cancel.continueEditing")}
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
