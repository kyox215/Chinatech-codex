"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createRepairDeskIndexedDbOfflineStore } from "@/features/offline/model/offline-indexeddb-store";
import {
  createRepairDeskOfflineOrderService,
  type RepairDeskOfflineOrderService,
} from "@/features/offline/model/offline-order-service";
import type {
  RepairDeskOfflineError,
  RepairDeskOfflineScope,
} from "@/features/offline/model/offline-types";
import {
  buildEditOrderOfflineDraftInput,
  getEditOrderOfflineDraftFingerprint,
  hasEditOrderSensitiveUnlockDraft,
  isEditOrderFormWorthOfflineAutosave,
  restoreEditOrderFormFromOfflineDraft,
  type EditOrderOfflineDraftRestoreResult,
} from "@/features/orders/model/edit-order-offline-draft";
import type { OrderDetail, UpdateOrderInput } from "@/lib/repairdesk/types";

export type EditOrderOfflineAutosaveState =
  | "disabled"
  | "checking"
  | "ready"
  | "saving"
  | "saved"
  | "error"
  | "unavailable";

export type EditOrderOfflineDraftPrompt = {
  localDraftId: string;
  updatedAt: string;
  baseUpdatedAt?: string;
  currentUpdatedAt: string;
  hasConflict: boolean;
  relationshipNeedsReview: boolean;
};

export type UseEditOrderOfflineAutosaveOptions = {
  draft: UpdateOrderInput | null;
  orderDetail: OrderDetail | null | undefined;
  scope?: RepairDeskOfflineScope | null;
  defaultWarrantyMonths?: number;
  enabled?: boolean;
  autosaveEnabled?: boolean;
  debounceMs?: number;
  serviceFactory?: (scope: RepairDeskOfflineScope) => RepairDeskOfflineOrderService;
};

