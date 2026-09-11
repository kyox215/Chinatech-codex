"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  CircleAlert,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

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
import { useIsMobile } from "@/hooks/use-mobile";
import { NewOrderMobileWorkspace } from "@/features/orders/forms/new-order-mobile-workspace";
import { toast } from "sonner";

import {
  createOrder,
  getCustomerDetail,
  getOnboardingStatus,
  getOrderCreateOperationStatus,
  isRepairDeskRequestTimeoutError,
  RepairDeskApiError,
  RepairDeskTransportError,
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
import { NewOrderSupplements } from "@/features/orders/forms/new-order-supplements";
import { useNewOrderPhotos } from "@/features/orders/api/use-new-order-photos";
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
  const isMobile = useIsMobile();
  const [mobileValidation, setMobileValidation] = useState<{
    target: string;
    generation: number;
  } | null>(null);
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
  const createInFlightRef = useRef(false);
  const [floatingHeaderOffset, setFloatingHeaderOffset] = useState(
    "calc(env(safe-area-inset-top) + 5.5rem)",
  );
  const [hydrated, setHydrated] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const createdOrderIdRef = useRef<string | null>(null);
  const [leavePhotosOpen, setLeavePhotosOpen] = useState(false);
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
  const sessionInvalidatedRef = useRef(false);
  const sessionOfflineScopeRef = useRef<typeof offlineScope>(null);
  const committedScope = sessionOfflineScopeRef.current;
  const initialScope = committedScope ?? offlineScope;
  useLayoutEffect(() => {
    // Bind only a committed first scope; abandoned startup renders own no draft.
    if (!sessionOfflineScopeRef.current && offlineScope)
      sessionOfflineScopeRef.current = offlineScope;
  }, [offlineScope]);
  if (
    committedScope &&
    (committedScope.storeId !== onboardingStatus?.activeStore?.id ||
      committedScope.userId !== onboardingStatus?.userId)
  )
    sessionInvalidatedRef.current = true;
  const offlineDraft = useNewOrderOfflineAutosave({
    form,
    scope: initialScope,
    enabled: !createdOrderId && !sessionInvalidatedRef.current,
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
  if (isNewOrderSessionStoreChanged(sessionStoreId, onboardingStatus?.activeStore?.id))
    sessionInvalidatedRef.current = true;
  const sessionStoreChanged = sessionInvalidatedRef.current;
  const photoScope = offlineScope ? `${offlineScope.storeId}:${offlineScope.userId}` : null;
  const photoDraft = useNewOrderPhotos(photoScope, !sessionStoreChanged && Boolean(photoScope));
  const activePhotoScopeRef = useRef(photoScope);
  activePhotoScopeRef.current = photoScope;
  const completionRef = useRef({ mounted: true, scope: photoScope, generation: 0 });
  if (completionRef.current.scope !== photoScope) {
    completionRef.current.scope = photoScope;
    completionRef.current.generation += 1;
  }
  useEffect(() => {
    completionRef.current.mounted = true;
    return () => {
      completionRef.current.mounted = false;
      completionRef.current.generation += 1;
    };
  }, []);
  const isCompletionCurrent = useCallback(
    (generation: number) =>
      completionRef.current.mounted &&
      !sessionInvalidatedRef.current &&
      completionRef.current.generation === generation,
    [],
  );

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

  const finishOnlineOrderCreated = useCallback(
    async (id: string, options: { recovered?: boolean; replayed?: boolean } = {}) => {
      const generation = completionRef.current.generation;
      if (!isCompletionCurrent(generation)) return;
      createOperationIdRef.current = null;
      setIdentityConflict(null);
      setSharedPhoneConfirmOpen(false);
      setCreateRecovery({ state: "idle" });
      photoDraft.discard();
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
      if (!isCompletionCurrent(generation)) return;
      if (onCreated) {
        onCreated(id);
      } else {
        router.push(`/orders/${id}`);
      }
    },
    [
      activeStoreId,
      isCompletionCurrent,
      offlineDraft,
      onCreated,
      photoDraft,
      queryClient,
      router,
      t,
    ],
  );

  const completeOnlineOrderCreated = useCallback(
    async (id: string, options: { recovered?: boolean; replayed?: boolean } = {}) => {
      const generation = completionRef.current.generation;
      if (!isCompletionCurrent(generation)) return;
      if (createdOrderIdRef.current && createdOrderIdRef.current !== id) return;
      createdOrderIdRef.current = id;
      setCreatedOrderId(id);
      setIdentityConflict(null);
      setSharedPhoneConfirmOpen(false);
      setCreateRecovery({ state: "idle" });
      await offlineDraft.discardCurrentDraft();
      if (!isCompletionCurrent(generation)) return;
      const scopeAtCreate = photoScope;
      const uploaded = await photoDraft.upload(id);
      if (
        !uploaded &&
        isCompletionCurrent(generation) &&
        scopeAtCreate === activePhotoScopeRef.current
      ) {
        await synchronizeCreatedOrderNavigation(queryClient, id, activeStoreId).catch(
          () => undefined,
        );
      }
      if (
        uploaded &&
        isCompletionCurrent(generation) &&
        scopeAtCreate === activePhotoScopeRef.current
      ) {
        await finishOnlineOrderCreated(id, options);
      }
    },
    [
      activeStoreId,
      finishOnlineOrderCreated,
      isCompletionCurrent,
      offlineDraft,
      photoDraft,
      photoScope,
      queryClient,
    ],
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
      if (createdOrderIdRef.current) throw new Error(t("orders.newFlow.createdPhotos"));
      if (sessionStoreChanged) {
        throw new Error(t("orders2b1.new.error.storeChanged"));
      }
      const custodyStatus = form.deviceCustodyStatus;
      if (!custodyStatus) throw new Error(t("orders2b1.new.error.custody"));
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (photoDraft.photos.length) throw new Error(t("orders.newFlow.offlinePhotos"));
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
        issue_description: form.issueDescription,
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
      createInFlightRef.current = false;
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
      createInFlightRef.current = false;
      if (
        error instanceof RepairDeskApiError &&
        error.status === 409 &&
        error.code === "CUSTOMER_IDENTITY_CONFLICT"
      ) {
        const conflict = readNewOrderIdentityConflict(error.details);
        if (conflict) {
          setIdentityConflict(conflict);
          setCreateRecovery({ state: "idle" });
          return;
        }
      }
      if (
        (error instanceof RepairDeskTransportError || isRepairDeskRequestTimeoutError(error)) &&
        createOperationIdRef.current
      ) {
        toast.message(t("orders2b1.new.recovery.confirming"));
        void confirmCreateOperation(createOperationIdRef.current);
        return;
      }
      createOperationIdRef.current = null;
      setCreateRecovery({ state: "idle" });
      toast.error(getCreateOrderErrorMessage(error, t));
    },
  });

  const submitCreate = (resolution: CustomerIdentityResolution) => {
    if (createInFlightRef.current || createdOrderIdRef.current || sessionStoreChanged) return;
    createInFlightRef.current = true;
    create.mutate(resolution);
  };

  const customerIdentityCreationBlocked = customerIntakePolicyBlocksSubmit(customerIdentityIntent);
  const valid =
    (effectiveEntryMode !== "simple" || diagnosisDeferred || validFaultDrafts.length > 0) &&
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
    () => [
      ...getNewOrderMissingItems({
        form,
        total,
        defaultWarrantyMonths,
        customerIdentityCreationBlocked,
        selectedCreateStatus,
        t,
      }),
      ...(effectiveEntryMode === "simple" && !diagnosisDeferred && !validFaultDrafts.length
        ? [
            {
              code: "diagnosis_required",
              fieldId: "faults",
              sectionId: "quotation" as const,
              label: t("orders2b1.new.validation.diagnosis"),
              target: "quotation",
            },
          ]
        : []),
    ],
    [
      customerIdentityCreationBlocked,
      defaultWarrantyMonths,
      diagnosisDeferred,
      effectiveEntryMode,
      form,
      selectedCreateStatus,
      total,
      t,
      validFaultDrafts.length,
    ],
  );

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
    created: Boolean(createdOrderId),
    state: offlineDraft.state,
    lastSavedAt: offlineDraft.lastSavedAt,
    errorMessage: offlineDraft.errorMessage,
    hasSensitiveUnlockDraft: offlineDraft.hasSensitiveUnlockDraft,
    scopeReady: Boolean(offlineScope),
  };
  const createSubmitBlocked =
    Boolean(createdOrderId) ||
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
    photos: photoDraft,
    createdOrderId,
  });
  guardSnapshotRef.current = {
    surface,
    offlineDraft,
    createPending: create.isPending,
    createRecoveryState: createRecovery.state,
    photos: photoDraft,
    createdOrderId,
  };

  useEffect(
    () =>
      registerGuard({
        id: "orders-new-draft",
        label: () => t("orders2b1.new.shortTitle"),
        isDirty: () => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.createdOrderId) return snapshot.photos.hasUnsaved;
          return (
            snapshot.photos.hasUnsaved ||
            Boolean(snapshot.offlineDraft.draftPrompt) ||
            snapshot.offlineDraft.isCurrentDraftDirty() ||
            snapshot.createPending ||
            snapshot.createRecoveryState !== "idle"
          );
        },
        isBusy: () => {
          const snapshot = guardSnapshotRef.current;
          return (
            snapshot.photos.state === "uploading" ||
            snapshot.createPending ||
            snapshot.createRecoveryState === "confirming" ||
            snapshot.createRecoveryState === "uncertain" ||
            snapshot.offlineDraft.state === "saving"
          );
        },
        canSave: () => {
          const snapshot = guardSnapshotRef.current;
          return (
            !snapshot.photos.hasUnsaved &&
            !snapshot.offlineDraft.draftPrompt &&
            !snapshot.offlineDraft.hasSensitiveUnlockDraft &&
            !snapshot.createPending &&
            snapshot.createRecoveryState === "idle" &&
            snapshot.offlineDraft.state !== "unavailable"
          );
        },
        saveUnavailableReason: () => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.photos.hasUnsaved) return t("orders.newFlow.photoLocal");
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
            snapshot.photos.hasUnsaved ||
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
          if (
            snapshot.photos.state === "uploading" ||
            snapshot.createPending ||
            snapshot.createRecoveryState !== "idle"
          ) {
            return { status: "blocked" };
          }
          const discarded = await snapshot.offlineDraft.discardSessionDrafts();
          if (!discarded) return { status: "blocked" };
          snapshot.photos.discard();
          // The guard reads isDirty again as soon as this promise resolves.
          // Publish the reset before it decides whether the requested close may run.
          flushSync(() => {
            setForm(initialNewOrderForm);
            setHistoryDevices([]);
          });
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
    >
      <NewOrderDeviceUnlockSection form={form} setForm={setForm} surface={surface} />
    </NewOrderDeviceInfoSection>
  );
  const quotationSectionNode = (
    part: "quote" | "settings" = "quote",
    draft = form,
    setDraft = setForm,
    expanded = false,
  ) => (
    <NewOrderQuotationSection
      form={draft}
      setForm={setDraft}
      total={total}
      operatorName={operatorName}
      operatorRole={operatorRole}
      onPatchFault={patchFault}
      onAddCustomFault={addCustomFault}
      createStatuses={createStatuses}
      defaultWarrantyMonths={defaultWarrantyMonths}
      surface={surface}
      layout="professional"
      part={part}
      mobileOverview={isMobile}
      expanded={expanded}
    />
  );

  return (
    <div
      data-new-order-root="true"
      data-new-order-surface={surface}
      className={cn(
        layoutGuards.noPageOverflow,
        "@container/new-order",
        surface === "dialog"
          ? cn(
              detailWorkspace.root,
              "mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-clip rounded-none border-0 shadow-none xl:my-4 xl:w-[calc(100%-32px)] xl:rounded-[var(--radius-lg)] xl:border xl:shadow-[var(--shadow-workspace)]",
            )
          : "mx-auto w-full min-w-0 max-w-[430px] overflow-x-hidden px-3.5 sm:max-w-2xl md:max-w-7xl md:px-5 md:pt-3 lg:px-6",
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
          if (createSubmitBlocked || createdOrderIdRef.current) return;
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
            if (isMobile)
              setMobileValidation((current) => ({
                target: normalizedMissingItems[0].target,
                generation: (current?.generation ?? 0) + 1,
              }));
            focusNewOrderMissingItem(normalizedMissingItems[0]);
            return;
          }
          setIdentityConflict(null);
          submitCreate({ mode: "auto" });
        }}
        className={cn(
          "min-w-0 scroll-pb-[calc(var(--new-order-submit-offset,7rem)+0.75rem)]",
          surface === "page" && cn(repairOs.mobileFloatingPage, "!pb-0 lg:pt-0"),
          surface === "dialog" && "flex min-h-0 flex-1 flex-col overflow-clip",
        )}
      >
        <p id="new-order-validation-summary" className="sr-only" role="alert" aria-live="assertive">
          {submitValidationMessage}
        </p>
        {surface === "dialog" ? (
          <div data-new-order-header="true" className="shrink-0 px-2 pt-2 sm:px-3 md:px-4 md:pt-3">
            {onCancel ? (
              <NewOrderDialogMobileHeader
                valid={Boolean(valid)}
                offlineStatus={offlineStatus}
                onClose={onCancel}
              />
            ) : null}
            <NewOrderDesktopHeader
              surface={surface}
              offlineStatus={offlineStatus}
              onClose={onCancel}
            />
          </div>
        ) : (
          <NewOrderDesktopHeader surface={surface} offlineStatus={offlineStatus} />
        )}

        <div
          data-new-order-scroll-body={surface === "dialog" ? "true" : undefined}
          className={
            surface === "dialog"
              ? "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [scrollbar-gutter:stable] sm:px-3 md:px-4"
              : "contents"
          }
        >
          {offlineDraft.draftPrompt ? (
            <NewOrderOfflineRestoreCard
              prompt={offlineDraft.draftPrompt}
              onRestore={handleRestoreOfflineDraft}
              confirmDiscard={discardDraftDialogOpen}
              onRequestDiscard={() => setDiscardDraftDialogOpen(true)}
              onCancelDiscard={() => setDiscardDraftDialogOpen(false)}
              onConfirmDiscard={() => {
                void handleDiscardOfflineDraft();
              }}
            />
          ) : null}

          {offlineDraft.pendingRestoreNotice ? (
            <NewOrderOfflineInlineNotice
              tone="success"
              message={offlineDraft.pendingRestoreNotice}
            />
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

          {createdOrderId ? (
            <section
              data-new-order-photo-result="true"
              role="status"
              className="mb-3 space-y-2 rounded-xl border border-border bg-status-warn p-3 text-status-warn-foreground"
            >
              <p className="font-semibold">{t("orders.newFlow.createdPhotos")}</p>
              <p className="text-sm">
                {t(
                  photoDraft.state === "idle" || photoDraft.state === "uploading"
                    ? "orders.newFlow.photoUploading"
                    : photoDraft.state === "blocked"
                      ? "orders.newFlow.photoBlocked"
                      : photoDraft.photos.some((photo) => photo.uploadState === "uncertain")
                        ? "orders.newFlow.photoUncertain"
                        : "orders.newFlow.photoRemaining",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {photoDraft.canRetry && photoDraft.state !== "idle" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sessionStoreChanged}
                    onClick={() => void completeOnlineOrderCreated(createdOrderId)}
                  >
                    {t("orders.newFlow.retryPhotos")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={
                    photoDraft.state === "idle" ||
                    photoDraft.state === "uploading" ||
                    sessionStoreChanged
                  }
                  onClick={() => {
                    if (photoDraft.hasUnsaved) setLeavePhotosOpen(true);
                    else void finishOnlineOrderCreated(createdOrderId);
                  }}
                >
                  {t("orders.newFlow.viewOrder")}
                </Button>
              </div>
            </section>
          ) : null}
          {effectiveEntryMode === null ? (
            <section
              data-new-order-mode-loading="true"
              className={cn(repairOs.mobileInfoCard, "animate-pulse p-4")}
              aria-busy="true"
            >
              <p className="text-sm">{t("orders2b1.new.modeLoading")}</p>
            </section>
          ) : (
            <>
              <fieldset disabled={createSubmitBlocked || sessionStoreChanged} className="min-w-0">
                {isMobile ? (
                  <NewOrderMobileWorkspace
                    form={form}
                    setForm={setForm}
                    historyDevices={historyDevices}
                    onPickCustomer={handlePickCustomer}
                    onClearCustomerContext={() => {
                      setHistoryDevices([]);
                      setIdentityConflict(null);
                      setCustomerIdentityIntent(null);
                      setSharedPhoneConfirmOpen(false);
                      createOperationIdRef.current = null;
                    }}
                    onNewCustomerIntentChange={setCustomerIdentityIntent}
                    disabled={createSubmitBlocked || sessionStoreChanged}
                    validationRequest={mobileValidation}
                    quote={
                      <>
                        {quotationSectionNode()}
                        {effectiveEntryMode === "simple" ? (
                          <Button
                            type="button"
                            variant={diagnosisDeferred ? "default" : "outline"}
                            aria-pressed={diagnosisDeferred}
                            className="min-h-11 whitespace-normal"
                            onClick={() => setDiagnosisDeferred((current) => !current)}
                          >
                            {t("orders2b1.new.diagnosisDeferred")}
                          </Button>
                        ) : null}
                      </>
                    }
                    photos={
                      <NewOrderSupplements
                        compact
                        notes={form.issueDescription}
                        onNotesChange={(issueDescription) =>
                          setForm((current) => ({ ...current, issueDescription }))
                        }
                        photos={photoDraft.photos}
                        onAdd={photoDraft.add}
                        onRemove={photoDraft.remove}
                        disabled={createSubmitBlocked || sessionStoreChanged}
                        locked={Boolean(createdOrderId)}
                      />
                    }
                    settings={(draft, setDraft) =>
                      quotationSectionNode("settings", draft, setDraft, true)
                    }
                    settingsSummary={`${t(form.type === "quick_repair" ? "orders2b1.new.quickRepair" : "orders2b1.new.dropoffRepair")} · ${selectedCreateStatus ? localizeOrderWorkflowStatusLabel(selectedCreateStatus, t) : form.status} · ${form.warrantyText}`}
                  />
                ) : (
                  <div
                    data-new-order-workspace-grid="true"
                    data-new-order-single-page="true"
                    className="grid min-w-0 items-start gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-3 @[1040px]/new-order:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)_minmax(0,0.85fr)]"
                  >
                    <div className="grid min-w-0 content-start gap-2 md:col-start-1 md:row-start-1">
                      {customerSectionNode}
                      {deviceSectionNode}
                    </div>
                    {quotationSectionNode()}
                    <div className="grid min-w-0 content-start gap-2 md:col-span-2 md:row-start-2 md:grid-cols-2 @[1040px]/new-order:col-span-1 @[1040px]/new-order:col-start-3 @[1040px]/new-order:row-start-1 @[1040px]/new-order:grid-cols-1">
                      {quotationSectionNode("settings")}
                      {effectiveEntryMode === "simple" ? (
                        <section className={cn(repairOs.mobileInfoCard, "p-2.5")}>
                          <Button
                            type="button"
                            variant={diagnosisDeferred ? "default" : "outline"}
                            aria-pressed={diagnosisDeferred}
                            className="min-h-11 w-full whitespace-normal"
                            onClick={() => setDiagnosisDeferred((current) => !current)}
                          >
                            {diagnosisDeferred ? <CheckCircle2 className="size-4" /> : null}
                            {t("orders2b1.new.diagnosisDeferred")}
                          </Button>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            {t("orders2b1.new.validation.diagnosis")}
                          </p>
                        </section>
                      ) : null}
                      <NewOrderSupplements
                        notes={form.issueDescription}
                        onNotesChange={(issueDescription) =>
                          setForm((current) => ({ ...current, issueDescription }))
                        }
                        photos={photoDraft.photos}
                        onAdd={photoDraft.add}
                        onRemove={photoDraft.remove}
                        disabled={createSubmitBlocked || sessionStoreChanged}
                        locked={Boolean(createdOrderId)}
                      />
                    </div>
                  </div>
                )}
              </fieldset>
              <div data-new-order-content-end="true" aria-hidden="true" className="h-px w-full" />
              {surface === "page" ? (
                <div
                  data-new-order-submit-spacer="true"
                  aria-hidden="true"
                  className="h-[calc(var(--new-order-submit-offset,7rem)+0.75rem)] w-full shrink-0 md:hidden"
                />
              ) : null}
            </>
          )}
        </div>
        {effectiveEntryMode !== null && !createdOrderId ? (
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
            total={total}
            missingCount={missingItems.length}
          />
        ) : null}
      </form>

      <AlertDialog open={leavePhotosOpen} onOpenChange={setLeavePhotosOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.newFlow.leavePhotosTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.newFlow.leavePhotosHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (createdOrderId) void finishOnlineOrderCreated(createdOrderId);
              }}
            >
              {t("orders.newFlow.leavePhotos")}
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
                  submitCreate({
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
                submitCreate({
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
    t("orders.newFlow.offlinePhotos"),
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
  created?: boolean;
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
  const services = target.closest<HTMLElement>("#new-order-service-fields");
  if (services?.hidden)
    document
      .querySelector<HTMLButtonElement>('[aria-controls="new-order-service-fields"]')
      ?.click();
  target.tabIndex = -1;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.focus({ preventScroll: true });
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
  surface,
  offlineStatus,
  onClose,
}: {
  surface: "page" | "dialog";
  offlineStatus: NewOrderOfflineStatusSummary;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  return (
    <header
      data-new-order-desktop-header="true"
      className="mb-3 hidden min-h-11 min-w-0 items-center justify-between gap-3 lg:flex"
    >
      <h2 className="text-base font-semibold">{t("orders2b1.new.title")}</h2>
      <NewOrderOfflineStatusLine status={offlineStatus} compact className="ml-auto" />
      {surface === "dialog" && onClose ? (
        <Button
          data-new-order-dialog-close="true"
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={t("orders2b1.new.closeAria")}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </header>
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
        className="size-11 shrink-0 rounded-lg text-muted-foreground hover:bg-[var(--surface-panel-muted)] hover:text-foreground"
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
  offlineStatus,
  onHeightChange,
}: {
  offlineStatus: NewOrderOfflineStatusSummary;
  onHeightChange?: (height: number) => void;
}) {
  const { t } = useLocale();
  const shellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = shellRef.current;
    if (!node || !onHeightChange) return;
    const update = () => onHeightChange(node.getBoundingClientRect().height);
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
    <div ref={shellRef} className={cn(repairOs.mobileFloatingHeaderShell, "!px-0 !pt-0 !pb-2")}>
      <section
        className={cn(
          repairOs.mobileFloatingHeaderCard,
          "!max-w-none !rounded-none !border-x-0 !border-t-0 !px-3 !py-0 !shadow-none",
        )}
      >
        <header
          className={cn(
            repairOs.mobileFloatingHeaderNav,
            "min-h-[52px] !grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] !gap-1.5",
          )}
        >
          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
            <Link href="/orders" aria-label={t("orders2b1.new.backOrders")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <p className="min-w-0 whitespace-normal py-2 text-sm font-semibold leading-5 [overflow-wrap:anywhere]">
            {t("orders2b1.new.shortTitle")}
          </p>
          <NewOrderOfflineStatusLine
            status={offlineStatus}
            compact
            className="min-w-0 !max-w-none !bg-transparent !px-0 !py-0"
          />
        </header>
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
  const copy = status.created
    ? t("orders.newFlow.createdPhotos")
    : getNewOrderOfflineStatusCopy(status, locale, t);
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
        {status.hasSensitiveUnlockDraft && !status.created ? (
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
  confirmDiscard,
  onRequestDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: {
  prompt: NewOrderOfflineDraftPrompt;
  onRestore: () => void;
  confirmDiscard: boolean;
  onRequestDiscard: () => void;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
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
      {confirmDiscard ? (
        <div
          data-new-order-offline-discard-confirmation="true"
          className="grid min-w-0 gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 p-2 lg:min-w-[280px]"
        >
          <p className="text-xs font-semibold text-foreground">{t("orders2b1.new.discardTitle")}</p>
          <p className="text-[10px] leading-4 text-muted-foreground lg:text-xs">
            {t("orders2b1.new.discardHelp")}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={onCancelDiscard}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onConfirmDiscard}>
              {t("orders2b1.new.discardConfirm")}
            </Button>
          </div>
        </div>
      ) : (
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
            onClick={onRequestDiscard}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            {t("orders2b1.new.offline.discard")}
          </Button>
        </div>
      )}
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
