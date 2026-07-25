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
  getStoreContext,
  getStoreFaultCostDefaults,
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
import { OrderWorkspaceMoneyStrip } from "@/features/orders/components/order-workspace-primitives";
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
import { normalizeUnlockForCustody } from "@/features/orders/model/device-custody";
import { isRepairDeskOfflineSyncEnabled } from "@/features/offline/model/offline-sync-feature";
import { storeSettingsQueryOptions } from "@/features/messages/api/query-options";
import { orderWorkflowQueryOptions } from "@/features/orders/api/query-options";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  buildCreateOrderCostInputs,
  hasTouchedNewOrderCostDrafts,
  syncNewOrderCostDrafts,
  updateNewOrderCostDraft,
  type NewOrderCostDraft,
} from "@/features/orders/model/order-cost-draft";
import { synchronizeCreatedOrderNavigation } from "@/features/orders/api/cache-sync";
import { getWorkflowStatuses } from "@/features/orders/model/order-workflow";
import type { NewOrderPrefill } from "@/features/orders/model/new-order-intent";
import { platformKeys } from "@/features/platform/api/query-keys";
import { CACHE_TIMES } from "@/lib/query-performance";
import { detailWorkspace, layoutGuards, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { registerGuard } = useNavigationGuard();
  const [form, setForm] = useState<NewOrderFormState>(initialNewOrderForm);
  const [costDrafts, setCostDrafts] = useState<Record<string, NewOrderCostDraft>>({});
  const [isOnline, setIsOnline] = useState(true);
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

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const syncOnline = () => setIsOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
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
  const { data: storeContext } = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
    retry: false,
    staleTime: CACHE_TIMES.shell,
  });
  const costStoreId = storeContext?.activeStore?.id;
  const canManageOrderCosts = storeContext?.permissions?.can_manage_order_costs === true;
  const costDefaultsQuery = useQuery({
    queryKey: [...ordersKeys.all, "cost-defaults", costStoreId] as const,
    queryFn: () => getStoreFaultCostDefaults(costStoreId!),
    enabled: Boolean(costStoreId && canManageOrderCosts && costStoreId === activeStoreId),
    retry: false,
    staleTime: CACHE_TIMES.settings,
  });
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
  const { data: storeSettings } = useQuery({
    ...storeSettingsQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId),
  });
  const { data: workflow } = useQuery({
    ...orderWorkflowQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId),
  });
  const operatorName = hydratedOnboardingStatus?.displayName ?? "当前登录账号";
  const operatorRole = hydratedOnboardingStatus?.activeStore?.role;
  const defaultWarrantyMonths = storeSettings?.default_order_warranty_months ?? 6;
  const createStatuses = useMemo(
    () =>
      getWorkflowStatuses(workflow).filter((status) => status.enabled && status.allowed_for_create),
    [workflow],
  );
  const defaultCreateStatus =
    createStatuses.find((status) => status.is_default_create_status) ?? createStatuses[0];
  const selectedCreateStatus = createStatuses.find((status) => status.code === form.status);

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
  const hasCatalogCostLines = validFaultPrices.some((item) => Boolean(item.catalog_key));
  const costDefaultsBlocked =
    canManageOrderCosts &&
    hasCatalogCostLines &&
    (costDefaultsQuery.isPending || costDefaultsQuery.isError);
  useEffect(() => {
    if (!canManageOrderCosts) {
      setCostDrafts({});
      return;
    }
    setCostDrafts((current) =>
      syncNewOrderCostDrafts(current, draftFaultPrices, costDefaultsQuery.data?.items),
    );
  }, [canManageOrderCosts, costDefaultsQuery.data?.items, draftFaultPrices]);
  const createStatusLabel =
    selectedCreateStatus?.label ?? defaultCreateStatus?.label ?? form.status;

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

  const handlePickCustomer = useCallback((candidate: CustomerIntakeCandidate) => {
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
        ? `已选择客户 ${customerLabel}，请选择历史维修型号`
        : `已选择客户 ${customerLabel}`,
    );
  }, []);

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
            ? `已从客户档案带入：${customerLabel} / ${selectedDevice.brand} ${selectedDevice.model}`
            : `已从客户档案带入：${customerLabel}`,
        );
        applyPrefillIdentifier();
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") toast.error(error.message);
      });

    return () => {
      controller.abort();
    };
  }, [prefill?.customerId, prefill?.deviceId, prefill?.identifier, prefill?.key]);

  const completeOnlineOrderCreated = useCallback(
    async (id: string, options: { recovered?: boolean; replayed?: boolean } = {}) => {
      createOperationIdRef.current = null;
      setIdentityConflict(null);
      setSharedPhoneConfirmOpen(false);
      setCreateRecovery({ state: "idle" });
      void offlineDraft.discardCurrentDraft();
      toast.success(options.recovered || options.replayed ? "已确认工单已创建" : "工单已创建");
      await synchronizeCreatedOrderNavigation(queryClient, id, activeStoreId).catch(
        () => undefined,
      );
      if (onCreated) {
        onCreated(id);
      } else {
        router.push(`/orders/${id}`);
      }
    },
    [activeStoreId, offlineDraft, onCreated, queryClient, router],
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
      toast.error("暂时无法确认创建结果，请先查看工单列表，避免重复创建");
    },
    [completeOnlineOrderCreated],
  );

  const create = useMutation({
    mutationFn: async (
      identityResolution: CustomerIdentityResolution = { mode: "auto" },
    ): Promise<
      | { kind: "online"; id: string; replayed?: boolean }
      | { kind: "offline_queued"; operationId: string }
    > => {
      const custodyStatus = form.deviceCustodyStatus;
      if (!custodyStatus) throw new Error("请确认设备是否留店");
      if (costDefaultsBlocked) {
        throw new Error("默认成本尚未成功读取，请重试后再创建工单");
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (identityResolution.mode !== "auto") {
          throw new Error("客户身份确认需要联网完成，请恢复网络后重试");
        }
        if (canManageOrderCosts && Object.values(costDrafts).some((draft) => draft.touched)) {
          throw new Error("内部成本仅支持联网保存；请恢复网络后创建，或清除本次成本修改");
        }
        if (!isRepairDeskOfflineSyncEnabled()) {
          throw new Error("离线创建尚未启用，请恢复网络后创建工单");
        }
        return {
          kind: "offline_queued",
          operationId: await offlineDraft.queueCurrentDraftForSync(),
        };
      }
      const operationId = createOperationIdRef.current ?? createRepairDeskCreateOperationId();
      createOperationIdRef.current = operationId;
      const result = await createOrder({
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
        ...(canManageOrderCosts && validFaultPrices.length > 0
          ? { cost_inputs: buildCreateOrderCostInputs(validFaultPrices, costDrafts) }
          : {}),
        deposit_amount: activeDeposit,
      });
      return { kind: "online", id: result.id, replayed: result.replayed };
    },
    onSuccess: (result) => {
      if (result.kind === "offline_queued") {
        toast.success("工单已保存在本机，联网后会自动同步");
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
          setIdentityConflict(conflict);
          setCreateRecovery({ state: "idle" });
          return;
        }
      }
      if (isRepairDeskRequestTimeoutError(error) && createOperationIdRef.current) {
        toast.message("创建请求仍在确认中，请不要重复提交");
        void confirmCreateOperation(createOperationIdRef.current);
        return;
      }
      createOperationIdRef.current = null;
      setCreateRecovery({ state: "idle" });
      toast.error(getCreateOrderErrorMessage(error));
    },
  });

  const customerIdentityCreationBlocked = customerIntakePolicyBlocksSubmit(customerIdentityIntent);
  const valid =
    form.deviceCustodyStatus !== null &&
    form.customerPhone.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    activeDeposit <= activeTotal &&
    !costDefaultsBlocked &&
    !customerIdentityCreationBlocked &&
    (!warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) ||
      form.warrantyChangeReason.trim());
  const missingItems = useMemo(
    () =>
      getNewOrderMissingItems({
        form,
        total,
        defaultWarrantyMonths,
        costDefaultsBlocked,
        customerIdentityCreationBlocked,
      }),
    [costDefaultsBlocked, customerIdentityCreationBlocked, defaultWarrantyMonths, form, total],
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
    toast.success("已恢复本机草稿");
  }, [offlineDraft]);

  const handleDiscardOfflineDraft = useCallback(async () => {
    const discarded = await offlineDraft.discardPromptDraft();
    if (!discarded) return;
    setDiscardDraftDialogOpen(false);
    toast.success("本机草稿已丢弃");
  }, [offlineDraft]);

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
      ? "请求超时，正在确认是否已经创建。请不要重复提交或刷新。"
      : createRecovery.state === "uncertain"
        ? "暂时无法确认创建结果，请使用页面提示打开工单或客户列表检查，避免重复创建。"
        : create.isPending
          ? "正在提交工单，请保持页面打开。"
          : customerIdentityCreationBlocked
            ? "客户身份尚未解决，请先使用已有客户，或修改资料后重新确认。"
            : undefined;
  const guardSnapshotRef = useRef({
    surface,
    offlineDraft,
    hasTouchedCostDrafts: hasTouchedNewOrderCostDrafts(costDrafts),
    createPending: create.isPending,
    createRecoveryState: createRecovery.state,
  });
  guardSnapshotRef.current = {
    surface,
    offlineDraft,
    hasTouchedCostDrafts: hasTouchedNewOrderCostDrafts(costDrafts),
    createPending: create.isPending,
    createRecoveryState: createRecovery.state,
  };

  useEffect(
    () =>
      registerGuard({
        id: "orders-new-draft",
        label: () => "新建工单草稿",
        isDirty: () => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.surface !== "page") return false;
          return (
            Boolean(snapshot.offlineDraft.draftPrompt) ||
            snapshot.offlineDraft.isCurrentDraftDirty() ||
            snapshot.hasTouchedCostDrafts ||
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
            !snapshot.hasTouchedCostDrafts &&
            !snapshot.createPending &&
            snapshot.createRecoveryState === "idle" &&
            snapshot.offlineDraft.state !== "unavailable"
          );
        },
        saveUnavailableReason: () => {
          const snapshot = guardSnapshotRef.current;
          if (snapshot.createPending || snapshot.createRecoveryState !== "idle") {
            return "工单正在创建或确认结果，请先留在当前页面。";
          }
          if (snapshot.offlineDraft.draftPrompt) {
            return "请先恢复或丢弃已有本机草稿，再离开页面。";
          }
          if (snapshot.offlineDraft.hasSensitiveUnlockDraft) {
            return "手机密码、PIN 或图案不会进入本机草稿；请先清除或选择放弃修改。";
          }
          if (snapshot.hasTouchedCostDrafts) {
            return "内部成本不会保存到本机；请留在当前页面提交工单，或选择放弃成本修改。";
          }
          if (snapshot.offlineDraft.state === "unavailable") {
            return "本机草稿不可用，无法确认保存后离开。";
          }
          return "当前草稿暂时无法保存。";
        },
        save: async (): Promise<NavigationGuardResolution> => {
          const snapshot = guardSnapshotRef.current;
          if (
            snapshot.createPending ||
            snapshot.createRecoveryState !== "idle" ||
            snapshot.offlineDraft.draftPrompt ||
            snapshot.offlineDraft.hasSensitiveUnlockDraft ||
            snapshot.hasTouchedCostDrafts
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
          setCostDrafts({});
          setHistoryDevices([]);
          return { status: "resolved" };
        },
        focusFallback: () => {
          document.querySelector<HTMLElement>("[data-new-order-form='true'] input")?.focus();
        },
      }),
    [registerGuard],
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
      <h1 className="sr-only">新建维修工单</h1>
      {surface === "page" ? (
        <NewOrderMobileHeader
          operatorName={operatorName}
          statusLabel={createStatusLabel}
          valid={Boolean(valid)}
          total={activeTotal}
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
          if (createRecovery.state === "confirming" || createRecovery.state === "uncertain") {
            toast.message(
              createRecovery.state === "confirming"
                ? "正在确认创建结果，请稍候"
                : "请先查看工单列表确认是否已创建，避免重复提交",
            );
            return;
          }
          if (!valid) {
            const normalizedMissingItems = missingItems.length
              ? missingItems
              : [fallbackNewOrderMissingItem];
            setValidationAttempted(true);
            setSubmitValidationMessage(
              `无法创建工单，共有 ${normalizedMissingItems.length} 项需要处理：${normalizedMissingItems
                .map((item) => item.label)
                .join("、")}`,
            );
            focusNewOrderMissingItem(normalizedMissingItems[0]);
            toast.error(
              form.deviceCustodyStatus === null
                ? "请确认设备是否留店"
                : customerIdentityCreationBlocked
                  ? "请先使用已有客户，或修改姓名、电话后重新确认客户身份"
                  : form.deposit > total
                    ? "定金不能超过订单总金额"
                    : warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) &&
                        !form.warrantyChangeReason.trim()
                      ? "非默认质保需要填写原因"
                      : "请补全必填字段",
            );
            return;
          }
          setIdentityConflict(null);
          create.mutate({ mode: "auto" });
        }}
        className={cn(
          "min-w-0 pb-32 sm:pb-20",
          surface === "page" &&
            cn(
              repairOs.mobileFloatingPage,
              "scroll-pb-[calc(env(safe-area-inset-bottom)+12rem)] pb-[calc(env(safe-area-inset-bottom)+12rem)] md:pb-20 lg:pt-0",
            ),
          surface === "dialog" &&
            "h-full max-h-[calc(100svh-16px)] overflow-y-auto p-2 pb-[calc(env(safe-area-inset-bottom)+9rem)] pt-3 sm:max-h-[calc(100svh-32px)] sm:p-3 sm:pt-3 md:p-4 md:pt-3 lg:flex lg:min-h-0 lg:flex-col lg:pb-3",
        )}
      >
        <p id="new-order-validation-summary" className="sr-only" role="alert" aria-live="assertive">
          {submitValidationMessage}
        </p>
        {surface === "page" ? (
          <div className="mb-2 hidden min-w-0 justify-end gap-2 lg:flex lg:mb-3">
            <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" asChild>
              <Link href="/orders" aria-label="关闭">
                <X className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}

        {surface === "dialog" && onCancel ? (
          <NewOrderDialogMobileHeader
            operatorName={operatorName}
            statusLabel={createStatusLabel}
            valid={Boolean(valid)}
            onClose={onCancel}
          />
        ) : null}

        <NewOrderDesktopHeader
          operatorName={operatorName}
          statusLabel={createStatusLabel}
          valid={Boolean(valid)}
          total={activeTotal}
          deposit={activeDeposit}
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
              message={offlineDraft.errorMessage ?? "本机草稿暂不可用，请不要刷新页面。"}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-background"
              onClick={offlineDraft.retryPreflight}
            >
              <RotateCcw className="mr-1.5 size-4" /> 重新检查
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
            <NewOrderDeviceInfoSection
              form={form}
              setForm={setForm}
              historyDevices={historyDevices}
              onSelectHistoryDevice={selectHistoryDevice}
              surface={surface}
            />
          </div>

          <NewOrderQuotationSection
            form={form}
            setForm={setForm}
            total={total}
            operatorName={operatorName}
            operatorRole={operatorRole}
            onPatchFault={patchFault}
            onAddCustomFault={addCustomFault}
            canManageOrderCosts={canManageOrderCosts}
            costDrafts={costDrafts}
            costDefaultsPending={costDefaultsQuery.isPending && canManageOrderCosts}
            costDefaultsError={costDefaultsQuery.isError && canManageOrderCosts}
            isOnline={isOnline}
            onRetryCostDefaults={() => void costDefaultsQuery.refetch()}
            onCostDraftChange={(lineId, text) =>
              setCostDrafts((current) => ({
                ...current,
                [lineId]: updateNewOrderCostDraft(text),
              }))
            }
            createStatuses={createStatuses}
            defaultWarrantyMonths={defaultWarrantyMonths}
            surface={surface}
          />

          <div className="grid min-w-0 content-start gap-1.5 sm:gap-3 md:col-start-1 md:row-start-2 lg:col-start-3 lg:row-start-1">
            <NewOrderDeviceUnlockSection form={form} setForm={setForm} surface={surface} />
          </div>
        </div>

        <NewOrderSubmitBar
          valid={Boolean(valid)}
          pending={createSubmitBlocked}
          statusMessage={createSubmitMessage}
          custodyStatus={form.deviceCustodyStatus}
          onCancel={onCancel}
          surface={surface}
          validationSummaryId="new-order-validation-summary"
        />
      </form>

      <AlertDialog open={discardDraftDialogOpen} onOpenChange={setDiscardDraftDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>丢弃本机草稿</AlertDialogTitle>
            <AlertDialogDescription>
              只会删除此设备上的本机草稿，不会删除或修改任何系统工单。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 lg:h-9">取消</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 lg:h-9"
              onClick={() => {
                void handleDiscardOfflineDraft();
              }}
            >
              确认丢弃
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
            <AlertDialogTitle>确认这张工单属于哪位客户</AlertDialogTitle>
            <AlertDialogDescription>
              电话号码已关联其他客户，但本次填写了不同姓名。未确认前不会创建工单、设备或修改客户资料。
            </AlertDialogDescription>
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
                使用已有客户：{candidate.displayName || "未命名客户"}
              </Button>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="h-11 lg:h-9"
              disabled={create.isPending}
              onClick={() => setSharedPhoneConfirmOpen(true)}
            >
              这是另一位客户（共用电话）
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 lg:h-9">返回检查</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sharedPhoneConfirmOpen} onOpenChange={setSharedPhoneConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认创建独立客户</AlertDialogTitle>
            <AlertDialogDescription>
              将保留当前填写的姓名，并创建一位共用此电话号码的独立客户。已有客户资料不会被改名。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 lg:h-9">返回</AlertDialogCancel>
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
              确认独立创建
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

function getCreateOrderErrorMessage(error: Error) {
  const message = error.message || "创建工单失败";
  if (/public_no/i.test(message) || /repair_orders_public_no/i.test(message)) {
    return "创建工单失败：工单编号生成失败，请重试或联系管理员";
  }
  return message;
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
            {confirming ? "正在确认创建结果" : "创建结果暂时无法确认"}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-4">
          {confirming
            ? "请求已发送，但浏览器没有及时收到结果。系统正在用本次操作标识确认是否已经创建工单。"
            : "不要再次点击创建。请先打开工单列表或客户列表检查是否已经生成记录，也可以重新确认一次结果。"}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="h-11 rounded-xl text-xs lg:h-8" asChild>
          <Link href="/orders">
            <ClipboardList className="mr-1.5 size-3.5" />
            查看工单列表
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 rounded-xl border-status-warn/70 bg-background/80 text-xs lg:h-8"
          asChild
        >
          <Link href="/customers">打开客户列表</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 rounded-xl text-xs lg:h-8"
          disabled={confirming}
          onClick={onRetry}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          重新确认
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

const fallbackNewOrderMissingItem: NewOrderMissingItem = {
  code: "required",
  fieldId: "customerPhone",
  sectionId: "customer",
  label: "必填资料",
  target: "customer-phone",
};

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
  costDefaultsBlocked,
  customerIdentityCreationBlocked,
}: {
  form: NewOrderFormState;
  total: number;
  defaultWarrantyMonths: number;
  costDefaultsBlocked: boolean;
  customerIdentityCreationBlocked: boolean;
}): NewOrderMissingItem[] {
  const items: Array<NewOrderMissingItem | null> = [
    !form.customerPhone.trim()
      ? {
          code: "required",
          fieldId: "customerPhone",
          sectionId: "customer",
          label: "客户电话",
          target: "customer-phone",
        }
      : null,
    customerIdentityCreationBlocked
      ? {
          code: "identity_conflict",
          fieldId: "customerPhone",
          sectionId: "customer",
          label: "客户身份需处理",
          target: "customer-phone",
        }
      : null,
    form.deviceCustodyStatus === null
      ? {
          code: "required",
          fieldId: "deviceCustodyStatus",
          sectionId: "device",
          label: "设备保管",
          target: "device-custody",
        }
      : null,
    !form.brand.trim()
      ? {
          code: "required",
          fieldId: "brand",
          sectionId: "device",
          label: "设备品牌",
          target: "device-brand",
        }
      : null,
    !form.model.trim()
      ? {
          code: "required",
          fieldId: "model",
          sectionId: "device",
          label: "设备型号",
          target: "device-model",
        }
      : null,
    form.deposit > total
      ? {
          code: "deposit_exceeds_total",
          fieldId: "deposit",
          sectionId: "quotation",
          label: "定金不能超过总额",
          target: "deposit",
        }
      : null,
    costDefaultsBlocked
      ? {
          code: "cost_defaults_pending",
          fieldId: "faults",
          sectionId: "quotation",
          label: "默认成本尚未读取",
          target: "quotation",
        }
      : null,
    warrantyReasonRequired(form.warrantyMonths, defaultWarrantyMonths) &&
    !form.warrantyChangeReason.trim()
      ? {
          code: "warranty_reason_required",
          fieldId: "warrantyChangeReason",
          sectionId: "quotation",
          label: "质保变更原因",
          target: "warranty-reason",
        }
      : null,
  ];

  return items.filter((item): item is NewOrderMissingItem => item !== null);
}

function NewOrderDesktopHeader({
  operatorName,
  statusLabel,
  valid,
  total,
  deposit,
  missingItems,
  surface,
  offlineStatus,
  onClose,
}: {
  operatorName: string;
  statusLabel: string;
  valid: boolean;
  total: number;
  deposit: number;
  missingItems: NewOrderMissingItem[];
  surface: "page" | "dialog";
  offlineStatus: NewOrderOfflineStatusSummary;
  onClose?: () => void;
}) {
  const balance = Math.max(0, total - deposit);
  return (
    <section
      data-new-order-desktop-header="true"
      className={cn(
        "relative mb-3 hidden min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3 shadow-none lg:grid lg:grid-cols-[minmax(180px,0.8fr)_minmax(280px,1.2fr)] lg:items-center lg:gap-3 xl:grid-cols-[minmax(220px,0.75fr)_minmax(340px,1fr)_minmax(330px,1.05fr)]",
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
          aria-label="关闭新建维修工单"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      ) : null}
      <div className="min-w-0">
        <div className="text-[11px] font-medium leading-4 text-muted-foreground">
          {surface === "dialog" ? "弹窗录入" : "工作台录入"}
        </div>
        <p className="truncate text-lg font-semibold leading-6">新建维修工单</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{operatorName}</span>
          <span className="size-1 rounded-full bg-muted-foreground/35" />
          <span className="truncate">创建后进入 {statusLabel}</span>
        </div>
        <NewOrderOfflineStatusLine status={offlineStatus} className="mt-2" />
      </div>

      <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-2">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold leading-4">
            {valid ? "资料已齐全" : `还差 ${missingItems.length || 1} 项`}
          </span>
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
              valid
                ? "bg-status-success text-status-success-foreground"
                : "bg-status-warn text-status-warn-foreground",
            )}
          >
            {valid ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            {valid ? "可创建" : "待补全"}
          </span>
        </div>
        {valid ? (
          <p className="rounded-md bg-status-success/35 px-2 py-1.5 text-[10px] font-medium text-status-success-foreground">
            可以创建；系统会保留设备保管、密码和金额记录。
          </p>
        ) : (
          <div data-new-order-missing-items="true" className="flex min-w-0 flex-wrap gap-1.5">
            {(missingItems.length ? missingItems : [fallbackNewOrderMissingItem]).map((item) => (
              <button
                key={`${item.target}-${item.label}`}
                type="button"
                className="inline-flex h-11 items-center rounded-md border border-status-warn-foreground/20 bg-background px-2 text-[10px] font-medium text-status-warn-foreground transition-colors hover:bg-status-warn/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7"
                onClick={() => focusNewOrderMissingItem(item)}
              >
                补充：{item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        data-new-order-header-finance="true"
        className="grid min-w-0 gap-1.5 md:col-span-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center xl:col-span-1 xl:grid-cols-1"
      >
        <OrderWorkspaceMoneyStrip
          total={total}
          deposit={deposit}
          balance={balance}
          compact
          variant="finance"
        />
        <div className="flex min-w-0 items-center justify-self-start gap-1.5 rounded-full bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary xl:justify-self-end">
          <ClipboardList className="size-3" />
          <span className="truncate">{statusLabel}</span>
        </div>
      </div>
    </section>
  );
}

function NewOrderDialogMobileHeader({
  operatorName,
  statusLabel,
  valid,
  onClose,
}: {
  operatorName: string;
  statusLabel: string;
  valid: boolean;
  onClose: () => void;
}) {
  return (
    <section
      data-new-order-dialog-mobile-header="true"
      className="mb-2 flex min-w-0 items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2 shadow-none md:hidden"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium leading-3 text-muted-foreground">弹窗录入</div>
        <div className="truncate text-sm font-semibold leading-5">新建维修工单</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate">{operatorName}</span>
          <span className="size-1 rounded-full bg-muted-foreground/35" />
          <span className="truncate">创建后进入 {statusLabel}</span>
        </div>
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
        {valid ? "可创建" : "待补全"}
      </span>
      <Button
        data-new-order-dialog-close="true"
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-xl text-muted-foreground hover:bg-[var(--surface-panel-muted)] hover:text-foreground"
        aria-label="关闭新建维修工单"
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
  operatorName,
  statusLabel,
  valid,
  total,
  missingItems,
  offlineStatus,
  onHeightChange,
}: {
  operatorName: string;
  statusLabel: string;
  valid: boolean;
  total: number;
  missingItems: NewOrderMissingItem[];
  offlineStatus: NewOrderOfflineStatusSummary;
  onHeightChange?: (height: number) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [missingExpanded, setMissingExpanded] = useState(false);
  const missingSummary = missingItems.length
    ? `${missingItems
        .slice(0, 3)
        .map((item) => item.label)
        .join("、")}${missingItems.length > 3 ? `，另有 ${missingItems.length - 3} 项` : ""}`
    : "必填资料";
  const helperText = valid
    ? `资料已补全，创建后进入「${statusLabel}」。`
    : `还差：${missingSummary}`;

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
          <SidebarTrigger className="size-11 rounded-lg border border-[var(--border-panel)] bg-card shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold leading-4">新建工单</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">{operatorName}</p>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-11 rounded-lg">
            <Link href="/orders" aria-label="返回工单列表">
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
            {valid ? "可创建" : "待补全"}
          </span>
        </div>

        <div className={cn(repairOs.mobileFloatingHeaderBody, "mt-1.5 pt-1.5")}>
          <div
            className={cn(
              "flex min-w-0 items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-4",
              valid
                ? "bg-status-success/45 text-status-success-foreground"
                : "bg-[var(--surface-panel-muted)] text-muted-foreground",
            )}
          >
            <ClipboardList
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                valid ? "text-status-success-foreground" : "text-primary",
              )}
            />
            <span className="min-w-0 flex-1">
              <span>{helperText}</span>
            </span>
          </div>
          {!valid && missingItems.length > 0 ? (
            <div className="mt-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 w-full justify-between rounded-lg px-2 text-[10px] font-semibold"
                aria-expanded={missingExpanded}
                aria-controls="new-order-mobile-missing-list"
                onClick={() => setMissingExpanded((expanded) => !expanded)}
              >
                <span>{missingExpanded ? "收起缺失清单" : "查看完整缺失清单"}</span>
                <span>{missingItems.length} 项</span>
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
                        className="min-h-11 w-full rounded-md px-2 text-left font-medium text-status-warn-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => focusNewOrderMissingItem(item)}
                      >
                        补充：{item.label}
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
  const copy = getNewOrderOfflineStatusCopy(status);
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
        compact ? "text-[9.5px] leading-3.5" : "text-[10px] leading-4",
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
          <span className="mt-0.5 block text-[9px] leading-3">
            手机密码、PIN 或图案不会进入本机草稿，刷新后需重新输入。
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
          <span className="truncate">发现本机草稿</span>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground lg:truncate">
          这个草稿只保存在此设备，尚未创建系统工单。上次本机保存：
          {formatOfflineDraftTime(prompt.updatedAt)}。
        </p>
        {prompt.relationshipNeedsReview ? (
          <p className="mt-1 rounded-lg bg-status-warn/45 px-2 py-1 text-[10px] leading-4 text-status-warn-foreground">
            恢复后请重新确认客户或设备关联，再在线创建工单。
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-11 rounded-xl text-xs lg:h-8"
          onClick={onRestore}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          恢复本机草稿
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 rounded-xl text-xs lg:h-8"
          onClick={onDiscard}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          丢弃本机草稿
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
        "mb-2 rounded-xl px-2.5 py-2 text-[10px] font-medium leading-4 md:mb-3 md:text-xs",
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

function getNewOrderOfflineStatusCopy(status: NewOrderOfflineStatusSummary) {
  if (!status.scopeReady) return "本机草稿需登录店铺后启用。";
  switch (status.state) {
    case "checking":
      return "正在检查本机草稿。";
    case "ready":
      return "本机草稿可用，仅此设备可见，尚未创建系统工单。";
    case "saving":
      return "正在保存本机草稿。";
    case "saved":
      return status.lastSavedAt
        ? `本机草稿已保存 ${formatOfflineDraftTime(status.lastSavedAt)}，仅此设备可见。`
        : "本机草稿已保存，仅此设备可见。";
    case "queued":
      return "工单已进入本机同步队列，联网后会自动创建。";
    case "error":
    case "unavailable":
      return status.errorMessage ?? "本机草稿暂不可用，请不要刷新页面。";
    case "disabled":
      return "本机草稿未启用。";
  }
}

function formatOfflineDraftTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