export function useEditOrderOfflineAutosave({
  draft,
  orderDetail,
  scope,
  defaultWarrantyMonths = 6,
  enabled = true,
  autosaveEnabled = true,
  debounceMs = 1200,
  serviceFactory = createIndexedDbOrderService,
}: UseEditOrderOfflineAutosaveOptions) {
  const [state, setState] = useState<EditOrderOfflineAutosaveState>(
    scope && enabled && orderDetail ? "checking" : "disabled",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<EditOrderOfflineDraftPrompt | null>(null);
  const [pendingRestoreNotice, setPendingRestoreNotice] = useState<string | null>(null);
  const latestDraftRef = useRef(draft);
  const latestOrderDetailRef = useRef(orderDetail ?? null);
  const currentDraftIdRef = useRef<string | undefined>(undefined);
  const lastSavedFingerprintRef = useRef<string | undefined>(undefined);
  const storageAvailableRef = useRef(false);
  const scopeStoreId = scope?.storeId;
  const scopeUserId = scope?.userId;
  const orderId = orderDetail?.order.id;
  const orderUpdatedAt = orderDetail?.order.updated_at;

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    latestOrderDetailRef.current = orderDetail ?? null;
  }, [orderDetail]);

  const service = useMemo(() => {
    if (!enabled || !scopeStoreId || !scopeUserId || !orderId || typeof window === "undefined")
      return null;
    return serviceFactory({ storeId: scopeStoreId, userId: scopeUserId });
  }, [enabled, orderId, scopeStoreId, scopeUserId, serviceFactory]);

  useEffect(() => {
    let active = true;
    storageAvailableRef.current = false;
    currentDraftIdRef.current = undefined;
    lastSavedFingerprintRef.current = undefined;
    setLastSavedAt(null);
    setDraftPrompt(null);
    setPendingRestoreNotice(null);
    setErrorMessage(null);

    if (!service || !orderId || !orderUpdatedAt) {
      setState("disabled");
      return;
    }

    setState("checking");
    service.healthCheck().then(async (health) => {
      if (!active) return;
      if (!health.ok || !health.value.available) {
        storageAvailableRef.current = false;
        setState("unavailable");
        setErrorMessage(formatOfflineStorageError(!health.ok ? health.error : health.value.error));
        return;
      }

      storageAvailableRef.current = true;
      setState("ready");
      const drafts = await service.listLocalDrafts();
      if (!active || !drafts.ok) return;
      const newest = drafts.value
        .filter((item) => item.mode === "edit" && item.serverOrderId === orderId)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      if (!newest) return;
      setDraftPrompt({
        localDraftId: newest.localDraftId,
        updatedAt: newest.updatedAt,
        baseUpdatedAt: newest.baseUpdatedAt,
        currentUpdatedAt: orderUpdatedAt,
        hasConflict: newest.baseUpdatedAt !== orderUpdatedAt,
        relationshipNeedsReview:
          newest.customerLinkMode !== "existing_customer" ||
          newest.deviceLinkMode !== "existing_customer_device",
      });
    });

    return () => {
      active = false;
    };
  }, [orderId, orderUpdatedAt, service]);

  const saveNow = useCallback(async () => {
    const currentDraft = latestDraftRef.current;
    const currentOrderDetail = latestOrderDetailRef.current;
    if (
      !service ||
      !storageAvailableRef.current ||
      draftPrompt ||
      !autosaveEnabled ||
      !currentDraft ||
      !currentOrderDetail
    ) {
      return;
    }
    if (
      !isEditOrderFormWorthOfflineAutosave({
        data: currentOrderDetail,
        draft: currentDraft,
        defaultWarrantyMonths,
      })
    ) {
      return;
    }

    const fingerprint = getEditOrderOfflineDraftFingerprint({
      data: currentOrderDetail,
      draft: currentDraft,
    });
    if (fingerprint === lastSavedFingerprintRef.current && currentDraftIdRef.current) return;

    setState("saving");
    setErrorMessage(null);
    const saved = await service.saveDraft(
      buildEditOrderOfflineDraftInput({
        data: currentOrderDetail,
        draft: currentDraft,
        localDraftId: currentDraftIdRef.current,
      }),
    );

    if (!saved.ok) {
      setState("error");
      setErrorMessage(formatOfflineStorageError(saved.error));
      return;
    }

    currentDraftIdRef.current = saved.value.localDraftId;
    lastSavedFingerprintRef.current = fingerprint;
    setLastSavedAt(saved.value.updatedAt);
    setState("saved");
  }, [autosaveEnabled, defaultWarrantyMonths, draftPrompt, service]);

  useEffect(() => {
    if (!service || !storageAvailableRef.current || draftPrompt || !autosaveEnabled) return;
    if (
      state === "checking" ||
      state === "disabled" ||
      state === "saving" ||
      state === "unavailable"
    )
      return;
    const currentOrderDetail = orderDetail ?? null;
    if (!draft || !currentOrderDetail) return;
    if (
      !isEditOrderFormWorthOfflineAutosave({
        data: currentOrderDetail,
        draft,
        defaultWarrantyMonths,
      })
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveNow();
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [
    autosaveEnabled,
    debounceMs,
    defaultWarrantyMonths,
    draft,
    draftPrompt,
    orderDetail,
    saveNow,
    service,
    state,
  ]);

  useEffect(() => {
    if (!service) return;
    const saveBeforeHidden = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    document.addEventListener("visibilitychange", saveBeforeHidden);
    return () => document.removeEventListener("visibilitychange", saveBeforeHidden);
  }, [saveNow, service]);

  const restorePromptDraft =
    useCallback(async (): Promise<EditOrderOfflineDraftRestoreResult | null> => {
      const currentOrderDetail = latestOrderDetailRef.current;
      if (!service || !draftPrompt || !currentOrderDetail) return null;
      const restored = await service.restoreDraft(draftPrompt.localDraftId);
      if (!restored.ok || !restored.value) {
        setState("error");
        setErrorMessage(formatOfflineStorageError(!restored.ok ? restored.error : undefined));
        return null;
      }

      const restoreResult = restoreEditOrderFormFromOfflineDraft({
        draft: restored.value,
        data: currentOrderDetail,
        defaultWarrantyMonths,
      });
      if (restoreResult.status === "conflict") {
        setPendingRestoreNotice(restoreResult.message);
        setState("ready");
        return restoreResult;
      }

      currentDraftIdRef.current = restored.value.localDraftId;
      lastSavedFingerprintRef.current = getEditOrderOfflineDraftFingerprint({
        data: currentOrderDetail,
        draft: restoreResult.draft,
      });
      setLastSavedAt(restored.value.updatedAt);
      setDraftPrompt(null);
      setPendingRestoreNotice(
        restoreResult.relationshipNeedsReview
          ? "本机编辑草稿已恢复；订单关联信息需要在线保存前再次确认。"
          : "本机编辑草稿已恢复；手机密码不会从普通草稿恢复。",
      );
      setState("saved");
      return restoreResult;
    }, [defaultWarrantyMonths, draftPrompt, service]);

  const discardPromptDraft = useCallback(async () => {
    if (!service || !draftPrompt) return false;
    const discarded = await service.discardDraft(draftPrompt.localDraftId);
    if (!discarded.ok) {
      setState("error");
      setErrorMessage(formatOfflineStorageError(discarded.error));
      return false;
    }
    if (currentDraftIdRef.current === draftPrompt.localDraftId) {
      currentDraftIdRef.current = undefined;
      lastSavedFingerprintRef.current = undefined;
      setLastSavedAt(null);
    }
    setDraftPrompt(null);
    setPendingRestoreNotice(null);
    setState("ready");
    return true;
  }, [draftPrompt, service]);

  const discardCurrentDraft = useCallback(async () => {
    if (!service || !currentDraftIdRef.current) return false;
    const discarded = await service.discardDraft(currentDraftIdRef.current);
    if (!discarded.ok) return false;
    currentDraftIdRef.current = undefined;
    lastSavedFingerprintRef.current = undefined;
    setLastSavedAt(null);
    setDraftPrompt(null);
    setPendingRestoreNotice(null);
    setState("ready");
    return true;
  }, [service]);

  return {
    state,
    errorMessage,
    lastSavedAt,
    draftPrompt,
    pendingRestoreNotice,
    hasSensitiveUnlockDraft: hasEditOrderSensitiveUnlockDraft(draft),
    saveNow,
    restorePromptDraft,
    discardPromptDraft,
    discardCurrentDraft,
  };
}

function createIndexedDbOrderService(scope: RepairDeskOfflineScope) {
  const store = createRepairDeskIndexedDbOfflineStore({ scope });
  return createRepairDeskOfflineOrderService({ store, scope });
}

function formatOfflineStorageError(error: RepairDeskOfflineError | undefined) {
  if (!error) return "本机编辑草稿暂不可用，请不要刷新页面。";
  if (error.code === "quota_exceeded") return "本机存储空间不足，编辑草稿未保存，请不要刷新页面。";
  if (error.code === "storage_unavailable") return "此浏览器无法使用本机编辑草稿，请不要刷新页面。";
  return "本机编辑草稿保存失败，请不要刷新页面。";
}
