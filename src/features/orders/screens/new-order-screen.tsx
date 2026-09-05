"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, CircleAlert, RotateCcw, Trash2, X } from "lucide-react";

import { toFaultPriceItems } from "@/components/orders/fault-diagnosis-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useNavigationGuard,
  type NavigationGuardResolution,
} from "@/components/navigation-guard-provider";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

import {
  createOrder,
  getCustomerDetail,
  getOnboardingStatus,
  getOrderCreateOperationStatus,
  isRepairDeskRequestTimeoutError,
  RepairDeskApiError,
} from "@/lib/repairdesk/api";
import type {
  CustomerDetail,
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
  CustomerIntakeNewCustomerPolicy,
  FaultPriceItem,
} from "@/lib/repairdesk/api";
import type { CustomerIdentityResolution } from "@/lib/repairdesk/types";
import {
  NewOrderDeviceInfoSection,
  NewOrderDeviceUnlockSection,
  NewOrderCustomerSection,
} from "@/features/orders/forms/new-order-customer-device-section";
import { customerIntakePolicyBlocksSubmit } from "@/features/customers/model/customer-intake-search";
import { NewOrderQuotationSection } from "@/features/orders/forms/new-order-quotation-section";
import { NewOrderSubmitBar } from "@/features/orders/forms/new-order-submit-bar";
import { NewOrderGuidedWorkspace } from "@/features/orders/forms/new-order-guided-workspace";
import {
  useNewOrderOfflineAutosave,
  type NewOrderOfflineAutosaveState,
  type NewOrderOfflineDraftPrompt,
} from "@/features/orders/api/use-new-order-offline-autosave";
import {
  customerLabelForNewOrder,
  customerNameForNewOrder,
  customerNameValueForCreateOrder,
  createCustomFaultForNewOrder,
  initialNewOrderForm,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";
import { formatWarrantyText, warrantyReasonRequired } from "@/features/orders/model/order-warranty";
import {
  deviceCustodyAllowsStatus,
  normalizeUnlockForCustody,
} from "@/features/orders/model/device-custody";
import { isRepairDeskOfflineSyncEnabled } from "@/features/offline/model/offline-sync-feature";
import {
  isNewOrderSessionStoreChanged,
  isNewOrderSimpleModeEnabled,
} from "@/features/orders/model/new-order-simple-mode-feature";
import { storeSettingsQueryOptions } from "@/features/messages/api/query-options";
import { orderWorkflowQueryOptions } from "@/features/orders/api/query-options";
import { synchronizeCreatedOrderNavigation } from "@/features/orders/api/cache-sync";
import { getWorkflowStatuses } from "@/features/orders/model/order-workflow";
import { localizeOrderWorkflowStatusLabel } from "@/features/orders/model/order-i18n";
import type { NewOrderPrefill } from "@/features/orders/model/new-order-intent";
import { platformKeys } from "@/features/platform/api/query-keys";
import { CACHE_TIMES } from "@/lib/query-performance";
import { detailWorkspace, layoutGuards, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/shared/i18n/format";
import { useLocale } from "@/shared/i18n/locale-provider";

export function NewOrderScreen({
  surface = "page",
  onCreated,
  onCancel,
  prefill,
}: {
  surface?: "page" | "dialog";
  onCreated?: (id: string) => void;
  onCancel?: () => void;
  prefill?: NewOrderPrefill;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { registerGuard } = useNavigationGuard();
  const [form, setForm] = useState<NewOrderFormState>(initialNewOrderForm);
  const [historyDevices, setHistoryDevices] = useState<CustomerHistoryDeviceCandidate[]>([]);
  const [discardDraftDialogOpen, setDiscardDraftDialogOpen] = useState(false);
  const [identityConflict, setIdentityConflict] = useState<NewOrderIdentityConflict | null>(null);
  const [customerIdentityIntent, setCustomerIdentityIntent] =
    useState<CustomerIntakeNewCustomerPolicy | null>(null);
  const [sharedPhoneConfirmOpen, setSharedPhoneConfirmOpen] = useState(false);
  const [submitValidationMessage, setSubmitValidationMessage] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [createRecovery, setCreateRecovery] = useState<NewOrderCreateRecoveryState>({
    state: "idle",
  });
  const createOperationIdRef = useRef<string | null>(null);
  const [floatingHeaderOffset, setFloatingHeaderOffset] = useState(
    "calc(env(safe-area-inset-top) + 5.5rem)",
  );
  const [hydrated, setHydrated] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);
  const [diagnosisDeferred, setDiagnosisDeferred] = useState(false);
  const [sessionStoreId, setSessionStoreId] = useState<string | null>(null);
  const [sessionEntryMode, setSessionEntryMode] = useState<"simple" | "professional" | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (surface !== "page") return;
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, [surface]);

  const { data: onboardingStatus } = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    retry: false,
    staleTime: CACHE_TIMES.shell,
  });
  const hydratedOnboardingStatus = hydrated ? onboardingStatus : undefined;
  const activeStoreId = hydratedOnboardingStatus?.activeStore?.id;
  const offlineScope = useMemo(
    () =>
      activeStoreId && hydratedOnboardingStatus?.userId
        ? { storeId: activeStoreId, userId: hydratedOnboardingStatus.userId }
        : null,
    [activeStoreId, hydratedOnboardingStatus?.userId],
  );
  const offlineDraft = useNewOrderOfflineAutosave({
    form,
    scope: offlineScope,
  });
  const storeSettingsQuery = useQuery({
    ...storeSettingsQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId),
    refetchOnMount: "always",
  });
  const storeSettings = storeSettingsQuery.data;
  const { data: workflow } = useQuery({
    ...orderWorkflowQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId),
  });
  const defaultWarrantyMonths = storeSettings?.default_order_warranty_months ?? 6;
  const operatorName = hydratedOnboardingStatus?.displayName ?? t("orders2b1.new.currentAccount");
  const operatorRole = hydratedOnboardingStatus?.activeStore?.role;
  const createStatuses = useMemo(
    () =>
      getWorkflowStatuses(workflow).filter((status) => status.enabled && status.allowed_for_create),
    [workflow],
  );
  const defaultCreateStatus =
    createStatuses.find((status) => status.is_default_create_status) ?? createStatuses[0];
  const selectedCreateStatus = createStatuses.find((status) => status.code === form.status);
  const simpleModeEnabled = isNewOrderSimpleModeEnabled();
  const effectiveEntryMode =
    sessionEntryMode === "simple"
      ? simpleModeEnabled
        ? "simple"
        : "professional"
      : sessionEntryMode;
  const sessionStoreChanged = isNewOrderSessionStoreChanged(sessionStoreId, activeStoreId);

  useEffect(() => {
    if (activeStoreId && sessionStoreId === null) setSessionStoreId(activeStoreId);
  }, [activeStoreId, sessionStoreId]);

  useEffect(() => {
    if (
      !sessionStoreId ||
      sessionEntryMode !== null ||
      storeSettingsQuery.isPending ||
      storeSettingsQuery.isFetching
    ) {
      return;
    }
    setSessionEntryMode(
      storeSettingsQuery.isError
        ? "professional"
        : (storeSettings?.new_order_entry_mode ?? "professional"),
    );
  }, [
    sessionEntryMode,
    sessionStoreId,
    storeSettings,
    storeSettingsQuery.isError,
    storeSettingsQuery.isFetching,
    storeSettingsQuery.isPending,
  ]);

  useEffect(() => {
    if (!storeSettings) return;
    setForm((current) => {
      const untouchedDefault =
        current.warrantyMonths === 6 &&
        current.warrantyText === "6个月" &&
        !current.warrantyChangeReason;
      if (!untouchedDefault) return current;
      return {
        ...current,
        warrantyMonths: defaultWarrantyMonths,
        warrantyText: formatWarrantyText(defaultWarrantyMonths),
      };
    });
  }, [defaultWarrantyMonths, storeSettings]);

  useEffect(() => {
    if (!defaultCreateStatus) return;
    setForm((current) =>
      createStatuses.some((status) => status.code === current.status)
        ? current
        : { ...current, status: defaultCreateStatus.code },
    );
  }, [createStatuses, defaultCreateStatus]);

  const validFaultDrafts = useMemo(
    () => form.faults.filter((item) => item.name.trim()),
    [form.faults],
  );
  const total = useMemo(
    () => validFaultDrafts.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [validFaultDrafts],
  );
  const activeTotal = total;
  const activeDeposit = form.deposit;
  const draftFaultPrices = useMemo(() => toFaultPriceItems(validFaultDrafts), [validFaultDrafts]);
  const validFaultPrices = draftFaultPrices;
  const createStatusLabel = selectedCreateStatus
    ? localizeOrderWorkflowStatusLabel(selectedCreateStatus, t)
    : defaultCreateStatus
      ? localizeOrderWorkflowStatusLabel(defaultCreateStatus, t)
      : form.status;

  const selectHistoryDevice = useCallback((device: CustomerHistoryDeviceCandidate) => {
    setForm((current) => ({
      ...current,
      deviceId: device.source === "customer_device" ? device.device_id : undefined,
      brand: device.brand,
      model: device.model,
      imei: device.serial_or_imei,
      deviceNotes: device.device_notes ?? "",
    }));
  }, []);

  const handlePickCustomer = useCallback(
    (candidate: CustomerIntakeCandidate) => {
      setCustomerIdentityIntent(null);
      const customerName = customerNameForNewOrder(candidate.customer);
      const customerLabel = customerLabelForNewOrder(candidate.customer);
      setHistoryDevices(candidate.historyDevices);
      setForm((current) => ({
        ...current,
        customerId: candidate.customer.id,
        customerName,
        customerPhone: candidate.customer.phone_e164,
        deviceId: undefined,
        brand: "",
        model: "",
        imei: "",
        deviceNotes: "",
      }));
      toast.success(
        candidate.historyDevices.length
          ? t("orders2b1.new.selectedCustomerDevice", { customer: customerLabel })
          : t("orders2b1.new.selectedCustomer", { customer: customerLabel }),
      );
    },
    [t],
  );

  useEffect(() => {
    const customerId = prefill?.customerId;
    const prefillIdentifier = prefill?.identifier ?? "";

    const applyPrefillIdentifier = () => {
      if (!prefillIdentifier) return;
      setForm((current) =>
        current.imei ? current : { ...current, imei: prefillIdentifier, deviceId: undefined },
      );
    };

    if (!customerId) {
      applyPrefillIdentifier();
      return;
    }

    const controller = new AbortController();
    const preferredDeviceId = prefill?.deviceId;
    getCustomerDetail(customerId, { signal: controller.signal })
      .then((detail) => {
        if (controller.signal.aborted) return;
        const candidates = buildHistoryDevicesFromDetail(detail);
        const selectedDevice = preferredDeviceId
          ? candidates.find((device) => device.device_id === preferredDeviceId)
          : undefined;
        setHistoryDevices(candidates);
        const customerName = customerNameForNewOrder(detail.customer);
        const customerLabel = customerLabelForNewOrder(detail.customer);
        setForm((current) => ({
          ...current,
          customerId: detail.customer.id,
          customerName,
          customerPhone: detail.customer.phone_e164,
          ...(selectedDevice
            ? {
                deviceId:
                  selectedDevice.source === "customer_device"
                    ? selectedDevice.device_id
                    : undefined,
                brand: selectedDevice.brand,
                model: selectedDevice.model,
                imei: selectedDevice.serial_or_imei,
                deviceNotes: selectedDevice.device_notes ?? "",
              }
            : {
                deviceId: undefined,
                brand: "",
                model: "",
                imei: "",
                deviceNotes: "",
              }),
        }));
        toast.success(
          selectedDevice
            ? t("orders2b1.new.prefilledDevice", {
                customer: customerLabel,
                device: `${selectedDevice.brand} ${selectedDevice.model}`,
              })
            : t("orders2b1.new.prefilledCustomer", { customer: customerLabel }),
        );
        applyPrefillIdentifier();
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted && error.name !== "AbortError")
          toast.error(t("orders2b1.new.error.generic"));
      });

    return () => {
      controller.abort();
    };
  }, [prefill?.customerId, prefill?.deviceId, prefill?.identifier, prefill?.key, t]);

  const completeOnlineOrderCreated = useCallback(
    async (id: string, options: { recovered?: boolean; replayed?: boolean } = {}) => {
      createOperationIdRef.current = null;
      setIdentityConflict(null);
      setSharedPhoneConfirmOpen(false);
      setCreateRecovery({ state: "idle" });
      void offlineDraft.discardCurrentDraft();
      toast.success(
        t(
          options.recovered || options.replayed
            ? "orders2b1.new.toast.createdConfirmed"
            : "orders2b1.new.toast.created",
        ),
      );
      await synchronizeCreatedOrderNavigation(queryClient, id, activeStoreId).catch(
        () => undefined,
      );
      if (onCreated) {
        onCreated(id);
      } else {
        router.push(`/orders/${id}`);
      }
    },
    [activeStoreId, offlineDraft, onCreated, queryClient, router, t],
  );

  const confirmCreateOperation = useCallback(
    async (operationId: string) => {
      setCreateRecovery({ state: "confirming", operationId });
      try {
        for (let attempt = 0; attempt < CREATE_OPERATION_CONFIRM_ATTEMPTS; attempt += 1) {
          if (attempt > 0) await waitForCreateOperationConfirmAttempt(attempt);
          const status = await getOrderCreateOperationStatus(operationId, { timeoutMs: 8_000 });
          if (status.status === "created") {
            await completeOnlineOrderCreated(status.id, { recovered: true });
            return;
          }
        }
      } catch {
        // Keep the UI in a non-duplicating state when result confirmation fails.
      }
      setCreateRecovery({ state: "uncertain", operationId });
      toast.error(t("orders2b1.new.recovery.uncertain"));
    },
    [completeOnlineOrderCreated, t],
  );

  const create = useMutation({
    mutationFn: async (
      identityResolution: CustomerIdentityResolution = { mode: "auto" },
    ): Promise<
      | { kind: "online"; id: string; replayed?: boolean }
      | { kind: "offline_queued"; operationId: string }
    > => {
      if (sessionStoreChanged) {
        throw new Error(t("orders2b1.new.error.storeChanged"));
      }
      const custodyStatus = form.deviceCustodyStatus;
      if (!custodyStatus) throw new Error(t("orders2b1.new.error.custody"));
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (identityResolution.mode !== "auto") {
          throw new Error(t("orders2b1.new.error.identityOnline"));
        }
        if (!isRepairDeskOfflineSyncEnabled()) {
          throw new Error(t("orders2b1.new.error.offlineDisabled"));
        }
        return {
          kind: "offline_queued",
          operationId: await offlineDraft.queueCurrentDraftForSync(),
        };
      }
      const operationId = createOperationIdRef.current ?? createRepairDeskCreateOperationId();
      createOperationIdRef.current = operationId;
      const result = await createOrder({
        expected_store_id: sessionStoreId ?? undefined,
        operation_id: operationId,
        order_type: form.type,
        status: form.status,
        customer_id: form.customerId,
        customer_name: customerNameValueForCreateOrder(form),
        customer_phone: form.customerPhone,
        customer_identity_resolution: identityResolution,
        device_id: form.deviceId,
        device_brand: form.brand,
        device_model: form.model,
        device_imei: form.imei,
        device_custody_status: custodyStatus,
        issue_description: "",
        accessory_notes: form.accessoryNotes || undefined,
        warranty_text: form.warrantyText || undefined,
        warranty_months: form.warrantyMonths,
        warranty_change_reason: form.warrantyChangeReason || undefined,
        device_unlock: normalizeUnlockForCustody(custodyStatus, form.deviceUnlock),
        fault_prices: validFaultPrices,
        deposit_amount: activeDeposit,
      });
      return { kind: "online", id: result.id, replayed: result.replayed };
    },
    onSuccess: (result) => {
      if (result.kind === "offline_queued") {
        toast.success(t("orders2b1.new.toast.queued"));
        if (onCancel) {
          onCancel();
        } else {
          router.push("/orders");
        }
        return;
      }
      void completeOnlineOrderCreated(result.id, { replayed: result.replayed });
    },
    onError: (error: Error) => {
      if (
        error instanceof RepairDeskApiError &&
        error.status === 409 &&
        error.code === "CUSTOMER_IDENTITY_CONFLICT"
      ) {
        const conflict = readNewOrderIdentityConflict(error.details);
        if (conflict) {
          setGuidedStep(0);
          setIdentityConflict(conflict);
          setCreateRecovery({ state: "idle" });
          return;
        }
      }
      if (isRepairDeskRequestTimeoutError(error) && createOperationIdRef.current) {
        toast.message(t("orders2b1.new.recovery.confirming"));
        void confirmCreateOperation(createOperationIdRef.current);
        return;
      }
      createOperationIdRef.current = null;
      setCreateRecovery({ state: "idle" });
      toast.error(getCreateOrderErrorMessage(error, t));
    },
  });

  const customerIdentityCreationBlocked = customerIntakePolicyBlocksSubmit(customerIdentityIntent);
  const valid =
    form.deviceCustodyStatus !== null &&
    form.customerPhone.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    activeDeposit <= activeTotal &&
    !customerIdentityCreationBlocked &&
    !sessionStoreChanged &&
    deviceCustodyAllowsStatus(
      form.deviceCustodyStatus,
      form.status,
      selectedCreateStatus?.bucket,
    ) &&
    (!warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) ||
      form.warrantyChangeReason.trim());
  const missingItems = useMemo(
    () =>
      getNewOrderMissingItems({
        form,
        total,
        defaultWarrantyMonths,
        customerIdentityCreationBlocked,
        selectedCreateStatus,
        t,
      }),
    [customerIdentityCreationBlocked, defaultWarrantyMonths, form, selectedCreateStatus, total, t],
  );

  const handleGuidedNext = () => {
    const sectionId = guidedStep === 0 ? "customer" : guidedStep === 1 ? "device" : "quotation";
    const currentStepItems = missingItems.filter((item) => item.sectionId === sectionId);
    if (guidedStep === 2 && !diagnosisDeferred && !form.faults.some((fault) => fault.name.trim())) {
      currentStepItems.push({
        code: "diagnosis_required",
        fieldId: "faults",
        sectionId: "quotation",
        label: t("orders2b1.new.validation.diagnosis"),
        target: "quotation",
      });
    }
    if (currentStepItems.length) {
      setValidationAttempted(true);
      setSubmitValidationMessage(
        t("orders2b1.new.validation.handle", {
          items: currentStepItems.map((item) => item.label).join(" / "),
        }),
      );
      focusNewOrderMissingItem(currentStepItems[0]);
      return;
    }
    setSubmitValidationMessage("");
    setGuidedStep((current) => Math.min(3, current + 1));
  };

  useEffect(() => {
    if (valid) {
      setSubmitValidationMessage("");
      setValidationAttempted(false);
    }
  }, [valid]);

  useEffect(() => {
    if (!validationAttempted) return;
    return syncNewOrderValidationAria(missingItems, "new-order-validation-summary");
  }, [missingItems, validationAttempted]);

  const patchFault = (index: number, patch: Partial<FaultPriceItem>) => {
    const next = [...form.faults];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, faults: next });
  };

  const addCustomFault = () => {
    setForm({
      ...form,
      faults: [...form.faults, createCustomFaultForNewOrder()],
    });
  };

  const handleFloatingHeaderHeight = useCallback((height: number) => {
    setFloatingHeaderOffset(`${Math.ceil(height)}px`);
  }, []);

  const handleRestoreOfflineDraft = useCallback(async () => {
    const restored = await offlineDraft.restorePromptDraft();
    if (!restored) return;
    setForm(restored.form);
    setHistoryDevices([]);
    setCustomerIdentityIntent(null);
    toast.success(t("orders2b1.new.toast.restored"));
  }, [offlineDraft, t]);

  const handleDiscardOfflineDraft = useCallback(async () => {
    const discarded = await offlineDraft.discardPromptDraft();
    if (!discarded) return;
    setDiscardDraftDialogOpen(false);
    toast.success(t("orders2b1.new.toast.discarded"));
  }, [offlineDraft, t]);

  const offlineStatus = {
    state: offlineDraft.state,
    lastSavedAt: offlineDraft.lastSavedAt,
    errorMessage: offlineDraft.errorMessage,
    hasSensitiveUnlockDraft: offlineDraft.hasSensitiveUnlockDraft,
    scopeReady: Boolean(offlineScope),
  };
  const createSubmitBlocked =
    create.isPending ||
    createRecovery.state === "confirming" ||
    createRecovery.state === "uncertain";
  const createSubmitMessage =
    createRecovery.state === "confirming"
      ? t("orders2b1.new.recovery.confirmingHelp")
      : createRecovery.state === "uncertain"
        ? t("orders2b1.new.recovery.uncertainHelp")
        : create.isPending
          ? t("orders2b1.new.processing")
          : customerIdentityCreationBlocked
            ? t("orders2b1.new.validation.identity")
            : undefined;
  const guardSnapshotRef = useRef({
    surface,
    offlineDraft,
    createPending: create.isPending,
    createRecoveryState: createRecovery.state,
  });
  guardSnapshotRef.current = {
    surface,
    offlineDraft,
    createPending: create.isPending,
    createRecoveryState: createRecovery.state,
  };

  useEffect(
    () =>
      registerGuard({
        id: "orders-new-draft",
        label: () => t("orders2b1.new.shortTitle"),
        isDirty: () => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.surface !== "page") return false;
          return (
            Boolean(snapshot.offlineDraft.draftPrompt) ||
            snapshot.offlineDraft.isCurrentDraftDirty() ||
            snapshot.createPending ||
            snapshot.createRecoveryState !== "idle"
          );
        },
        isBusy: () => {
          const snapshot = guardSnapshotRef.current;
          return (
            snapshot.createPending ||
            snapshot.createRecoveryState === "confirming" ||
            snapshot.createRecoveryState === "uncertain" ||
            snapshot.offlineDraft.state === "saving"
          );
        },
        canSave: () => {
          const snapshot = guardSnapshotRef.current;
          return (
            !snapshot.offlineDraft.draftPrompt &&
            !snapshot.offlineDraft.hasSensitiveUnlockDraft &&
            !snapshot.createPending &&
            snapshot.createRecoveryState === "idle" &&
            snapshot.offlineDraft.state !== "unavailable"
          );
        },
        saveUnavailableReason: () => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.createPending || snapshot.createRecoveryState !== "idle") {
            return t("orders2b1.new.recovery.confirmingHelp");
          }
          if (snapshot.offlineDraft.draftPrompt) {
            return t("orders2b1.new.offline.found");
          }
          if (snapshot.offlineDraft.hasSensitiveUnlockDraft) {
            return t("orders2b1.new.unlockDraftWarning");
          }
          if (snapshot.offlineDraft.state === "unavailable") {
            return t("orders2b1.new.offline.unavailable");
          }
          return t("orders2b1.new.offline.unavailable");
        },
        save: async (): Promise<NavigationGuardResolution> => {
          const snapshot = guardSnapshotRef.current;
          if (
            snapshot.createPending ||
            snapshot.createRecoveryState !== "idle" ||
            snapshot.offlineDraft.draftPrompt ||
            snapshot.offlineDraft.hasSensitiveUnlockDraft
          ) {
            return { status: "blocked" };
          }
          const saved = await snapshot.offlineDraft.saveNow();
          return saved ? { status: "resolved" } : { status: "blocked" };
        },
        discard: async (): Promise<NavigationGuardResolution> => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.createPending || snapshot.createRecoveryState !== "idle") {
            return { status: "blocked" };
          }
          await snapshot.offlineDraft.discardCurrentDraft();
          setForm(initialNewOrderForm);
          setHistoryDevices([]);
          return { status: "resolved" };
        },
        focusFallback: () => {
          document.querySelector<HTMLElement>("[data-new-order-form='true'] input")?.focus();
        },
      }),
    [registerGuard, t],
  );

  const customerSectionNode = (
    <NewOrderCustomerSection
      form={form}
      setForm={setForm}
      onClearCustomerContext={() => {
        setHistoryDevices([]);
        setIdentityConflict(null);
        setCustomerIdentityIntent(null);
        setSharedPhoneConfirmOpen(false);
        createOperationIdRef.current = null;
      }}
      onPickCustomer={handlePickCustomer}
      onNewCustomerIntentChange={setCustomerIdentityIntent}
      surface={surface}
    />
  );
  const deviceSectionNode = (
    <NewOrderDeviceInfoSection
      form={form}
      setForm={setForm}
      historyDevices={historyDevices}
      onSelectHistoryDevice={selectHistoryDevice}
      surface={surface}
    />
  );
  const unlockSectionNode = (
    <NewOrderDeviceUnlockSection form={form} setForm={setForm} surface={surface} />
  );
  const quotationSectionNode = (layout: "professional" | "guided" = "professional") => (
    <NewOrderQuotationSection
      form={form}
      setForm={setForm}
      total={total}
      operatorName={operatorName}
      operatorRole={operatorRole}
      onPatchFault={patchFault}
      onAddCustomFault={addCustomFault}
      createStatuses={createStatuses}
      defaultWarrantyMonths={defaultWarrantyMonths}
      surface={surface}
      layout={layout}
    />
  );

  return (
    <div
      data-new-order-root="true"
      data-new-order-surface={surface}
      className={cn(
        layoutGuards.noPageOverflow,
        surface === "dialog"
          ? cn(
              detailWorkspace.root,
              "h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] sm:h-[calc(100svh-32px)] sm:max-h-[calc(100svh-32px)]",
            )
          : "mx-auto w-full min-w-0 max-w-[430px] overflow-x-hidden px-2 sm:max-w-2xl md:max-w-7xl md:px-5 md:pt-3 lg:px-6",
      )}
      style={
        surface === "page"
          ? ({
              "--repair-os-mobile-floating-offset": floatingHeaderOffset,
            } as CSSProperties)
          : undefined
      }
    >
      <h1 className="sr-only">{t("orders2b1.new.title")}</h1>
      {surface === "page" ? (
        <NewOrderMobileHeader
          valid={Boolean(valid)}
          missingItems={missingItems}
          offlineStatus={offlineStatus}
          onHeightChange={handleFloatingHeaderHeight}
        />
      ) : null}

      <form
        data-new-order-form="true"
        onBlurCapture={() => {
          void offlineDraft.saveNow();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (effectiveEntryMode === "simple" && guidedStep < 3) {
            handleGuidedNext();
            return;
          }
          if (createRecovery.state === "confirming" || createRecovery.state === "uncertain") {
            toast.message(
              createRecovery.state === "confirming"
                ? t("orders2b1.new.recovery.confirming")
                : t("orders2b1.new.recovery.uncertainHelp"),
            );
            return;
          }
          if (!valid) {
            const normalizedMissingItems = missingItems.length
              ? missingItems
              : [fallbackNewOrderMissingItem(t)];
            setValidationAttempted(true);
            setSubmitValidationMessage(
              t("orders2b1.new.validation.summary", {
                count: normalizedMissingItems.length,
                items: normalizedMissingItems.map((item) => item.label).join(" / "),
              }),
            );
            focusNewOrderMissingItem(normalizedMissingItems[0]);
            toast.error(
              form.deviceCustodyStatus === null
                ? t("orders2b1.new.error.custody")
                : customerIdentityCreationBlocked
                  ? t("orders2b1.new.validation.identity")
                  : form.deposit > total
                    ? t("orders2b1.new.validation.deposit")
                    : warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) &&
                        !form.warrantyChangeReason.trim()
                      ? t("orders2b1.new.validation.warranty")
                      : t("orders2b1.new.validation.required"),
            );
            return;
          }
          setIdentityConflict(null);
          create.mutate({ mode: "auto" });
        }}
        className={cn(
          "min-w-0 pb-0 scroll-pb-[calc(var(--new-order-submit-offset,7rem)+0.75rem)] sm:pb-20 sm:scroll-pb-20",
          surface === "page" && cn(repairOs.mobileFloatingPage, "md:pb-20 lg:pt-0"),
          surface === "dialog" &&
            "h-full max-h-[calc(100svh-16px)] overflow-y-auto p-2 pt-2 sm:max-h-[calc(100svh-32px)] sm:p-3 sm:pt-3 md:p-4 md:pt-3 lg:flex lg:min-h-0 lg:flex-col lg:pb-3",
        )}
      >
        <p id="new-order-validation-summary" className="sr-only" role="alert" aria-live="assertive">
          {submitValidationMessage}
        </p>
        {surface === "page" ? (
          <div className="mb-2 hidden min-w-0 justify-end gap-2 lg:flex lg:mb-3">
            <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" asChild>
              <Link href="/orders" aria-label={t("common.close")}>
                <X className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}

        {surface === "dialog" && onCancel ? (
          <NewOrderDialogMobileHeader
            valid={Boolean(valid)}
            offlineStatus={offlineStatus}
            onClose={onCancel}
          />
        ) : null}

        <NewOrderDesktopHeader
          valid={Boolean(valid)}
          missingItems={missingItems}
          surface={surface}
          offlineStatus={offlineStatus}
          onClose={surface === "dialog" ? onCancel : undefined}
        />

        {offlineDraft.draftPrompt ? (
          <NewOrderOfflineRestoreCard
            prompt={offlineDraft.draftPrompt}
            onRestore={handleRestoreOfflineDraft}
            onDiscard={() => setDiscardDraftDialogOpen(true)}
          />
        ) : null}

        {offlineDraft.pendingRestoreNotice ? (
          <NewOrderOfflineInlineNotice tone="success" message={offlineDraft.pendingRestoreNotice} />
        ) : null}

        {offlineDraft.state === "error" || offlineDraft.state === "unavailable" ? (
          <div className="mb-2 grid gap-2 rounded-xl bg-status-warn px-2.5 py-2 md:mb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <NewOrderOfflineInlineNotice
              tone="warning"
              className="mb-0 bg-transparent p-0"
              message={t("orders2b1.new.offline.unavailable")}
            />
            <Button
              type="button"
              variant="outline"
              className="h-[38px] bg-background text-base"
              onClick={offlineDraft.retryPreflight}
            >
              <RotateCcw className="mr-1.5 size-4" /> {t("common.retry")}
            </Button>
          </div>
        ) : null}

        {createRecovery.state !== "idle" ? (
          <NewOrderCreateRecoveryCard
            state={createRecovery}
            onRetry={() => {
              void confirmCreateOperation(createRecovery.operationId);
            }}
          />
        ) : null}

        {storeSettingsQuery.isError ? (
          <div
            className="mb-3 rounded-xl bg-status-warn px-3 py-2 text-xs text-status-warn-foreground"
            role="status"
          >
            {t("orders2b1.new.modeFallback")}
            <Button
              type="button"
              variant="link"
              className="ml-1 h-auto p-0 text-xs"
              onClick={() => void storeSettingsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : null}
        {sessionStoreChanged ? (
          <div
            className="mb-3 rounded-xl bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
            role="alert"
          >
            {t("orders2b1.new.storeFrozen")}
          </div>
        ) : null}

        {effectiveEntryMode === null ? (
          <section
            data-new-order-mode-loading="true"
            className={cn(
              repairOs.mobileInfoCard,
              "mx-auto w-full max-w-[760px] animate-pulse p-4 md:rounded-[var(--radius-lg)] md:shadow-none",
            )}
            aria-busy="true"
          >
            <p className="text-sm font-semibold">{t("orders2b1.new.modeLoading")}</p>
            <div className="mt-3 h-24 rounded-xl bg-[var(--surface-panel-muted)]" />
          </section>
        ) : effectiveEntryMode === "simple" ? (
          <NewOrderGuidedWorkspace
            step={guidedStep}
            form={form}
            total={total}
            statusLabel={createStatusLabel}
            diagnosisDeferred={diagnosisDeferred}
            pending={createSubmitBlocked || sessionStoreChanged}
            customer={customerSectionNode}
            device={deviceSectionNode}
            unlock={unlockSectionNode}
            quotation={
              <>
                <section
                  className={cn(
                    repairOs.mobileInfoCard,
                    "p-3 md:rounded-[var(--radius-lg)] md:shadow-none",
                  )}
                >
                  <p className="text-xs font-semibold">{t("orders2b1.new.quoteItems")}</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                    {t("orders2b1.new.validation.diagnosis")}
                  </p>
                  <Button
                    type="button"
                    variant={diagnosisDeferred ? "default" : "outline"}
                    className="mt-2 min-h-9"
                    onClick={() => setDiagnosisDeferred((current) => !current)}
                  >
                    {diagnosisDeferred ? <CheckCircle2 className="size-4" /> : null}
                    {t("orders2b1.new.diagnosisDeferred")}
                  </Button>
                </section>
                {quotationSectionNode("guided")}
              </>
            }
            onStepChange={setGuidedStep}
            onNext={handleGuidedNext}
            onCancel={onCancel}
          />
        ) : (
          <>
            <div
              data-new-order-workspace-grid="true"
              className={cn(
                "grid min-w-0 items-start gap-1.5 sm:gap-2 md:grid-cols-[minmax(280px,0.85fr)_minmax(420px,1.35fr)] md:gap-3",
                "lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.34fr)_minmax(0,0.8fr)]",
                surface === "dialog" &&
                  "xl:grid-cols-[minmax(320px,0.9fr)_minmax(500px,1.4fr)_minmax(280px,0.8fr)]",
              )}
            >
              <div className="grid min-w-0 content-start gap-1.5 sm:gap-3 md:col-start-1 md:row-start-1 lg:row-span-2 lg:pr-0.5">
                {customerSectionNode}
                {deviceSectionNode}
              </div>
              {quotationSectionNode()}
              <div className="grid min-w-0 content-start gap-1.5 sm:gap-3 md:col-start-1 md:row-start-2 lg:col-start-3 lg:row-start-1">
                {unlockSectionNode}
              </div>
            </div>

            <div data-new-order-content-end="true" aria-hidden="true" className="h-px w-full" />
            <div
              data-new-order-submit-spacer="true"
              aria-hidden="true"
              className="h-[calc(var(--new-order-submit-offset,7rem)+0.75rem)] w-full shrink-0 md:hidden"
            />

            <NewOrderSubmitBar
              valid={Boolean(valid)}
              pending={createSubmitBlocked || sessionStoreChanged}
              statusMessage={
                sessionStoreChanged ? t("orders2b1.new.storeChangedShort") : createSubmitMessage
              }
              custodyStatus={form.deviceCustodyStatus}
              onCancel={onCancel}
              surface={surface}
              validationSummaryId="new-order-validation-summary"
            />
          </>
        )}
      </form>

      <AlertDialog open={discardDraftDialogOpen} onOpenChange={setDiscardDraftDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders2b1.new.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders2b1.new.discardHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 lg:h-9">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 lg:h-9"
              onClick={() => {
                void handleDiscardOfflineDraft();
              }}
            >
              {t("orders2b1.new.discardConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(identityConflict) && !sharedPhoneConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !sharedPhoneConfirmOpen) {
            setIdentityConflict(null);
            createOperationIdRef.current = null;
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders2b1.new.identityTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders2b1.new.identityHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            {identityConflict?.candidates.map((candidate) => (
              <Button
                key={candidate.customerId}
                type="button"
                variant="outline"
                className="h-11 lg:h-9"
                disabled={create.isPending}
                onClick={() => {
                  if (!identityConflict) return;
                  create.mutate({
                    mode: "use_existing",
                    customer_id: candidate.customerId,
                    conflict_token: identityConflict.conflictToken,
                  });
                }}
              >
                {t("orders2b1.new.useExistingNamed", {
                  name: candidate.displayName || t("orders2b1.new.lookup.unnamed"),
                })}
              </Button>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="h-11 lg:h-9"
              disabled={create.isPending}
              onClick={() => setSharedPhoneConfirmOpen(true)}
            >
              {t("orders2b1.new.otherShared")}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 lg:h-9">
              {t("orders2b1.new.backCheck")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sharedPhoneConfirmOpen} onOpenChange={setSharedPhoneConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders2b1.new.distinctTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders2b1.new.distinctHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 lg:h-9">{t("shell.back")}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 lg:h-9"
              disabled={create.isPending}
              onClick={() => {
                if (!identityConflict) return;
                create.mutate({
                  mode: "create_distinct_shared_phone",
                  conflict_token: identityConflict.conflictToken,
                  reason: "other",
                });
              }}
            >
              {t("orders2b1.new.distinctConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type NewOrderIdentityConflict = {
  conflictToken: string;
  candidates: Array<{ customerId: string; displayName: string }>;
};

function readNewOrderIdentityConflict(
  details: Record<string, unknown> | undefined,
): NewOrderIdentityConflict | null {
  const conflictToken = typeof details?.conflictToken === "string" ? details.conflictToken : "";
  const candidates = Array.isArray(details?.candidates)
    ? details.candidates.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const value = candidate as Record<string, unknown>;
        return typeof value.customerId === "string"
          ? [
              {
                customerId: value.customerId,
                displayName: typeof value.displayName === "string" ? value.displayName : "",
              },
            ]
          : [];
      })
    : [];
  return conflictToken && candidates.length ? { conflictToken, candidates } : null;
}

function getCreateOrderErrorMessage(error: Error, t: ReturnType<typeof useLocale>["t"]) {
  const message = error.message;
  if (/public_no/i.test(message) || /repair_orders_public_no/i.test(message)) {
    return t("orders2b1.new.error.publicNo");
  }
  const knownMessages = [
    t("orders2b1.new.error.storeChanged"),
    t("orders2b1.new.error.custody"),
    t("orders2b1.new.error.identityOnline"),
    t("orders2b1.new.error.offlineDisabled"),
  ];
  return knownMessages.includes(message) ? message : t("orders2b1.new.error.generic");
}

const CREATE_OPERATION_CONFIRM_ATTEMPTS = 6;

type NewOrderCreateRecoveryState =
  | { state: "idle" }
  | { state: "confirming"; operationId: string }
  | { state: "uncertain"; operationId: string };

function createRepairDeskCreateOperationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString().slice(2, 14).padEnd(12, "0")}`;
}

function waitForCreateOperationConfirmAttempt(attempt: number) {
  const delayMs = attempt < 2 ? 1_200 : 2_500;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function NewOrderCreateRecoveryCard({
  state,
  onRetry,
}: {
  state: Exclude<NewOrderCreateRecoveryState, { state: "idle" }>;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const confirming = state.state === "confirming";
  return (
    <section
      data-new-order-create-recovery="true"
      className={cn(
        repairOs.mobileInfoCard,
        "mb-2 grid min-w-0 gap-2 border-status-warn/60 bg-status-warn/35 p-2.5 text-status-warn-foreground md:mb-3 md:rounded-[var(--radius-lg)] md:p-3 md:shadow-none",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-4">
          {confirming ? (
            <RotateCcw className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <CircleAlert className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {t(
              confirming ? "orders2b1.new.recovery.confirming" : "orders2b1.new.recovery.uncertain",
            )}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-4 lg:text-xs lg:leading-[18px]">
          {confirming
            ? t("orders2b1.new.recovery.confirmingHelp")
            : t("orders2b1.new.recovery.uncertainHelp")}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="h-9 rounded-lg text-xs lg:h-8" asChild>
          <Link href="/orders">
            <ClipboardList className="mr-1.5 size-3.5" />
            {t("orders2b1.new.recovery.orders")}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-lg border-status-warn/70 bg-background/80 text-xs lg:h-8"
          asChild
        >
          <Link href="/customers">{t("orders2b1.new.recovery.customers")}</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-lg text-xs lg:h-8"
          disabled={confirming}
          onClick={onRetry}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          {t("orders2b1.new.recovery.retry")}
        </Button>
      </div>
    </section>
  );
}

type NewOrderOfflineStatusSummary = {
  state: NewOrderOfflineAutosaveState;
  lastSavedAt: string | null;
  errorMessage: string | null;
  hasSensitiveUnlockDraft: boolean;
  scopeReady: boolean;
};

type NewOrderMissingItem = {
  code: string;
  fieldId: string;
  sectionId: "customer" | "device" | "diagnosis" | "quotation" | "service";
  label: string;
  target: string;
};

function fallbackNewOrderMissingItem(t: ReturnType<typeof useLocale>["t"]): NewOrderMissingItem {
  return {
    code: "required",
    fieldId: "customerPhone",
    sectionId: "customer",
    label: t("orders2b1.new.validation.requiredData"),
    target: "customer-phone",
  };
}

const validationFocusableSelector =
  "input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex='0']";

function syncNewOrderValidationAria(items: NewOrderMissingItem[], summaryId: string) {
  const clear = () => {
    document
      .querySelectorAll<HTMLElement>("[data-new-order-validation-invalid='true']")
      .forEach((element) => {
        element.removeAttribute("aria-invalid");
        const previous = element.dataset.newOrderValidationPreviousDescribedby;
        if (previous) element.setAttribute("aria-describedby", previous);
        else element.removeAttribute("aria-describedby");
        delete element.dataset.newOrderValidationInvalid;
        delete element.dataset.newOrderValidationPreviousDescribedby;
      });
  };

  clear();
  for (const item of items) {
    const field = document.querySelector<HTMLElement>(`[data-new-order-field="${item.target}"]`);
    if (!field) continue;
    const focusable = field.matches(validationFocusableSelector)
      ? field
      : field.querySelector<HTMLElement>(validationFocusableSelector);
    if (!focusable) continue;
    if (focusable.dataset.newOrderValidationInvalid === "true") continue;
    const previous = focusable.getAttribute("aria-describedby") ?? "";
    focusable.dataset.newOrderValidationInvalid = "true";
    focusable.dataset.newOrderValidationPreviousDescribedby = previous;
    focusable.setAttribute("aria-invalid", "true");
    focusable.setAttribute(
      "aria-describedby",
      Array.from(new Set([...previous.split(/\s+/).filter(Boolean), summaryId])).join(" "),
    );
  }
  return clear;
}

function focusNewOrderMissingItem(item: NewOrderMissingItem | undefined) {
  if (!item) return;
  const target = document.querySelector<HTMLElement>(`[data-new-order-field="${item.target}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    const focusable = target.matches(validationFocusableSelector)
      ? target
      : target.querySelector<HTMLElement>(validationFocusableSelector);
    focusable?.focus({ preventScroll: true });
    if (item.target === "customer-report-edit") focusable?.click();
  }, 250);
}

function getNewOrderMissingItems({
  form,
  total,
  defaultWarrantyMonths,
  customerIdentityCreationBlocked,
  selectedCreateStatus,
  t,
}: {
  form: NewOrderFormState;
  total: number;
  defaultWarrantyMonths: number;
  customerIdentityCreationBlocked: boolean;
  selectedCreateStatus: { code: string; bucket?: string | null } | undefined;
  t: ReturnType<typeof useLocale>["t"];
}): NewOrderMissingItem[] {
  const items: Array<NewOrderMissingItem | null> = [
    !form.customerPhone.trim()
      ? {
          code: "required",
          fieldId: "customerPhone",
          sectionId: "customer",
          label: t("orders2b1.new.validation.customerPhone"),
          target: "customer-phone",
        }
      : null,
    customerIdentityCreationBlocked
      ? {
          code: "identity_conflict",
          fieldId: "customerPhone",
          sectionId: "customer",
          label: t("orders2b1.new.validation.identityIssue"),
          target: "customer-phone",
        }
      : null,
    form.deviceCustodyStatus === null
      ? {
          code: "required",
          fieldId: "deviceCustodyStatus",
          sectionId: "device",
          label: t("orders2b1.new.validation.custody"),
          target: "device-custody",
        }
      : null,
    form.deviceCustodyStatus !== null &&
    !deviceCustodyAllowsStatus(form.deviceCustodyStatus, form.status, selectedCreateStatus?.bucket)
      ? {
          code: "custody_status_incompatible",
          fieldId: "status",
          sectionId: "quotation",
          label: t("orders2b1.new.validation.custodyStatus"),
          target: "create-status",
        }
      : null,
    !form.brand.trim()
      ? {
          code: "required",
          fieldId: "brand",
          sectionId: "device",
          label: t("orders2b1.new.validation.deviceBrand"),
          target: "device-brand",
        }
      : null,
    !form.model.trim()
      ? {
          code: "required",
          fieldId: "model",
          sectionId: "device",
          label: t("orders2b1.new.validation.deviceModel"),
          target: "device-model",
        }
      : null,
    form.deposit > total
      ? {
          code: "deposit_exceeds_total",
          fieldId: "deposit",
          sectionId: "quotation",
          label: t("orders2b1.new.validation.depositShort"),
          target: "deposit",
        }
      : null,
    warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) &&
    !form.warrantyChangeReason.trim()
      ? {
          code: "warranty_reason_required",
          fieldId: "warrantyChangeReason",
          sectionId: "quotation",
          label: t("orders2b1.new.validation.warrantyReason"),
          target: "warranty-reason",
        }
      : null,
  ];

  return items.filter((item): item is NewOrderMissingItem => item !== null);
}

function NewOrderDesktopHeader({
  valid,
  missingItems,
  surface,
  offlineStatus,
  onClose,
}: {
  valid: boolean;
  missingItems: NewOrderMissingItem[];
  surface: "page" | "dialog";
  offlineStatus: NewOrderOfflineStatusSummary;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  return (
    <section
      data-new-order-desktop-header="true"
      className={cn(
        "relative mb-3 hidden min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3 shadow-none lg:grid lg:grid-cols-[minmax(180px,0.8fr)_minmax(280px,1.2fr)] lg:items-center lg:gap-3 xl:grid-cols-[minmax(220px,0.75fr)_minmax(340px,1fr)]",
        surface === "page" && "shadow-[var(--shadow-workspace)]",
        surface === "dialog" && onClose && "pr-12",
      )}
    >
      {surface === "dialog" && onClose ? (
        <Button
          data-new-order-dialog-close="true"
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 size-8 rounded-xl text-muted-foreground hover:bg-[var(--surface-panel-muted)] hover:text-foreground"
          aria-label={t("orders2b1.new.closeAria")}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      ) : null}
      <div className="min-w-0">
        {surface === "dialog" ? (
          <>
            <div className="text-[11px] font-medium leading-4 text-muted-foreground lg:text-xs lg:leading-4">
              {t("orders2b1.new.dialogMode")}
            </div>
            <p className="truncate text-lg font-semibold leading-6">{t("orders2b1.new.title")}</p>
          </>
        ) : null}
        <NewOrderOfflineStatusLine status={offlineStatus} className="mt-2" />
      </div>

      <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-2">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4">
            {valid
              ? t("orders2b1.new.complete")
              : t("orders2b1.new.missingCount", { count: missingItems.length || 1 })}
          </span>
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold lg:text-[11px] lg:leading-4",
              valid
                ? "bg-status-success text-status-success-foreground"
                : "bg-status-warn text-status-warn-foreground",
            )}
          >
            {valid ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            {t(valid ? "orders2b1.new.ready" : "orders2b1.new.incomplete")}
          </span>
        </div>
        {valid ? (
          <p className="rounded-md bg-status-success/35 px-2 py-1.5 text-[10px] font-medium text-status-success-foreground lg:text-xs lg:leading-[18px]">
            {t("orders2b1.new.readyHelp")}
          </p>
        ) : (
          <div data-new-order-missing-items="true" className="flex min-w-0 flex-wrap gap-1.5">
            {(missingItems.length ? missingItems : [fallbackNewOrderMissingItem(t)]).map((item) => (
              <button
                key={`${item.target}-${item.label}`}
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-status-warn-foreground/20 bg-background px-2 text-[10px] font-medium text-status-warn-foreground transition-colors hover:bg-status-warn/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7 lg:text-xs lg:leading-4"
                onClick={() => focusNewOrderMissingItem(item)}
              >
                {t("orders2b1.new.addField", { label: item.label })}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function NewOrderDialogMobileHeader({
  valid,
  offlineStatus,
  onClose,
}: {
  valid: boolean;
  offlineStatus: NewOrderOfflineStatusSummary;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <section
      data-new-order-dialog-mobile-header="true"
      className="mb-1.5 flex min-w-0 items-center justify-between gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-1.5 shadow-none lg:hidden"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-medium leading-3 text-muted-foreground">
          {t("orders2b1.new.dialogMode")}
        </div>
        <div className="truncate text-sm font-semibold leading-5">{t("orders2b1.new.title")}</div>
        <NewOrderOfflineStatusLine status={offlineStatus} compact className="mt-1" />
      </div>
      <span
        className={cn(
          "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
          valid
            ? "bg-status-success text-status-success-foreground"
            : "bg-status-warn text-status-warn-foreground",
        )}
      >
        {valid ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
        {t(valid ? "orders2b1.new.ready" : "orders2b1.new.incomplete")}
      </span>
      <Button
        data-new-order-dialog-close="true"
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-[var(--surface-panel-muted)] hover:text-foreground"
        aria-label={t("orders2b1.new.closeAria")}
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
    </section>
  );
}

function buildHistoryDevicesFromDetail(detail: CustomerDetail) {
  const byKey = new Map<string, CustomerHistoryDeviceCandidate>();

  for (const device of detail.devices) {
    upsertHistoryDeviceCandidate(byKey, {
      id: `device:${device.id}`,
      customer_id: detail.customer.id,
      source: "customer_device",
      device_id: device.id,
      brand: device.brand,
      model: device.model,
      serial_or_imei: device.serial_or_imei,
      device_notes: device.device_notes,
    });
  }

  for (const order of detail.orders) {
    const fallback = splitDeviceLabel(order.device_label);
    const snapshot = order.device_snapshot ?? fallback;
    if (!snapshot?.brand && !snapshot?.model) continue;
    upsertHistoryDeviceCandidate(byKey, {
      id: `order:${order.id}`,
      customer_id: detail.customer.id,
      source: "order_history",
      device_id: detail.devices.some((device) => device.id === order.device_id)
        ? order.device_id
        : undefined,
      brand: snapshot.brand,
      model: snapshot.model,
      serial_or_imei: snapshot.serial_or_imei || order.device_imei || "",
      device_notes: snapshot.device_notes,
      last_seen_at: order.created_at,
      order_id: order.id,
      order_public_no: order.public_no,
    });
  }

  return [...byKey.values()].sort(compareHistoryDeviceCandidates).slice(0, 8);
}

function splitDeviceLabel(deviceLabel: string) {
  const normalized = deviceLabel.trim();
  if (!normalized || normalized === "-") return undefined;
  const [brand = "", ...modelParts] = normalized.split(/\s+/);
  return {
    brand,
    model: modelParts.join(" "),
    serial_or_imei: "",
    device_notes: undefined,
  };
}

function historyDeviceKey(
  candidate: Pick<CustomerHistoryDeviceCandidate, "brand" | "model" | "serial_or_imei">,
) {
  return [candidate.brand, candidate.model, candidate.serial_or_imei]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function upsertHistoryDeviceCandidate(
  byKey: Map<string, CustomerHistoryDeviceCandidate>,
  candidate: CustomerHistoryDeviceCandidate,
) {
  const brand = candidate.brand.trim();
  const model = candidate.model.trim();
  if (!brand && !model) return;
  const normalizedCandidate = {
    ...candidate,
    brand,
    model,
    serial_or_imei: candidate.serial_or_imei.trim(),
  };
  const key = historyDeviceKey(normalizedCandidate);
  const existing = byKey.get(key);
  byKey.set(key, mergeHistoryDeviceCandidate(existing, normalizedCandidate));
}

function mergeHistoryDeviceCandidate(
  existing: CustomerHistoryDeviceCandidate | undefined,
  candidate: CustomerHistoryDeviceCandidate,
) {
  if (!existing) return candidate;
  const candidateIsNewer = compareDate(candidate.last_seen_at, existing.last_seen_at) > 0;
  if (existing.source === "customer_device" && candidate.source === "order_history") {
    return {
      ...existing,
      last_seen_at: candidateIsNewer ? candidate.last_seen_at : existing.last_seen_at,
      order_id: candidate.order_id ?? existing.order_id,
      order_public_no: candidate.order_public_no ?? existing.order_public_no,
    };
  }
  if (existing.source === "order_history" && candidate.source === "customer_device") {
    return {
      ...candidate,
      last_seen_at: candidateIsNewer ? candidate.last_seen_at : existing.last_seen_at,
      order_id: existing.order_id,
      order_public_no: existing.order_public_no,
    };
  }
  return candidateIsNewer ? candidate : existing;
}

function compareHistoryDeviceCandidates(
  a: CustomerHistoryDeviceCandidate,
  b: CustomerHistoryDeviceCandidate,
) {
  const time = compareDate(b.last_seen_at, a.last_seen_at);
  if (time !== 0) return time;
  if (a.source !== b.source) return a.source === "customer_device" ? -1 : 1;
  return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "zh-CN");
}

function compareDate(a?: string, b?: string) {
  return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime();
}

function NewOrderMobileHeader({
  valid,
  missingItems,
  offlineStatus,
  onHeightChange,
}: {
  valid: boolean;
  missingItems: NewOrderMissingItem[];
  offlineStatus: NewOrderOfflineStatusSummary;
  onHeightChange?: (height: number) => void;
}) {
  const { t } = useLocale();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [missingExpanded, setMissingExpanded] = useState(false);

  useEffect(() => {
    if (valid) setMissingExpanded(false);
  }, [valid]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node || !onHeightChange) return;

    const update = () => {
      onHeightChange(node.getBoundingClientRect().height);
    };

    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <div ref={shellRef} className={repairOs.mobileFloatingHeaderShell}>
      <section className={cn(repairOs.mobileFloatingHeaderCard, "px-2.5 pb-2")}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <SidebarTrigger className="size-9 rounded-lg border border-[var(--border-panel)] bg-card shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold leading-4">
              {t("orders2b1.new.shortTitle")}
            </p>
          </div>
          <Button asChild variant="ghost" size="iconDense" className="size-9 rounded-lg">
            <Link href="/orders" aria-label={t("orders2b1.new.backOrders")}>
              <X className="size-4" />
            </Link>
          </Button>
        </header>

        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
              valid
                ? "bg-status-success text-status-success-foreground"
                : "bg-status-warn text-status-warn-foreground",
            )}
          >
            {valid ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            {t(valid ? "orders2b1.new.ready" : "orders2b1.new.incomplete")}
          </span>
        </div>

        <div className={cn(repairOs.mobileFloatingHeaderBody, "mt-1.5 pt-1.5")}>
          {!valid && missingItems.length > 0 ? (
            <div className="mt-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-between rounded-lg px-2 text-[10px] font-semibold"
                aria-expanded={missingExpanded}
                aria-controls="new-order-mobile-missing-list"
                onClick={() => setMissingExpanded((expanded) => !expanded)}
              >
                <span>
                  {t(
                    missingExpanded
                      ? "orders2b1.new.collapseMissing"
                      : "orders2b1.new.expandMissing",
                  )}
                </span>
                <span>{t("orders2b1.new.itemsCount", { count: missingItems.length })}</span>
              </Button>
              {missingExpanded ? (
                <ul
                  id="new-order-mobile-missing-list"
                  className="mt-1 grid max-h-52 gap-1 overflow-y-auto rounded-lg bg-[var(--surface-panel-muted)] p-1.5 text-[10px]"
                >
                  {missingItems.map((item) => (
                    <li key={`${item.code}-${item.fieldId}`}>
                      <button
                        type="button"
                        className="min-h-9 w-full rounded-md px-2 text-left font-medium text-status-warn-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => focusNewOrderMissingItem(item)}
                      >
                        {t("orders2b1.new.addField", { label: item.label })}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <NewOrderOfflineStatusLine status={offlineStatus} compact className="mt-1" />
        </div>
      </section>
    </div>
  );
}

function NewOrderOfflineStatusLine({
  status,
  compact,
  className,
}: {
  status: NewOrderOfflineStatusSummary;
  compact?: boolean;
  className?: string;
}) {
  const { locale, t } = useLocale();
  const copy = getNewOrderOfflineStatusCopy(status, locale, t);
  const isError = status.state === "error" || status.state === "unavailable";
  if (!copy && !status.hasSensitiveUnlockDraft) return null;

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      data-new-order-offline-status="true"
      className={cn(
        "flex min-w-0 items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-4",
        isError
          ? "bg-status-warn text-status-warn-foreground"
          : "bg-[var(--surface-panel-muted)] text-muted-foreground",
        compact
          ? "text-[9.5px] leading-3.5 lg:text-xs lg:leading-[18px]"
          : "text-[10px] leading-4 lg:text-xs lg:leading-[18px]",
        className,
      )}
    >
      <ClipboardList
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          isError ? "text-status-warn-foreground" : "text-primary",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2">{copy}</span>
        {status.hasSensitiveUnlockDraft ? (
          <span className="mt-0.5 block text-[9px] leading-3 lg:text-xs lg:leading-4">
            {t("orders2b1.new.unlockDraftWarning")}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function NewOrderOfflineRestoreCard({
  prompt,
  onRestore,
  onDiscard,
}: {
  prompt: NewOrderOfflineDraftPrompt;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section
      data-new-order-offline-restore-card="true"
      className={cn(
        repairOs.mobileInfoCard,
        "mb-2 grid min-w-0 gap-2 p-2.5 md:mb-3 md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:p-3 md:shadow-none lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3 lg:px-3 lg:py-2",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-4">
          <RotateCcw className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{t("orders2b1.new.offline.found")}</span>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground lg:truncate lg:text-xs lg:leading-[18px]">
          {t("orders2b1.new.offline.foundHelp", {
            time: formatOfflineDraftTime(prompt.updatedAt, locale, t),
          })}
        </p>
        {prompt.relationshipNeedsReview ? (
          <p className="mt-1 rounded-lg bg-status-warn/45 px-2 py-1 text-[10px] leading-4 text-status-warn-foreground lg:text-xs lg:leading-[18px]">
            {t("orders2b1.new.offline.review")}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-lg text-xs lg:h-8"
          onClick={onRestore}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          {t("orders2b1.new.offline.restore")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-lg text-xs lg:h-8"
          onClick={onDiscard}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          {t("orders2b1.new.offline.discard")}
        </Button>
      </div>
    </section>
  );
}

function NewOrderOfflineInlineNotice({
  tone,
  message,
  className,
}: {
  tone: "success" | "warning";
  message: string;
  className?: string;
}) {
  const isWarning = tone === "warning";
  return (
    <div
      role={isWarning ? "alert" : "status"}
      aria-live={isWarning ? "assertive" : "polite"}
      data-new-order-offline-notice="true"
      className={cn(
        "mb-2 rounded-xl px-2.5 py-2 text-[10px] font-medium leading-4 md:mb-3 md:text-xs lg:text-xs lg:leading-[18px]",
        isWarning
          ? "bg-status-warn text-status-warn-foreground"
          : "bg-status-success/45 text-status-success-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}

function getNewOrderOfflineStatusCopy(
  status: NewOrderOfflineStatusSummary,
  locale: ReturnType<typeof useLocale>["locale"],
  t: ReturnType<typeof useLocale>["t"],
) {
  if (!status.scopeReady) return t("orders2b1.new.offline.scope");
  switch (status.state) {
    case "checking":
      return t("orders2b1.new.offline.checking");
    case "ready":
      return t("orders2b1.new.offline.ready");
    case "saving":
      return t("orders2b1.new.offline.saving");
    case "saved":
      return status.lastSavedAt
        ? t("orders2b1.new.offline.savedAt", {
            time: formatOfflineDraftTime(status.lastSavedAt, locale, t),
          })
        : t("orders2b1.new.offline.saved");
    case "queued":
      return t("orders2b1.new.offline.queued");
    case "error":
    case "unavailable":
      return t("orders2b1.new.offline.unavailable");
    case "disabled":
      return t("orders2b1.new.offline.disabled");
  }
}

function formatOfflineDraftTime(
  value: string,
  locale: ReturnType<typeof useLocale>["locale"],
  t: ReturnType<typeof useLocale>["t"],
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("orders2b1.new.offline.justNow");
  return formatDateTime(date, locale, { hour: "2-digit", minute: "2-digit" });
}
