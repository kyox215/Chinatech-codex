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
  buildNewOrderOfflineDraftInput,
  getNewOrderOfflineDraftFingerprint,
  hasNewOrderSensitiveUnlockDraft,
  isNewOrderFormWorthOfflineAutosave,
  restoreNewOrderFormFromOfflineDraft,
  type NewOrderOfflineDraftRestoreResult,
} from "@/features/orders/model/new-order-offline-draft";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";

export type NewOrderOfflineAutosaveState =
  | "disabled"
  | "checking"
  | "ready"
  | "saving"
  | "saved"
  | "queued"
  | "error"
  | "unavailable";

export type NewOrderOfflineDraftPrompt = {
  localDraftId: string;
  updatedAt: string;
  relationshipNeedsReview: boolean;
};

export type UseNewOrderOfflineAutosaveOptions = {
  form: NewOrderFormState;
  scope?: RepairDeskOfflineScope | null;
  enabled?: boolean;
  debounceMs?: number;
  preflightTimeoutMs?: number;
  serviceFactory?: (scope: RepairDeskOfflineScope) => RepairDeskOfflineOrderService;
};

export function useNewOrderOfflineAutosave({
  form,
  scope,
  enabled = true,
  debounceMs = 1200,
  preflightTimeoutMs = 3000,
  serviceFactory = createIndexedDbOrderService,
}: UseNewOrderOfflineAutosaveOptions) {
  const [state, setState] = useState<NewOrderOfflineAutosaveState>(
    scope && enabled ? "checking" : "disabled",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<NewOrderOfflineDraftPrompt | null>(null);
  const [pendingRestoreNotice, setPendingRestoreNotice] = useState<string | null>(null);
  const [preflightAttempt, setPreflightAttempt] = useState(0);
  const latestFormRef = useRef(form);
  const currentDraftIdRef = useRef<string | undefined>(undefined);
  const lastSavedFingerprintRef = useRef<string | undefined>(undefined);
  const storageAvailableRef = useRef(false);
  const queuedRef = useRef(false);
  const scopeStoreId = scope?.storeId;
  const scopeUserId = scope?.userId;

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  const service = useMemo(() => {
    if (!enabled || !scopeStoreId || !scopeUserId || typeof window === "undefined") return null;
    return serviceFactory({ storeId: scopeStoreId, userId: scopeUserId });
  }, [enabled, scopeStoreId, scopeUserId, serviceFactory]);

  useEffect(() => {
    let active = true;
    storageAvailableRef.current = false;
    queuedRef.current = false;
    currentDraftIdRef.current = undefined;
    lastSavedFingerprintRef.current = undefined;
    setLastSavedAt(null);
    setDraftPrompt(null);
    setPendingRestoreNotice(null);
    setErrorMessage(null);

    if (!service) {
      setState("disabled");
      return;
    }

    setState("checking");
    void (async () => {
      try {
        const health = await withTimeout(
          service.healthCheck(),
          preflightTimeoutMs,
          "检查本机草稿超时，请重试",
        );
        if (!active) return;
        if (!health.ok || !health.value.available) {
          storageAvailableRef.current = false;
          setState("unavailable");
          setErrorMessage(
            formatOfflineStorageError(!health.ok ? health.error : health.value.error),
          );
          return;
        }

        const drafts = await withTimeout(
          service.listLocalDrafts(),
          preflightTimeoutMs,
          "读取本机草稿超时，请重试",
        );
        if (!active) return;
        if (!drafts.ok) {
          storageAvailableRef.current = false;
          setState("error");
          setErrorMessage(formatOfflineStorageError(drafts.error));
          return;
        }

        storageAvailableRef.current = true;
        setState("ready");
        const newest = drafts.value
          .filter((draft) => draft.mode === "create")
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
        if (!newest) return;
        setDraftPrompt({
          localDraftId: newest.localDraftId,
          updatedAt: newest.updatedAt,
          relationshipNeedsReview:
            newest.customerLinkMode === "unknown_needs_review" ||
            newest.deviceLinkMode === "unknown_device_needs_review",
        });
      } catch (error) {
        if (!active) return;
        storageAvailableRef.current = false;
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "检查本机草稿失败，请重试");
      }
    })();

    return () => {
      active = false;
    };
  }, [preflightAttempt, preflightTimeoutMs, service]);

  const retryPreflight = useCallback(() => {
    setPreflightAttempt((attempt) => attempt + 1);
  }, []);

  const saveNow = useCallback(async () => {
    const currentForm = latestFormRef.current;
    if (!isNewOrderFormWorthOfflineAutosave(currentForm)) return true;
    if (!service || !storageAvailableRef.current || draftPrompt || queuedRef.current) return false;

    const fingerprint = getNewOrderOfflineDraftFingerprint(currentForm);
    if (fingerprint === lastSavedFingerprintRef.current && currentDraftIdRef.current) return true;

    setState("saving");
    setErrorMessage(null);
    const saved = await service.saveDraft(
      buildNewOrderOfflineDraftInput({
        form: currentForm,
        localDraftId: currentDraftIdRef.current,
      }),
    );

    if (!saved.ok) {
      setState("error");
      setErrorMessage(formatOfflineStorageError(saved.error));
      return false;
    }

    currentDraftIdRef.current = saved.value.localDraftId;
    lastSavedFingerprintRef.current = fingerprint;
    setLastSavedAt(saved.value.updatedAt);
    setState("saved");
    return true;
  }, [draftPrompt, service]);

  const isCurrentDraftDirty = useCallback(() => {
    const currentForm = latestFormRef.current;
    return (
      isNewOrderFormWorthOfflineAutosave(currentForm) &&
      getNewOrderOfflineDraftFingerprint(currentForm) !== lastSavedFingerprintRef.current
    );
  }, []);

  const isDraftDirty = isCurrentDraftDirty();

  useEffect(() => {
    if (!service || !storageAvailableRef.current || draftPrompt) return;
    if (
      state === "checking" ||
      state === "disabled" ||
      state === "saving" ||
      state === "queued" ||
      state === "unavailable"
    )
      return;
    if (!isNewOrderFormWorthOfflineAutosave(form)) return;

    const timer = window.setTimeout(() => {
      void saveNow();
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, draftPrompt, form, saveNow, service, state]);

  useEffect(() => {
    if (!service) return;
    const saveBeforeHidden = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    document.addEventListener("visibilitychange", saveBeforeHidden);
    return () => document.removeEventListener("visibilitychange", saveBeforeHidden);
  }, [saveNow, service]);

  const restorePromptDraft =
    useCallback(async (): Promise<NewOrderOfflineDraftRestoreResult | null> => {
      if (!service || !draftPrompt) return null;
      const restored = await service.restoreDraft(draftPrompt.localDraftId);
      if (!restored.ok || !restored.value) {
        setState("error");
        setErrorMessage(formatOfflineStorageError(!restored.ok ? restored.error : undefined));
        return null;
      }

      const restoreResult = restoreNewOrderFormFromOfflineDraft(restored.value);
      currentDraftIdRef.current = restored.value.localDraftId;
      queuedRef.current = false;
      lastSavedFingerprintRef.current = getNewOrderOfflineDraftFingerprint(restoreResult.form);
      setLastSavedAt(restored.value.updatedAt);
      setDraftPrompt(null);
      const restoreNotices = ["本机草稿已恢复"];
      if (restoreResult.custodyNeedsConfirmation) {
        restoreNotices.push("旧草稿未记录设备是否留店，请重新选择");
      }
      if (restoreResult.relationshipNeedsReview) {
        restoreNotices.push("客户或设备关联需要在线保存前再次确认");
      }
      if (restoreResult.sensitiveUnlockNeedsReentry) {
        restoreNotices.push("手机密码、PIN 或图案需要重新输入");
      }
      setPendingRestoreNotice(`${restoreNotices.join("；")}。`);
      setState("saved");
      return restoreResult;
    }, [draftPrompt, service]);

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
      queuedRef.current = false;
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
    queuedRef.current = false;
    lastSavedFingerprintRef.current = undefined;
    setLastSavedAt(null);
    setDraftPrompt(null);
    setPendingRestoreNotice(null);
    setState("ready");
    return true;
  }, [service]);

  const queueCurrentDraftForSync = useCallback(async () => {
    if (!service || !storageAvailableRef.current) {
      throw new Error("本机离线存储尚未就绪，请稍后重试");
    }
    if (draftPrompt) {
      throw new Error("请先恢复或丢弃已有的本机草稿");
    }
    const currentForm = latestFormRef.current;
    if (hasNewOrderSensitiveUnlockDraft(currentForm)) {
      throw new Error("离线创建不会保存手机密码、PIN 或图案，请清除后再保存");
    }
    if (!currentForm.deviceCustodyStatus) {
      throw new Error("请先确认设备是否留店");
    }
    if (currentForm.status !== "new") {
      throw new Error("离线新建只能从“新工单”状态开始");
    }

    setState("saving");
    setErrorMessage(null);
    const saved = await service.saveDraft(
      buildNewOrderOfflineDraftInput({
        form: currentForm,
        localDraftId: currentDraftIdRef.current,
      }),
    );
    if (!saved.ok) {
      setState("error");
      setErrorMessage(formatOfflineStorageError(saved.error));
      throw new Error(formatOfflineStorageError(saved.error));
    }

    currentDraftIdRef.current = saved.value.localDraftId;
    lastSavedFingerprintRef.current = getNewOrderOfflineDraftFingerprint(currentForm);
    setLastSavedAt(saved.value.updatedAt);
    const queued = await service.queueDraftForSync({ localDraftId: saved.value.localDraftId });
    if (!queued.ok) {
      setState("error");
      setErrorMessage(formatOfflineStorageError(queued.error));
      throw new Error(formatOfflineStorageError(queued.error));
    }

    queuedRef.current = true;
    setState("queued");
    return queued.value.outboxEntry.operationId;
  }, [draftPrompt, service]);

  return {
    state,
    errorMessage,
    lastSavedAt,
    draftPrompt,
    pendingRestoreNotice,
    hasSensitiveUnlockDraft: hasNewOrderSensitiveUnlockDraft(form),
    isDraftDirty,
    isCurrentDraftDirty,
    saveNow,
    restorePromptDraft,
    discardPromptDraft,
    discardCurrentDraft,
    queueCurrentDraftForSync,
    retryPreflight,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function createIndexedDbOrderService(scope: RepairDeskOfflineScope) {
  const store = createRepairDeskIndexedDbOfflineStore({ scope });
  return createRepairDeskOfflineOrderService({ store, scope });
}

function formatOfflineStorageError(error: RepairDeskOfflineError | undefined) {
  if (!error) return "本机草稿暂不可用，请不要刷新页面。";
  if (error.code === "quota_exceeded") return "本机存储空间不足，草稿未保存，请不要刷新页面。";
  if (error.code === "storage_unavailable") return "此浏览器无法使用本机草稿，请不要刷新页面。";
  return "本机草稿保存失败，请不要刷新页面。";
}
