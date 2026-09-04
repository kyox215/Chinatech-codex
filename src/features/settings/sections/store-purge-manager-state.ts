"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getStorePurgeConfirmationPhrase,
  type StorePurgeConfirmationOperation,
} from "@/entities/store/model/store-purge-confirmation";
import {
  lifecycleMfaRequired,
  verifyRecentLifecycleAal2,
} from "@/features/settings/model/store-lifecycle-mfa";
import {
  clearTenantScopedQueryCache,
  refreshStoreContextQueries,
} from "@/features/stores/api/tenant-cache";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  cancelStorePurgeRequest,
  confirmStorePurgeRequest,
  createStoreLifecyclePreflight,
  getStorePurgeRequest,
  issueStoreLifecycleChallenge,
  requestStorePurge,
} from "@/lib/repairdesk/api";
import type {
  ActorStoreMembership,
  StoreLifecycleActionCapability,
  StoreLifecyclePreflight,
  StorePurgeRequest,
} from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

import {
  cancellableState,
  isKnownPurgeRequestState,
  isMutationOutcomeResolved,
  type MutationOutcome,
  type StorePurgeManagerMode,
} from "./store-purge-manager-logic";

export function useStorePurgeManagerState({
  store,
  capability,
}: {
  store: ActorStoreMembership;
  capability: StoreLifecycleActionCapability;
}) {
  const { locale } = useLocale();
  const copy = (source: Parameters<typeof translateSettingsOperations>[1]) =>
    translateSettingsOperations(locale, source);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<StorePurgeManagerMode>("request");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [phraseCopied, setPhraseCopied] = useState(false);
  const [preflight, setPreflight] = useState<StoreLifecyclePreflight | null>(null);
  const mutationLockRef = useRef(false);
  const mutationOutcomeRef = useRef<MutationOutcome | null>(null);
  const mutationStartedRef = useRef(false);
  const reconciliationInFlightRef = useRef(false);
  const reconciliationAttemptRef = useRef(false);
  const beginLockRef = useRef(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [isMutationReconciling, setIsMutationReconciling] = useState(false);
  const [reconciliationError, setReconciliationError] = useState(false);
  const canReadStatus = capability.allowed || capability.code === "feature_disabled";
  const requestQueryKey = [...storesKeys.lifecycle(store.id), "purge-request"] as const;
  const requestQuery = useQuery({
    queryKey: requestQueryKey,
    queryFn: () => getStorePurgeRequest(store.id),
    enabled: canReadStatus,
    refetchInterval: 30_000,
  });
  const { refetch: refetchPurgeRequest } = requestQuery;
  const purgeRequest = requestQuery.isSuccess ? (requestQuery.data ?? null) : null;
  const purgeRequestStateKnown =
    purgeRequest === null || isKnownPurgeRequestState(purgeRequest.state);
  const isReconcilingPurgeRequest = requestQuery.isSuccess && !purgeRequestStateKnown;
  const [isReconciling, setIsReconciling] = useState(false);
  const requiresTotp = lifecycleMfaRequired();
  const operation: StorePurgeConfirmationOperation =
    mode === "request" ? "request_purge" : "confirm_purge";
  const expectedPhrase = getStorePurgeConfirmationPhrase(store.id, operation);
  const phraseMismatch = confirmationPhrase.length > 0 && confirmationPhrase !== expectedPhrase;

  useEffect(() => {
    if (!isReconcilingPurgeRequest) {
      reconciliationAttemptRef.current = false;
      setIsReconciling(false);
      return;
    }
    if (reconciliationAttemptRef.current) return;
    reconciliationAttemptRef.current = true;
    setIsReconciling(true);
    void refetchPurgeRequest().finally(() => setIsReconciling(false));
  }, [isReconcilingPurgeRequest, refetchPurgeRequest]);

  const begin = async (nextMode: StorePurgeManagerMode) => {
    const canBegin =
      capability.allowed &&
      !outcomeUnknown &&
      requestQuery.isSuccess &&
      purgeRequestStateKnown &&
      (nextMode === "request"
        ? !purgeRequest || purgeRequest.state === "cancelled"
        : purgeRequest?.state === "ready_for_confirmation");
    if (!canBegin || beginLockRef.current) {
      return;
    }
    beginLockRef.current = true;
    setMode(nextMode);
    setConfirmationPhrase("");
    setTotpCode("");
    setAcknowledged(false);
    setPhraseCopied(false);
    setPreflight(null);
    setOpen(true);
    try {
      setPreflight(await createStoreLifecyclePreflight(store.id));
    } catch {
      toast.error(copy("无法完成删除前安全预检"));
    } finally {
      beginLockRef.current = false;
    }
  };

  useEffect(() => {
    if (capability.allowed) return;
    if (!mutationStartedRef.current) mutationLockRef.current = false;
    setOpen(false);
    setConfirmationPhrase("");
    setTotpCode("");
    setAcknowledged(false);
    setPhraseCopied(false);
    setPreflight(null);
  }, [capability.allowed]);

  const reconcileMutationOutcome = async () => {
    const outcome = mutationOutcomeRef.current;
    if (!outcome || reconciliationInFlightRef.current) return;

    reconciliationInFlightRef.current = true;
    setOutcomeUnknown(true);
    setIsMutationReconciling(true);
    setReconciliationError(false);
    try {
      const result = await refetchPurgeRequest();
      const reconciled =
        result.isSuccess &&
        isKnownPurgeRequestState(result.data?.state) &&
        isMutationOutcomeResolved(outcome, result.data ?? null);
      if (!reconciled) {
        setReconciliationError(true);
        return;
      }

      const reconciledRequest = result.data ?? null;
      queryClient.setQueryData(requestQueryKey, reconciledRequest);
      try {
        await queryClient.invalidateQueries({ queryKey: storesKeys.lifecycle(store.id) });
        await clearTenantScopedQueryCache(queryClient);
        await refreshStoreContextQueries(queryClient);
      } finally {
        mutationOutcomeRef.current = null;
        mutationStartedRef.current = false;
        mutationLockRef.current = false;
        setOutcomeUnknown(false);
        setReconciliationError(false);
        setOpen(false);
      }
      toast.success(
        copy(
          outcome.kind === "cancel"
            ? "取消结果已从服务器状态核对并同步"
            : outcome.kind === "confirm"
              ? "最终确认结果已从服务器状态核对并同步"
              : "永久删除申请结果已从服务器状态核对并同步",
        ),
      );
    } catch {
      setReconciliationError(true);
    } finally {
      reconciliationInFlightRef.current = false;
      setIsMutationReconciling(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (mutationLockRef.current) {
        throw new Error("store_purge_action_in_progress");
      }
      mutationLockRef.current = true;
      mutationStartedRef.current = false;
      mutationOutcomeRef.current = {
        kind: mode,
        previousState: requestQuery.data?.state ?? null,
      };
      try {
        if (!requestQuery.isSuccess) {
          throw new Error("store_purge_status_unavailable");
        }
        const currentRequest = requestQuery.data ?? null;
        if (currentRequest && !isKnownPurgeRequestState(currentRequest.state)) {
          void refetchPurgeRequest();
          throw new Error("store_purge_status_reconciling");
        }
        if (mode === "request" && currentRequest !== null && currentRequest.state !== "cancelled") {
          throw new Error("store_purge_request_already_exists");
        }
        if (
          mode === "confirm" &&
          (!currentRequest || currentRequest.state !== "ready_for_confirmation")
        ) {
          throw new Error("store_purge_not_ready_for_confirmation");
        }
        const lifecycle = preflight?.lifecycle ?? store.lifecycle;
        if (!preflight || !lifecycle) throw new Error("store_purge_preflight_incomplete");
        await verifyRecentLifecycleAal2(totpCode);
        const challenge = await issueStoreLifecycleChallenge({
          expectedStoreId: store.id,
          expectedRevision: lifecycle.revision,
          operationKind: operation,
          preflightSnapshotHash: preflight.snapshot_hash,
        });
        const common = {
          expectedStoreId: store.id,
          expectedRevision: lifecycle.revision,
          reauthChallengeId: challenge.id,
          preflightSnapshotHash: preflight.snapshot_hash,
          confirmationPhrase,
        };
        if (mode === "confirm") {
          if (!currentRequest) throw new Error("store_purge_request_missing");
          mutationStartedRef.current = true;
          return await confirmStorePurgeRequest({
            ...common,
            requestId: currentRequest.request_id,
          });
        }
        mutationStartedRef.current = true;
        return await requestStorePurge(common);
      } catch (error) {
        if (!mutationStartedRef.current) {
          mutationOutcomeRef.current = null;
          mutationLockRef.current = false;
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(requestQueryKey, result);
      setOpen(false);
      toast.success(
        mode === "request"
          ? copy("永久删除申请已建立，可在冷静期内取消")
          : copy("最终确认已记录，等待后台安全核验和排程"),
      );
      await queryClient.invalidateQueries({ queryKey: storesKeys.lifecycle(store.id) });
      await clearTenantScopedQueryCache(queryClient);
      await refreshStoreContextQueries(queryClient);
      mutationOutcomeRef.current = null;
      mutationStartedRef.current = false;
      mutationLockRef.current = false;
    },
    onError: (_error) => {
      if (mutationOutcomeRef.current) {
        setOutcomeUnknown(true);
        setOpen(false);
        toast.error(copy("操作结果暂时无法确认，正在核对服务器状态"));
        void reconcileMutationOutcome();
        return;
      }
      toast.error(copy("提交失败"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (mutationLockRef.current) {
        throw new Error("store_purge_action_in_progress");
      }
      mutationLockRef.current = true;
      mutationStartedRef.current = false;
      mutationOutcomeRef.current = {
        kind: "cancel",
        previousState: purgeRequest?.state ?? null,
      };
      try {
        if (!requestQuery.isSuccess || !purgeRequest) {
          throw new Error("store_purge_cancellable_request_missing");
        }
        if (!isKnownPurgeRequestState(purgeRequest.state) || !cancellableState(purgeRequest)) {
          throw new Error("store_purge_request_not_cancellable");
        }
        mutationStartedRef.current = true;
        return await cancelStorePurgeRequest({
          expectedStoreId: store.id,
          requestId: purgeRequest.request_id,
        });
      } catch (error) {
        if (!mutationStartedRef.current) {
          mutationOutcomeRef.current = null;
          mutationLockRef.current = false;
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(requestQueryKey, result);
      await queryClient.invalidateQueries({ queryKey: storesKeys.lifecycle(store.id) });
      await refreshStoreContextQueries(queryClient);
      toast.success(copy("永久删除申请已取消"));
      mutationOutcomeRef.current = null;
      mutationStartedRef.current = false;
      mutationLockRef.current = false;
    },
    onError: (_error) => {
      if (mutationOutcomeRef.current) {
        setOutcomeUnknown(true);
        setOpen(false);
        toast.error(copy("取消结果暂时无法确认，正在核对服务器状态"));
        void reconcileMutationOutcome();
        return;
      }
      toast.error(copy("取消失败"));
    },
  });

  const isActionPending = submitMutation.isPending || cancelMutation.isPending;
  const isActionLocked = isActionPending || outcomeUnknown;
  const cancellable =
    canReadStatus &&
    requestQuery.isSuccess &&
    purgeRequestStateKnown &&
    Boolean(purgeRequest) &&
    ["cooling", "preparing_export", "ready_for_confirmation", "scheduled"].includes(
      purgeRequest?.state ?? "",
    ) &&
    !purgeRequest?.destructive_step_started &&
    !isActionLocked;
  const readyForConfirmation =
    capability.allowed &&
    requestQuery.isSuccess &&
    purgeRequestStateKnown &&
    purgeRequest?.state === "ready_for_confirmation" &&
    !isActionLocked;
  const ready =
    capability.allowed &&
    requestQuery.isSuccess &&
    purgeRequestStateKnown &&
    Boolean(preflight) &&
    preflight?.state === "eligible" &&
    confirmationPhrase === expectedPhrase &&
    acknowledged &&
    (!requiresTotp || totpCode.length === 6) &&
    !isActionLocked;

  const copyPhrase = async () => {
    if (isActionLocked) return;
    try {
      await navigator.clipboard.writeText(expectedPhrase);
      setPhraseCopied(true);
      window.setTimeout(() => setPhraseCopied(false), 1600);
    } catch {
      toast.error(copy("无法复制提示词，请手动输入"));
    }
  };

  const retryPurgeStatus = () => {
    reconciliationAttemptRef.current = false;
    void refetchPurgeRequest();
  };

  const canOfferNewRequest =
    requestQuery.isSuccess &&
    !isReconcilingPurgeRequest &&
    !outcomeUnknown &&
    purgeRequestStateKnown &&
    (!purgeRequest || purgeRequest.state === "cancelled") &&
    capability.allowed;
  const hasCompletedRequest = purgeRequest?.state === "completed";

  return {
    store,
    capability,
    open,
    setOpen,
    mode,
    confirmationPhrase,
    setConfirmationPhrase,
    totpCode,
    setTotpCode,
    acknowledged,
    setAcknowledged,
    phraseCopied,
    preflight,
    canReadStatus,
    requestQuery,
    purgeRequest,
    purgeRequestStateKnown,
    isReconcilingPurgeRequest,
    isReconciling,
    outcomeUnknown,
    isMutationReconciling,
    reconciliationError,
    requiresTotp,
    expectedPhrase,
    phraseMismatch,
    isActionPending,
    isActionLocked,
    cancellable,
    readyForConfirmation,
    ready,
    canOfferNewRequest,
    hasCompletedRequest,
    begin,
    reconcileMutationOutcome,
    copyPhrase,
    retryPurgeStatus,
    submitMutation,
    cancelMutation,
  };
}

export type StorePurgeManagerState = ReturnType<typeof useStorePurgeManagerState>;
