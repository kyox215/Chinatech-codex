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

import {
  cancellableState,
  isKnownPurgeRequestState,
  isMutationOutcomeResolved,
  reconciledMutationCopy,
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
    if (!canBegin) {
      return;
    }
    setMode(nextMode);
    setConfirmationPhrase("");
    setTotpCode("");
    setAcknowledged(false);
    setPhraseCopied(false);
    setPreflight(null);
    setOpen(true);
    try {
      setPreflight(await createStoreLifecyclePreflight(store.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法完成删除前安全预检");
    }
  };

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
      toast.success(reconciledMutationCopy(outcome.kind));
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
        throw new Error("已有店铺删除操作正在处理中，请等待结果");
      }
      mutationLockRef.current = true;
      mutationStartedRef.current = false;
      mutationOutcomeRef.current = {
        kind: mode,
        previousState: requestQuery.data?.state ?? null,
      };
      try {
        if (!requestQuery.isSuccess) {
          throw new Error("正在读取永久删除申请状态，请稍后再试");
        }
        const currentRequest = requestQuery.data ?? null;
        if (currentRequest && !isKnownPurgeRequestState(currentRequest.state)) {
          void refetchPurgeRequest();
          throw new Error("永久删除申请状态正在核对，请稍后再试");
        }
        if (mode === "request" && currentRequest !== null && currentRequest.state !== "cancelled") {
          throw new Error("已有永久删除申请正在处理，请先核对现有状态");
        }
        if (
          mode === "confirm" &&
          (!currentRequest || currentRequest.state !== "ready_for_confirmation")
        ) {
          throw new Error("永久删除申请尚未达到最终确认条件，请刷新后再试");
        }
        const lifecycle = preflight?.lifecycle ?? store.lifecycle;
        if (!preflight || !lifecycle) throw new Error("删除前安全预检尚未完成");
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
          if (!currentRequest) throw new Error("找不到待确认的永久删除申请");
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
          ? "永久删除申请已建立，可在冷静期内取消"
          : "最终确认已记录，等待后台安全核验和排程",
      );
      await queryClient.invalidateQueries({ queryKey: storesKeys.lifecycle(store.id) });
      await clearTenantScopedQueryCache(queryClient);
      await refreshStoreContextQueries(queryClient);
      mutationOutcomeRef.current = null;
      mutationStartedRef.current = false;
      mutationLockRef.current = false;
    },
    onError: (error) => {
      if (mutationOutcomeRef.current) {
        setOutcomeUnknown(true);
        setOpen(false);
        toast.error("操作结果暂时无法确认，正在核对服务器状态");
        void reconcileMutationOutcome();
        return;
      }
      toast.error(error instanceof Error ? error.message : "提交失败");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (mutationLockRef.current) {
        throw new Error("已有店铺删除操作正在处理中，请等待结果");
      }
      mutationLockRef.current = true;
      mutationStartedRef.current = false;
      mutationOutcomeRef.current = {
        kind: "cancel",
        previousState: purgeRequest?.state ?? null,
      };
      try {
        if (!requestQuery.isSuccess || !purgeRequest) {
          throw new Error("找不到可取消的删除申请");
        }
        if (!isKnownPurgeRequestState(purgeRequest.state) || !cancellableState(purgeRequest)) {
          throw new Error("当前申请状态不可取消，请刷新后再试");
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
      toast.success("永久删除申请已取消");
      mutationOutcomeRef.current = null;
      mutationStartedRef.current = false;
      mutationLockRef.current = false;
    },
    onError: (error) => {
      if (mutationOutcomeRef.current) {
        setOutcomeUnknown(true);
        setOpen(false);
        toast.error("取消结果暂时无法确认，正在核对服务器状态");
        void reconcileMutationOutcome();
        return;
      }
      toast.error(error instanceof Error ? error.message : "取消失败");
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
      toast.error("无法复制提示词，请手动输入");
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
