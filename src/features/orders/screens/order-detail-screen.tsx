"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Calendar,
  Check,
  Clock3,
  CreditCard,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  MoreVertical,
  PackageCheck,
  PackageSearch,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  Save,
  ScanLine,
  Send,
  Smartphone,
  Store,
  TabletSmartphone,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import { ImeiScannerField, normalizeImeiIdentifier } from "@/components/imei-scanner-field";
import { DeviceCustodyBadge, MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import {
  FaultDiagnosisPicker,
  normalizeFaultPrices,
  toFaultPriceItems,
} from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  decideOrderApproval,
  confirmCancelledOrderReturn,
  createKioskSession,
  getRepairDeskOptions,
  getStoreSettings,
  listKioskDevices,
  listOrderWorkflow,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
  updateOrderCustody,
  uploadOrderAttachment,
  type UpdateOrderInput,
} from "@/lib/repairdesk/api";
import {
  CameraCaptureSheet,
  attachmentKindLabels,
  formatAttachmentSize,
  revokeAttachmentDraft,
  type AttachmentDraft,
} from "@/features/capture";
import {
  extractImeiCandidates,
  getPreferredImeiCandidate,
  type ImeiCandidate,
} from "@/features/capture/model/barcode-parser";
import { RepairOrderPrintSheet } from "@/features/orders/components/repair-order-print-sheet";
import { OrderDetailSkeleton } from "@/features/orders/components/order-detail-skeleton";
import { orderDetailQueryOptions } from "@/features/orders/api/query-options";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import { OrderSupplierPicker } from "@/features/suppliers/components/order-supplier-picker";
import {
  DeviceUnlockEditor,
  DeviceUnlockViewer,
} from "@/features/orders/components/device-unlock-fields";
import { OrderHero } from "@/features/orders/components/order-hero";
import { buildOrderPatchChanges } from "@/features/orders/model/order-edit-diff";
import { OrderPhotoPreviewDialog } from "@/features/orders/components/order-photo-preview-dialog";
import { OrderTerminalActions } from "@/features/orders/components/order-terminal-actions";
import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import {
  useEditOrderOfflineAutosave,
  type EditOrderOfflineAutosaveState,
  type EditOrderOfflineDraftPrompt,
} from "@/features/orders/api/use-edit-order-offline-autosave";
import {
  OrderDetailActionDock,
  OrderKeyInfoCard,
  OrderOverviewTab,
} from "@/features/orders/components/order-overview-tab";
import { CancelDialog } from "@/features/orders/forms/cancel-dialog";
import { NotifyDialog } from "@/features/orders/forms/notify-dialog";
import { PaymentDialog } from "@/features/orders/forms/payment-dialog";
import { buildEditForm, inferOrderPaidAmount } from "@/features/orders/model/edit-order-form";
import {
  deviceUnlockInputFromOrder,
  normalizeDeviceUnlockInput,
} from "@/features/orders/model/device-unlock";
import {
  createFinanceDraftState,
  emptyFinanceFaultDraft,
  normalizeFinanceDraft,
  type FinanceDraftState,
} from "@/features/orders/model/order-finance-draft";
import {
  isOrderCancelledForPayment,
  isOrderPaymentCollectible,
} from "@/features/orders/model/order-payment-state";
import {
  getDefaultOrderTransitionReason,
  getOrderTransitionReasonConfig,
} from "@/features/orders/model/order-transition-reasons";
import {
  appendFaultDescriptionItems,
  countMissingFaultDescriptionItems,
  getFaultDescriptionSourceItems,
  hasFaultDescriptionItem,
  type FaultDescriptionSourceItem,
} from "@/features/orders/model/order-fault-description";
import { getOrderSideStatusBadges } from "@/features/orders/model/order-side-statuses";
import {
  DEVICE_CUSTODY_WITH_CUSTOMER,
  DEVICE_CUSTODY_WITH_SHOP,
  deviceCustodyAllowsStatus,
  deviceCustodyBlocksStatus,
  deviceCustodyLabel,
  deviceCustodyStatusFromOrder,
  formatDeviceCustodyEvent,
  isDeviceCustodyStatus,
} from "@/features/orders/model/device-custody";
import { warrantyReasonRequired } from "@/features/orders/model/order-warranty";
import {
  findCurrentOrderStatusChangedAt,
  formatOrderDateTime,
} from "@/features/orders/model/order-date";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { componentOverlay } from "@/lib/component-patterns";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { formatMoney } from "@/lib/money";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { invalidateOrderReadCaches } from "@/features/orders/api/cache-sync";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { CACHE_TIMES } from "@/lib/query-performance";
import {
  getWorkflowNextActions,
  getWorkflowStatus,
  getWorkflowTransitionActions,
  getWorkflowStatusLabel,
} from "@/features/orders/model/order-workflow";
import {
  getOrderTaskGuidance,
  getOrderWorkflowStatus,
  getWorkflowProgressValue,
  orderTaskStages,
  type OrderTaskStage,
} from "@/features/orders/model/order-task-flow";
import { fadeUp, stagger } from "@/lib/motion";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import type {
  OrderApprovalDecisionInput,
  OrderAttachment,
  OrderAttachmentUploadInput,
  OrderDetail,
  OrderEvent,
  OrderAssigneeOption,
  OrderWorkflow,
  PatchOrderChanges,
  DeviceUnlockInput,
  DeviceCustodyStatus,
  StoreRole,
  StoreSettings,
  Supplier,
} from "@/lib/repairdesk/types";

type WorkflowTransitionAction = ReturnType<typeof getWorkflowTransitionActions>[number];
const imeiOcrImageAccept =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
const imeiOcrImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const imeiOcrImageExtensionPattern = /\.(?:jpe?g|png|webp|heic|heif)$/i;
const imeiOcrDecodeTimeoutMs = 5_000;

export function OrderDetailScreen({
  id,
  surface = "page",
  onClose,
}: {
  id: string;
  surface?: "page" | "dialog";
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;
  const activeUserId = shell.userId;
  const offlineScope = useMemo(
    () => (activeStoreId && activeUserId ? { storeId: activeStoreId, userId: activeUserId } : null),
    [activeStoreId, activeUserId],
  );
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelledReturnOpen, setCancelledReturnOpen] = useState(false);
  const [custodyDialogTarget, setCustodyDialogTarget] = useState<DeviceCustodyStatus | null>(null);
  const [custodyReason, setCustodyReason] = useState("");
  const custodyTriggerRef = useRef<HTMLElement | null>(null);
  const cancelledReturnTriggerRef = useRef<HTMLElement | null>(null);
  const [approvalDecisionOpen, setApprovalDecisionOpen] = useState(false);
  const [desktopTransitionOpen, setDesktopTransitionOpen] = useState(false);
  const [desktopPhotoCaptureOpen, setDesktopPhotoCaptureOpen] = useState(false);
  const [orderUrl, setOrderUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<UpdateOrderInput | null>(null);
  const [mobileFinanceEditing, setMobileFinanceEditing] = useState(false);
  const [mobileFinanceSaveError, setMobileFinanceSaveError] = useState("");
  const [financeDraft, setFinanceDraft] = useState<FinanceDraftState>(() =>
    createFinanceDraftState([], 0),
  );
  const desktopRecordsRef = useRef<HTMLDivElement | null>(null);

  const closeCustodyOverlay = useCallback(() => {
    setCustodyDialogTarget(null);
    setCustodyReason("");
    window.requestAnimationFrame(() => custodyTriggerRef.current?.focus());
  }, []);
  const closeCancelledReturnOverlay = useCallback(() => {
    setCancelledReturnOpen(false);
    window.requestAnimationFrame(() => cancelledReturnTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    document.body.dataset.orderDetailActive = "true";
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.orderDetailActive;
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  const {
    data,
    error: detailError,
    isError: detailIsError,
    isLoading,
    isPending,
    refetch: refetchDetail,
  } = useQuery({
    ...orderDetailQueryOptions(id, activeStoreId),
    enabled: Boolean(activeStoreId),
    retry: false,
  });
  const { data: storeSettings } = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
  });
  const { data: workflow } = useQuery({
    queryKey: ordersKeys.workflow(activeStoreId),
    queryFn: ({ signal }) => listOrderWorkflow({ signal }),
    staleTime: CACHE_TIMES.workflow,
  });
  const { data: repairDeskOptions } = useQuery({
    queryKey: ordersKeys.options(activeStoreId),
    queryFn: ({ signal }) => getRepairDeskOptions({ signal }),
    staleTime: CACHE_TIMES.options,
  });
  const { data: kioskDevices = [] } = useQuery({
    queryKey: kioskKeys.devices(activeStoreId),
    queryFn: ({ signal }) => listKioskDevices({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId),
  });
  const activeKioskDevice = kioskDevices.find((device) => device.status === "active");
  const defaultWarrantyMonths = storeSettings?.default_order_warranty_months ?? 6;
  const {
    state: editOfflineState,
    errorMessage: editOfflineErrorMessage,
    lastSavedAt: editOfflineLastSavedAt,
    draftPrompt: editOfflineDraftPrompt,
    pendingRestoreNotice: editOfflineRestoreNotice,
    hasSensitiveUnlockDraft: editOfflineHasSensitiveUnlockDraft,
    restorePromptDraft: restoreEditOfflinePromptDraft,
    discardPromptDraft: discardEditOfflinePromptDraft,
    discardCurrentDraft: discardCurrentEditOfflineDraft,
  } = useEditOrderOfflineAutosave({
    draft: editDraft,
    orderDetail: data,
    scope: offlineScope,
    defaultWarrantyMonths,
    autosaveEnabled: isEditing,
  });

  const invalidate = useCallback(() => {
    invalidateOrderReadCaches(queryClient, id);
  }, [id, queryClient]);

  useEffect(() => {
    setOrderUrl(window.location.href);
  }, [id]);

  const transition = useMutation({
    mutationFn: (vars: { to: RepairOrderStatus; reason?: string }) => {
      if (!data) throw new Error("工单未加载");
      return transitionOrder(id, vars.to, {
        reason: vars.reason,
        expectedUpdatedAt: data.order.updated_at,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${getWorkflowStatusLabel(workflow, vars.to)}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelledReturn = useMutation({
    mutationFn: () => {
      if (!data) throw new Error("工单未加载");
      return confirmCancelledOrderReturn(id, data.order.updated_at, crypto.randomUUID());
    },
    onSuccess: () => {
      toast.success("设备退还已确认");
      closeCancelledReturnOverlay();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const custodyUpdate = useMutation({
    mutationFn: (input: { target: DeviceCustodyStatus; reason?: string }) => {
      if (!data) throw new Error("工单未加载");
      return updateOrderCustody(id, {
        expected_updated_at: data.order.updated_at,
        device_custody_status: input.target,
        idempotency_key: crypto.randomUUID(),
        reason: input.reason,
      });
    },
    onSuccess: (_result, input) => {
      toast.success(
        input.target === DEVICE_CUSTODY_WITH_SHOP ? "已确认门店收到设备" : "已确认设备由客人保管",
      );
      closeCustodyOverlay();
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orderUpdate = useMutation({
    mutationFn: async (input: UpdateOrderInput) => {
      if (!data) throw new Error("工单未加载");
      const capabilities = data.capabilities;
      if (!capabilities) throw new Error("未取得工单编辑权限，请刷新后重试");
      const baseline = buildEditForm(data, defaultWarrantyMonths);
      const changes = buildOrderPatchChanges(baseline, input, capabilities);
      const financeChanged =
        JSON.stringify(
          normalizeFinanceDraft(
            createFinanceDraftState(baseline.fault_prices, baseline.deposit_amount ?? 0),
            inferOrderPaidAmount(data.order),
          ).faultPrices,
        ) !==
          JSON.stringify(
            normalizeFinanceDraft(
              createFinanceDraftState(input.fault_prices, input.deposit_amount ?? 0),
              inferOrderPaidAmount(data.order),
            ).faultPrices,
          ) || Number(baseline.deposit_amount ?? 0) !== Number(input.deposit_amount ?? 0);
      const hasRoutineChanges = Object.keys(changes).length > 0;
      if (hasRoutineChanges && financeChanged) {
        throw new Error("普通资料与报价需要分别保存，请先保存其中一类修改");
      }
      if (financeChanged) {
        if (!capabilities.canAdjustFinance) throw new Error("当前账号没有调整报价的权限");
        return patchOrderFinance(id, {
          expected_updated_at: data.order.updated_at,
          fault_prices: input.fault_prices,
          deposit_amount: input.deposit_amount,
        });
      }
      if (!hasRoutineChanges) throw new Error("没有可保存的修改");
      return patchOrder(id, { expected_updated_at: data.order.updated_at, changes });
    },
    onSuccess: () => {
      toast.success("工单信息已保存");
      void discardCurrentEditOfflineDraft();
      setIsEditing(false);
      setEditDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickImeiUpdate = useMutation({
    mutationFn: (imei: string) => {
      if (!data) throw new Error("工单未加载");
      const normalizedImei = normalizeImeiIdentifier(imei).value;
      if (!normalizedImei) throw new Error("IMEI / 序列号不能为空");
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes: { device_imei: normalizedImei },
      });
    },
    onSuccess: () => {
      toast.success("IMEI / 序列号已保存");
      invalidate();
    },
    onError: (error: Error) => toast.error(getImeiSaveErrorMessage(error)),
  });

  const faultUpdate = useMutation({
    mutationFn: (changes: Pick<PatchOrderChanges, "issue_description" | "diagnosis_result">) => {
      if (!data) throw new Error("工单未加载");
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes,
      });
    },
    onSuccess: () => {
      toast.success("故障描述已保存");
      invalidate();
    },
  });

  const deviceUnlockUpdate = useMutation({
    mutationFn: (device_unlock: DeviceUnlockInput) => {
      if (!data) throw new Error("工单未加载");
      if (deviceCustodyStatusFromOrder(data.order) !== DEVICE_CUSTODY_WITH_SHOP) {
        throw new Error("设备未留店，不能登记手机密码");
      }
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes: { device_unlock },
      });
    },
    onSuccess: () => {
      toast.success("手机密码已保存");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const partsSupplierUpdate = useMutation({
    mutationFn: (supplierId: string | null) => {
      if (!data) throw new Error("工单未加载");
      if (!repairDeskOptions?.permissions.canAssignSuppliers) {
        throw new Error("当前账号没有分配供应商权限");
      }
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes: { parts_supplier_id: supplierId },
      });
    },
    onSuccess: () => {
      toast.success("配件供应商已更新");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assigneeUpdate = useMutation({
    mutationFn: (membershipId: string | null) => {
      if (!data) throw new Error("工单未加载");
      if (!repairDeskOptions?.permissions.canAssignOrders) {
        throw new Error("当前账号没有分配工单负责人权限");
      }
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes: { assignee_membership_id: membershipId },
      });
    },
    onSuccess: () => {
      toast.success("工单负责人已更新");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attachmentUpload = useMutation({
    mutationFn: (input: OrderAttachmentUploadInput) => uploadOrderAttachment(id, input),
    onSuccess: () => {
      toast.success("设备照片已保存到工单");
      invalidate();
    },
    onError: (e: Error) => toast.error(`上传失败：${e.message}`),
  });

  const financeUpdate = useMutation({
    mutationFn: (input: {
      expectedUpdatedAt: string;
      faultPrices: ReturnType<typeof normalizeFinanceDraft>["faultPrices"];
      deposit: number;
    }) =>
      patchOrderFinance(id, {
        expected_updated_at: input.expectedUpdatedAt,
        fault_prices: input.faultPrices,
        deposit_amount: input.deposit,
      }),
    onSuccess: () => {
      setMobileFinanceSaveError("");
      toast.success("报价已保存");
      invalidate();
    },
    onError: (e: Error) => {
      const message = getFinanceSaveErrorMessage(e);
      setMobileFinanceSaveError(message);
      toast.error(message);
    },
  });

  const approval = useMutation({
    mutationFn: (input: { body: string; recipientPhone?: string }) =>
      sendApprovalRequest(id, input.body, input.recipientPhone),
    onSuccess: () => {
      toast.success("审批消息已记录，并已打开 WhatsApp");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approvalDecision = useMutation({
    mutationFn: (input: OrderApprovalDecisionInput) => decideOrderApproval(id, input),
    onSuccess: (result) => {
      toast.success(
        result.decision === "approved"
          ? `客户已同意，工单进入「${getWorkflowStatusLabel(workflow, result.to)}」`
          : `客户已拒绝，工单进入「${getWorkflowStatusLabel(workflow, result.to)}」`,
      );
      setApprovalDecisionOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsappNotification = useMutation({
    mutationFn: (input: {
      body: string;
      templateKind: Parameters<typeof sendWhatsappNotification>[2];
      transitionTo?: RepairOrderStatus;
      recipientPhone?: string;
    }) =>
      sendWhatsappNotification(
        id,
        input.body,
        input.templateKind,
        input.transitionTo,
        input.recipientPhone,
      ),
    onSuccess: (result) => {
      toast.success(
        result.statusChanged && result.to
          ? `WhatsApp 已记录，并已流转为「${getWorkflowStatusLabel(workflow, result.to)}」`
          : "WhatsApp 通知已记录",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kioskSignatureRequest = useMutation({
    mutationFn: () => {
      if (!data) throw new Error("工单未加载");
      if (!activeKioskDevice) throw new Error("没有可用的客户 iPad");
      return createKioskSession({
        device_id: activeKioskDevice.id,
        order_id: data.order.id,
        customer_id: data.customer?.id ?? data.order.customer_id,
        session_type: "pickup_signature",
        expires_in_minutes: 30,
        request_payload: {
          source: "order_detail",
          order_public_no: data.order.public_no,
        },
      });
    },
    onSuccess: async (session) => {
      toast.success(`已发送到 ${session.device?.label ?? activeKioskDevice?.label ?? "客户 iPad"}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: kioskKeys.sessions(activeStoreId) }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.detail(id, activeStoreId) }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editFinance = useMemo(() => {
    if (!data || !editDraft) return null;
    return normalizeFinanceDraft(financeDraft, inferOrderPaidAmount(data.order));
  }, [data, editDraft, financeDraft]);
  const mobileFinance = useMemo(() => {
    if (!data) return null;
    return normalizeFinanceDraft(financeDraft, inferOrderPaidAmount(data.order));
  }, [data, financeDraft]);

  const editValidationError = useMemo(
    () =>
      getEditValidationError(editDraft, editFinance?.error, defaultWarrantyMonths, {
        canEditIntake: Boolean(data?.capabilities?.canEditIntake),
        canEditRepair: Boolean(data?.capabilities?.canEditRepair),
        canAdjustFinance: Boolean(data?.capabilities?.canAdjustFinance),
      }),
    [data?.capabilities, defaultWarrantyMonths, editDraft, editFinance?.error],
  );
  const editCanSave = Boolean(
    editDraft &&
    (!data?.capabilities?.canAdjustFinance || editFinance?.canSave) &&
    !editValidationError,
  );

  useEffect(() => {
    if (!data || isEditing || mobileFinanceEditing) return;
    setFinanceDraft(createFinanceDraftState(data.order.fault_prices, data.order.deposit_amount));
  }, [data, isEditing, mobileFinanceEditing]);

  const startEditing = useCallback(() => {
    if (!data) return;
    if (
      !data.capabilities?.canEditIntake &&
      !data.capabilities?.canEditRepair &&
      !data.capabilities?.canAdjustFinance
    ) {
      toast.error("当前工单状态或账号权限不允许编辑");
      return;
    }
    const draft = buildEditForm(data, defaultWarrantyMonths);
    setEditDraft(draft);
    setFinanceDraft(createFinanceDraftState(draft.fault_prices, draft.deposit_amount ?? 0));
    setIsEditing(true);
  }, [data, defaultWarrantyMonths]);

  const cancelEditing = useCallback(() => {
    void discardCurrentEditOfflineDraft();
    setIsEditing(false);
    setEditDraft(null);
    if (data) {
      const draft = buildEditForm(data, defaultWarrantyMonths);
      setFinanceDraft(createFinanceDraftState(draft.fault_prices, draft.deposit_amount ?? 0));
    }
  }, [data, defaultWarrantyMonths, discardCurrentEditOfflineDraft]);

  const scrollToDesktopRecords = useCallback(() => {
    desktopRecordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const saveEditing = useCallback(async () => {
    if (!editDraft || !editFinance) return;
    const validationError = getEditValidationError(
      editDraft,
      editFinance.error,
      defaultWarrantyMonths,
      {
        canEditIntake: Boolean(data?.capabilities?.canEditIntake),
        canEditRepair: Boolean(data?.capabilities?.canEditRepair),
        canAdjustFinance: Boolean(data?.capabilities?.canAdjustFinance),
      },
    );
    if (validationError || (data?.capabilities?.canAdjustFinance && !editFinance.canSave)) {
      toast.error(validationError ?? editFinance.error ?? "请检查工单信息。");
      return;
    }
    await orderUpdate.mutateAsync({
      ...editDraft,
      fault_prices: editFinance.faultPrices,
      deposit_amount: editFinance.deposit,
    });
  }, [data?.capabilities, defaultWarrantyMonths, editDraft, editFinance, orderUpdate]);
  const restoreEditOfflineDraft = useCallback(async () => {
    const result = await restoreEditOfflinePromptDraft();
    if (!result) return;
    if (result.status === "conflict") {
      toast.error(result.message);
      return;
    }
    setEditDraft(result.draft);
    setFinanceDraft(
      createFinanceDraftState(result.draft.fault_prices, result.draft.deposit_amount ?? 0),
    );
    setIsEditing(true);
    toast.success("本机编辑草稿已恢复");
  }, [restoreEditOfflinePromptDraft]);
  const discardEditOfflinePrompt = useCallback(async () => {
    const discarded = await discardEditOfflinePromptDraft();
    if (discarded) toast.success("本机编辑草稿已丢弃");
  }, [discardEditOfflinePromptDraft]);

  if (
    !data &&
    (shell.status === "loading" || (Boolean(activeStoreId) && (isLoading || isPending)))
  ) {
    return <OrderDetailSkeleton surface={surface} onClose={onClose} />;
  }
  if (!activeStoreId) {
    return <StoreShellUnavailableState shell={shell} onRetry={shell.retry} />;
  }
  if (detailIsError || !data) {
    const message =
      detailError instanceof Error && detailError.message
        ? detailError.message
        : "工单详情加载失败，请刷新后重试。";
    return (
      <div
        className={cn(
          "min-w-0 max-w-full space-y-3 overflow-x-clip",
          surface === "page"
            ? "mx-auto w-full max-w-[1200px] px-2.5 pb-28 pt-0 sm:px-4 sm:pb-32 md:px-6"
            : cn(detailWorkspace.root, "flex h-full flex-col p-2 sm:p-3"),
        )}
      >
        {surface === "dialog" && onClose ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-2 top-2 z-40 size-8 rounded-full bg-card/95 shadow-[var(--shadow-card)]"
            onClick={onClose}
            aria-label="关闭工单详情"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <section className="rounded-xl border border-status-danger-foreground/20 bg-status-danger px-4 py-4 text-status-danger-foreground">
          <p className="text-sm font-semibold">工单详情加载失败</p>
          <p className="mt-1 break-words text-xs leading-5">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg bg-background/80 text-xs"
              onClick={() => void refetchDetail()}
            >
              重新加载
            </Button>
            {surface === "page" ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-lg bg-background/80 text-xs"
              >
                <Link href="/orders">
                  <ArrowLeft className="size-3.5" /> 返回工单
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }
  const { order, customer, device, supplier, events, messages } = data;
  const isVoided = order.record_state === "voided" || Boolean(order.deleted_at);
  const canNotify = !isVoided && !order.customer_contact_redacted;
  const supplierPermissions = repairDeskOptions?.permissions ?? {
    canReadSuppliers: false,
    canAssignSuppliers: false,
    canManageSuppliers: false,
  };
  const supplierOptions = supplierPermissions.canReadSuppliers
    ? (repairDeskOptions?.suppliers ?? [])
    : [];
  const assigneeOptions = repairDeskOptions?.assigneeOptions ?? [];
  const canAssignOrders = Boolean(repairDeskOptions?.permissions.canAssignOrders);
  const partsSupplier = supplierPermissions.canReadSuppliers
    ? (data.parts_supplier ?? supplierOptions.find((item) => item.id === order.parts_supplier_id))
    : undefined;
  const cancelled = isOrderCancelledForPayment(order);
  const custodyStatus = deviceCustodyStatusFromOrder(order);
  const next = cancelled
    ? { primary: undefined, secondary: [] }
    : getWorkflowNextActions(workflow, order.status);
  const desktopWorkflowStatus = getOrderWorkflowStatus(order);
  const desktopStageIndex = getWorkflowProgressValue(desktopWorkflowStatus);
  const desktopCurrentStage = cancelled
    ? getOrderTaskGuidance(order).stage
    : (orderTaskStages[Math.min(desktopStageIndex, orderTaskStages.length - 1)] ??
      orderTaskStages[0]);
  const desktopStatusActions =
    data.capabilities?.canTransition && !cancelled && !isVoided
      ? getWorkflowTransitionActions(workflow, order.status).filter((action) =>
          deviceCustodyAllowsStatus(
            custodyStatus,
            action.to,
            getWorkflowStatus(workflow, action.to)?.bucket,
          ),
        )
      : [];
  const canCancelOrder = desktopStatusActions.some((action) => action.to === "cancelled");
  const canCollectPayment =
    data.capabilities?.canCollectPayment === true && isOrderPaymentCollectible(order);
  const canDecideApproval =
    data.capabilities?.canTransition === true &&
    !cancelled &&
    !isVoided &&
    isApprovalDecisionAvailable(order);
  const deviceBrand = order.device_snapshot?.brand || device?.brand || "";
  const deviceModel = order.device_snapshot?.model || device?.model || "";
  const deviceLabel = `${deviceBrand} ${deviceModel}`.trim() || order.device_label;
  const deviceImei =
    order.device_snapshot?.serial_or_imei || order.device_imei || device?.serial_or_imei || "";
  const deviceNotes = order.device_snapshot?.device_notes || device?.device_notes;
  const accessoryNotes = order.accessory_notes;
  const canUpdateCustody = Boolean(shell.activeStore?.role && shell.activeStore.role !== "viewer");
  const canCorrectTerminalCustody =
    shell.activeStore?.role === "owner" || shell.activeStore?.role === "manager";
  const custodyReasonRequired =
    custodyStatus === null || order.status === "completed" || order.status === "cancelled";
  const signatureAttachments = (data.attachments ?? []).filter(
    (attachment) => attachment.kind === "signature",
  );
  const photoAttachments = (data.attachments ?? []).filter(
    (attachment) => attachment.mime_type.startsWith("image/") && attachment.kind !== "signature",
  );

  return (
    <div
      data-order-detail-root="true"
      data-order-detail-surface={surface}
      className={cn(
        "relative min-w-0 max-w-full overflow-x-clip",
        surface === "page"
          ? "mx-auto w-full max-w-[430px] px-2 pb-28 pt-0 sm:max-w-[430px] sm:px-2 sm:pb-32 md:max-w-[1200px] md:px-6"
          : cn(detailWorkspace.root, "flex h-full flex-col"),
      )}
    >
      {surface === "dialog" && onClose ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-2 top-2 z-40 size-8 rounded-full bg-card/95 shadow-[var(--shadow-card)]"
          onClick={onClose}
          aria-label="关闭工单详情"
        >
          <X className="size-4" />
        </Button>
      ) : null}
      {surface === "dialog" &&
      order.status === "cancelled" &&
      order.record_state !== "voided" &&
      custodyStatus === DEVICE_CUSTODY_WITH_SHOP &&
      !order.delivered_at ? (
        <section
          className={cn(
            "mb-2 flex min-w-0 items-center gap-2 border border-status-warn-foreground/25 bg-status-warn/55 px-3 py-2 text-status-warn-foreground md:rounded-lg",
            surface === "dialog" && "pr-12",
          )}
        >
          <PackageCheck className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">设备退还尚未确认</p>
            <p className="truncate text-[11px] opacity-80">该工单已移入历史，退还提醒仍保留。</p>
          </div>
          {data.capabilities?.canConfirmCancelledReturn ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 bg-background/80 text-xs"
              onClick={() => {
                cancelledReturnTriggerRef.current =
                  document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setCancelledReturnOpen(true);
              }}
            >
              确认已退还
            </Button>
          ) : null}
        </section>
      ) : null}
      {surface === "dialog" ? (
        <OrderTerminalActions
          detail={data}
          workflow={workflow}
          onCompleted={invalidate}
          className="mb-2"
        />
      ) : null}
      <OrderDeviceCustodyCard
        order={order}
        events={events}
        role={shell.activeStore?.role}
        pending={custodyUpdate.isPending || cancelledReturn.isPending}
        onRequestChange={(target) => {
          custodyTriggerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setCustodyReason("");
          setCustodyDialogTarget(target);
        }}
        onConfirmCancelledReturn={() => {
          cancelledReturnTriggerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setCancelledReturnOpen(true);
        }}
        className="mb-2"
      />
      {surface === "page" ? (
        <MobileOrderDetailView
          data={data}
          deviceLabel={deviceLabel}
          deviceImei={deviceImei}
          accessoryNotes={accessoryNotes}
          storeSettings={storeSettings}
          workflow={workflow}
          topNotice={
            <>
              {order.status === "cancelled" &&
              order.record_state !== "voided" &&
              custodyStatus === DEVICE_CUSTODY_WITH_SHOP &&
              !order.delivered_at ? (
                <section className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn/55 px-3 py-2 text-status-warn-foreground">
                  <PackageCheck className="size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">设备退还尚未确认</p>
                    <p className="truncate text-[11px] opacity-80">
                      该工单已移入历史，退还提醒仍保留。
                    </p>
                  </div>
                  {data.capabilities?.canConfirmCancelledReturn ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 bg-background/80 text-xs"
                      onClick={() => setCancelledReturnOpen(true)}
                    >
                      确认已退还
                    </Button>
                  ) : null}
                </section>
              ) : null}
              <OrderTerminalActions
                detail={data}
                workflow={workflow}
                onCompleted={invalidate}
                className="mb-2"
              />
            </>
          }
          transitionPending={transition.isPending}
          onTransition={(to, reason) => transition.mutate({ to, reason })}
          onImeiSave={async (imei) => {
            await quickImeiUpdate.mutateAsync(imei);
          }}
          imeiPending={quickImeiUpdate.isPending}
          onFaultSave={async (changes) => {
            await faultUpdate.mutateAsync(changes);
          }}
          faultPending={faultUpdate.isPending}
          onDeviceUnlockSave={async (deviceUnlock) => {
            await deviceUnlockUpdate.mutateAsync(deviceUnlock);
          }}
          deviceUnlockPending={deviceUnlockUpdate.isPending}
          onAttachmentUpload={async (input) => {
            await attachmentUpload.mutateAsync(input);
          }}
          attachmentUploadPending={attachmentUpload.isPending}
          financeDraft={financeDraft}
          financeEditing={mobileFinanceEditing}
          financeSaveError={mobileFinanceSaveError}
          onFinanceEditingChange={(editing) => {
            if (editing) setMobileFinanceSaveError("");
            setMobileFinanceEditing(editing);
          }}
          onFinanceDraftChange={(draft) => {
            setMobileFinanceSaveError("");
            setFinanceDraft(draft);
          }}
          onFinanceSave={async () => {
            if (!mobileFinance?.canSave) {
              const message = mobileFinance?.error ?? "请检查报价金额后再保存。";
              setMobileFinanceSaveError(message);
              toast.error(message);
              return false;
            }
            setMobileFinanceSaveError("");
            await financeUpdate.mutateAsync({
              expectedUpdatedAt: order.updated_at,
              faultPrices: mobileFinance.faultPrices,
              deposit: mobileFinance.deposit,
            });
            return true;
          }}
          financePending={financeUpdate.isPending}
          canAdjustFinance={Boolean(data.capabilities?.canAdjustFinance)}
          onNotify={() => setNotifyOpen(true)}
          onApprovalDecision={() => setApprovalDecisionOpen(true)}
          approvalDecisionAvailable={canDecideApproval}
          whatsappDisabled={mobileFinanceEditing || financeUpdate.isPending || !canNotify}
          onPay={() => setPayOpen(true)}
          paymentDisabled={!canCollectPayment}
          onPrint={() => window.print()}
          onCancel={() => setCancelOpen(true)}
          canCancel={canCancelOrder}
          onRequestKioskSignature={isVoided ? undefined : () => kioskSignatureRequest.mutate()}
          kioskSignaturePending={kioskSignatureRequest.isPending}
          kioskSignatureAvailable={
            Boolean(activeKioskDevice) && custodyStatus === DEVICE_CUSTODY_WITH_SHOP
          }
          partsSupplier={partsSupplier}
          supplierOptions={supplierOptions}
          partsSupplierPending={partsSupplierUpdate.isPending}
          onPartsSupplierChange={
            supplierPermissions.canAssignSuppliers && data.capabilities?.canEditRepair
              ? (supplierId) => partsSupplierUpdate.mutate(supplierId)
              : undefined
          }
          assigneeOptions={assigneeOptions}
          assigneePending={assigneeUpdate.isPending}
          onAssigneeChange={
            canAssignOrders && data.capabilities?.canEditIntake
              ? (membershipId) => assigneeUpdate.mutate(membershipId)
              : undefined
          }
          className="md:hidden"
        />
      ) : null}
      <div
        className={cn(
          surface === "page" && "hidden md:block",
          surface === "dialog" &&
            "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-2.5 md:p-3",
        )}
      >
        <div className="relative z-20">
          <OrderHero
            order={order}
            onPrint={() => window.print()}
            onCancel={() => setCancelOpen(true)}
            canCancel={canCancelOrder}
            onEdit={
              data.capabilities?.canEditIntake ||
              data.capabilities?.canEditRepair ||
              data.capabilities?.canAdjustFinance
                ? startEditing
                : undefined
            }
            onSaveEdit={() => void saveEditing()}
            onCancelEdit={cancelEditing}
            storeName={storeSettings?.store_name || "ChinaTech"}
            isEditing={isEditing}
            editPending={orderUpdate.isPending}
            editSaveDisabled={!editCanSave}
            showBackLink={surface === "page"}
            surface={surface}
            currentStage={desktopCurrentStage}
            currentStageIndex={desktopStageIndex}
            nextActionLabel={canDecideApproval ? "处理客户审批" : next.primary?.label}
            taskHint={
              canDecideApproval
                ? "客户已在等待报价结果，先记录同意或拒绝，再进入维修、订件、寄修或未修取机。"
                : next.primary
                  ? getStatusActionHint(next.primary.to, order)
                  : undefined
            }
            approvalDecisionAvailable={canDecideApproval}
          />
        </div>

        <div className={cn("min-w-0", surface === "dialog" && "min-h-0 flex-1 overflow-y-auto")}>
          <motion.div
            data-order-desktop-single-workspace="true"
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className={cn("min-w-0 space-y-2 sm:space-y-3", surface === "dialog" && "min-h-full")}
          >
            <OrderEditOfflineDraftNotice
              state={editOfflineState}
              errorMessage={editOfflineErrorMessage}
              lastSavedAt={editOfflineLastSavedAt}
              prompt={editOfflineDraftPrompt}
              pendingRestoreNotice={editOfflineRestoreNotice}
              hasSensitiveUnlockDraft={editOfflineHasSensitiveUnlockDraft}
              isEditing={isEditing}
              onRestore={() => void restoreEditOfflineDraft()}
              onDiscard={() => void discardEditOfflinePrompt()}
            />
            <OrderOverviewTab
              order={order}
              customer={customer}
              deviceBrand={deviceBrand}
              deviceModel={deviceModel}
              deviceImei={deviceImei}
              deviceNotes={deviceNotes}
              accessoryNotes={accessoryNotes}
              isEditing={isEditing}
              editDraft={editDraft}
              onEditDraftChange={(next) => setEditDraft(next)}
              financeDraft={financeDraft}
              financeError={editFinance?.error}
              onFinanceDraftChange={setFinanceDraft}
              canEditIntake={Boolean(data.capabilities?.canEditIntake)}
              canEditRepair={Boolean(data.capabilities?.canEditRepair)}
              canAdjustFinance={Boolean(data.capabilities?.canAdjustFinance)}
              defaultWarrantyMonths={defaultWarrantyMonths}
              onQuickImeiSave={
                data.capabilities?.canEditIntake
                  ? async (imei) => {
                      await quickImeiUpdate.mutateAsync(imei);
                    }
                  : undefined
              }
              quickImeiPending={quickImeiUpdate.isPending}
              surface={surface}
              storeSettings={storeSettings}
              supplier={supplier}
              events={events}
              messages={messages}
              workflow={workflow}
              onShowRecords={scrollToDesktopRecords}
              photoAttachments={photoAttachments}
              signatureAttachments={signatureAttachments}
              photoUploadPending={attachmentUpload.isPending}
              onPhotoCapture={isVoided ? undefined : () => setDesktopPhotoCaptureOpen(true)}
              onRequestKioskSignature={isVoided ? undefined : () => kioskSignatureRequest.mutate()}
              kioskSignaturePending={kioskSignatureRequest.isPending}
              kioskSignatureAvailable={
                Boolean(activeKioskDevice) && custodyStatus === DEVICE_CUSTODY_WITH_SHOP
              }
            />
            <div ref={desktopRecordsRef} className="scroll-mt-24">
              <OrderRecordsWorkspace
                order={order}
                supplier={supplier}
                partsSupplier={partsSupplier}
                supplierOptions={supplierOptions}
                partsSupplierPending={partsSupplierUpdate.isPending}
                onPartsSupplierChange={
                  supplierPermissions.canAssignSuppliers && data.capabilities?.canEditRepair
                    ? (supplierId) => partsSupplierUpdate.mutate(supplierId)
                    : undefined
                }
                assigneeOptions={assigneeOptions}
                assigneePending={assigneeUpdate.isPending}
                onAssigneeChange={
                  canAssignOrders && data.capabilities?.canEditIntake
                    ? (membershipId) => assigneeUpdate.mutate(membershipId)
                    : undefined
                }
                messages={messages}
                events={events}
                workflow={workflow}
                surface={surface}
              />
            </div>
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          {desktopTransitionOpen ? (
            <motion.div
              key="desktop-transition-panel"
              data-order-desktop-transition-panel="true"
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: 4 }}
              className="mt-2 min-w-0"
            >
              <DesktopStatusTransitionPanel
                order={order}
                statusLabel={getWorkflowStatusLabel(workflow, order.status)}
                currentStage={desktopCurrentStage}
                actions={desktopStatusActions}
                pending={transition.isPending}
                onOpenChange={setDesktopTransitionOpen}
                onTransition={(to, reason) => transition.mutate({ to, reason })}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!isVoided ? (
          <OrderDetailActionDock
            order={order}
            isEditing={isEditing}
            financeDraft={financeDraft}
            onApprovalDecision={() => setApprovalDecisionOpen(true)}
            approvalDecisionAvailable={canDecideApproval}
            onFlow={() => setDesktopTransitionOpen((open) => !open)}
            flowDisabled={transition.isPending || desktopStatusActions.length === 0}
            onPay={() => setPayOpen(true)}
            paymentDisabled={!canCollectPayment}
            onNotify={() => setNotifyOpen(true)}
            notifyDisabled={!canNotify}
            surface={surface}
          />
        ) : null}
      </div>

      {canNotify ? (
        <NotifyDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          data={data}
          workflow={workflow}
          orderUrl={orderUrl}
          busy={whatsappNotification.isPending || approval.isPending}
          onConfirm={async (input) => {
            if (
              input.templateKind === "approval_request" &&
              (order.status === "quoted" || order.status === "waiting_approval")
            ) {
              await approval.mutateAsync({
                body: input.body,
                recipientPhone: input.recipientPhone,
              });
              return;
            }
            await whatsappNotification.mutateAsync(input);
          }}
        />
      ) : null}
      <ApprovalDecisionSheet
        open={approvalDecisionOpen}
        onOpenChange={setApprovalDecisionOpen}
        order={order}
        pending={approvalDecision.isPending}
        onConfirm={(input) => approvalDecision.mutateAsync(input)}
      />
      {canCollectPayment && !order.finance_redacted ? (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          balance={order.balance_amount}
          onPay={async (amount, method, idempotencyKey) => {
            await recordPayment(id, amount, method, order.updated_at, idempotencyKey);
            toast.success(`已收款 ${formatMoney(amount)}`);
            invalidate();
          }}
        />
      ) : null}
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={async (reason) => {
          await transition.mutateAsync({ to: "cancelled", reason });
        }}
      />
      <OrderCustodyChangeOverlay
        open={custodyDialogTarget !== null}
        target={custodyDialogTarget}
        reason={custodyReason}
        reasonRequired={custodyReasonRequired}
        pending={custodyUpdate.isPending}
        canSubmit={
          canUpdateCustody &&
          !(
            (order.status === "completed" || order.status === "cancelled") &&
            !canCorrectTerminalCustody
          )
        }
        onReasonChange={setCustodyReason}
        onOpenChange={(open) => {
          if (!open) closeCustodyOverlay();
        }}
        onConfirm={() => {
          if (!custodyDialogTarget) return;
          custodyUpdate.mutate({
            target: custodyDialogTarget,
            reason: custodyReason.trim() || undefined,
          });
        }}
      />
      <CancelledReturnOverlay
        open={cancelledReturnOpen}
        pending={cancelledReturn.isPending}
        onOpenChange={(open) => {
          if (!open) closeCancelledReturnOverlay();
        }}
        onConfirm={() => cancelledReturn.mutate()}
      />
      {!isVoided ? (
        <CameraCaptureSheet
          open={desktopPhotoCaptureOpen}
          onOpenChange={setDesktopPhotoCaptureOpen}
          title="拍摄设备照片"
          description="拍摄设备外观、故障位置或取件凭证。确认后会保存到当前工单。"
          attachmentKind="fault_photo"
          onCapture={(draft) => {
            void uploadAttachmentDraft(draft, async (input) => {
              await attachmentUpload.mutateAsync(input);
            });
          }}
        />
      ) : null}
      <RepairOrderPrintSheet data={data} orderUrl={orderUrl} storeSettings={storeSettings} />
    </div>
  );
}

function CancelledReturnOverlay({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isDesktop = useDesktopActionSurface();
  const footer = (
    <>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
        返回
      </Button>
      <Button type="button" disabled={pending} onClick={onConfirm}>
        <PackageCheck className="size-4" />
        {pending ? "确认中..." : "确认退还"}
      </Button>
    </>
  );
  const description = "此操作只记录设备已交还客户，不会自动收款、退款或更改订单金额。";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-busy={pending} className={componentOverlay.modalSm}>
          <DialogHeader>
            <DialogTitle>确认设备已退还</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-busy={pending}
        className="rounded-t-2xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <SheetTitle>确认设备已退还</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <p className="sr-only" role="status" aria-live="polite">
          {pending ? "正在确认设备退还" : ""}
        </p>
        <SheetFooter className="!grid grid-cols-2 gap-2 border-t border-[var(--border-panel)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function OrderCustodyChangeOverlay({
  open,
  target,
  reason,
  reasonRequired,
  pending,
  canSubmit,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  target: DeviceCustodyStatus | null;
  reason: string;
  reasonRequired: boolean;
  pending: boolean;
  canSubmit: boolean;
  onReasonChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isDesktop = useDesktopActionSurface();
  const title = target === DEVICE_CUSTODY_WITH_SHOP ? "确认门店已收到设备" : "确认设备已交给客人";
  const description =
    target === DEVICE_CUSTODY_WITH_SHOP
      ? "确认后设备可进入检测、维修或取机流程。"
      : "确认后会记录交付时间，并清除工单中的手机密码、PIN 和解锁图案。";
  const body = (
    <div className="grid min-w-0 gap-3 p-4">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        <span>操作说明{reasonRequired ? "（必填）" : "（可选）"}</span>
        <Textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          maxLength={240}
          disabled={pending}
          className="min-h-24 resize-none text-sm"
          placeholder={
            reasonRequired ? "请说明历史补录或结束后修正的原因" : "例如：客人临时带走设备"
          }
        />
      </label>
      <p className="sr-only" role="status" aria-live="polite">
        {pending ? "正在保存设备交接记录" : ""}
      </p>
    </div>
  );
  const footer = (
    <>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
        取消
      </Button>
      <Button
        type="button"
        disabled={pending || !target || (reasonRequired && !reason.trim()) || !canSubmit}
        onClick={onConfirm}
      >
        {pending ? "保存中..." : "确认保存"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-order-custody-dialog="true"
          aria-busy={pending}
          className={componentOverlay.modalSm}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-order-custody-sheet="true"
        side="bottom"
        aria-busy={pending}
        className="max-h-[calc(100svh-16px)] rounded-t-2xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto">{body}</div>
          <SheetFooter className="!grid grid-cols-2 gap-2 border-t border-[var(--border-panel)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            {footer}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderDeviceCustodyCard({
  order,
  events,
  role,
  pending,
  onRequestChange,
  onConfirmCancelledReturn,
  className,
}: {
  order: OrderDetail["order"];
  events: OrderEvent[];
  role?: StoreRole;
  pending: boolean;
  onRequestChange: (target: DeviceCustodyStatus) => void;
  onConfirmCancelledReturn: () => void;
  className?: string;
}) {
  const status = deviceCustodyStatusFromOrder(order);
  const isTerminal = order.status === "completed" || order.status === "cancelled";
  const canUpdate = Boolean(role && role !== "viewer");
  const canCorrectTerminal = role === "owner" || role === "manager";
  const latestHandoff = getLatestCustodyHandoff(events);
  const description =
    status === DEVICE_CUSTODY_WITH_SHOP
      ? order.status === "cancelled"
        ? "工单已取消，但设备仍在店内；退还后必须确认交接。"
        : "设备当前由门店保管，可登记解锁信息并进入检测或维修流程。"
      : status === DEVICE_CUSTODY_WITH_CUSTOMER
        ? order.delivered_at
          ? `设备已交给客人 · ${formatOrderDateTime(order.delivered_at)}`
          : "设备由客人自行保管，系统不会保存或展示解锁信息。"
        : "这是一张旧工单，尚未记录设备是否留在门店；继续关键流程前必须补录。";

  const actions: ReactNode[] = [];
  if (status === null && canUpdate && (!isTerminal || canCorrectTerminal)) {
    actions.push(
      <Button
        key="backfill-shop"
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() => onRequestChange(DEVICE_CUSTODY_WITH_SHOP)}
      >
        补录为留店
      </Button>,
      <Button
        key="backfill-customer"
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() => onRequestChange(DEVICE_CUSTODY_WITH_CUSTOMER)}
      >
        补录为未留店
      </Button>,
    );
  } else if (
    order.status === "cancelled" &&
    status === DEVICE_CUSTODY_WITH_SHOP &&
    !order.delivered_at &&
    canUpdate
  ) {
    actions.push(
      <Button
        key="cancelled-return"
        type="button"
        size="sm"
        className="h-8 text-xs"
        disabled={pending}
        onClick={onConfirmCancelledReturn}
      >
        <PackageCheck className="size-3.5" />
        确认已退还
      </Button>,
    );
  } else if (!isTerminal && canUpdate && status) {
    const target =
      status === DEVICE_CUSTODY_WITH_SHOP ? DEVICE_CUSTODY_WITH_CUSTOMER : DEVICE_CUSTODY_WITH_SHOP;
    actions.push(
      <Button
        key="custody-toggle"
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() => onRequestChange(target)}
      >
        {target === DEVICE_CUSTODY_WITH_SHOP ? "确认收机" : "确认交还客人"}
      </Button>,
    );
  } else if (isTerminal && canCorrectTerminal && status) {
    const target =
      status === DEVICE_CUSTODY_WITH_SHOP ? DEVICE_CUSTODY_WITH_CUSTOMER : DEVICE_CUSTODY_WITH_SHOP;
    if (!(order.status === "completed" && target === DEVICE_CUSTODY_WITH_SHOP)) {
      actions.push(
        <Button
          key="terminal-correction"
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={pending}
          onClick={() => onRequestChange(target)}
        >
          历史修正
        </Button>,
      );
    }
  }

  return (
    <section
      data-order-device-custody="true"
      className={cn(
        "grid min-w-0 gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2.5 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-3",
        status === null && "border-status-warn-foreground/30 bg-status-warn/35",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
          {status === DEVICE_CUSTODY_WITH_CUSTOMER ? (
            <UserRound className="size-4" />
          ) : (
            <PackageSearch className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h2 className="text-xs font-semibold">设备保管</h2>
            <DeviceCustodyBadge
              status={status}
              deliveredAt={order.delivered_at}
              className="text-[10px]"
            />
          </div>
          <p className="mt-1 break-words text-[10px] leading-4 text-muted-foreground">
            {description}
          </p>
          {latestHandoff ? (
            <p className="mt-1 break-words text-[10px] leading-4 text-muted-foreground">
              最近交接：{latestHandoff.summary} · {formatOrderDateTime(latestHandoff.createdAt)} ·
              {latestHandoff.operator}
            </p>
          ) : null}
          {isTerminal && !canCorrectTerminal && status === null ? (
            <p className="mt-1 text-[10px] font-medium text-status-warn-foreground">
              已结束工单需由店主或经理填写说明后补录。
            </p>
          ) : null}
          {status !== DEVICE_CUSTODY_WITH_SHOP && deviceCustodyBlocksStatus(order.status) ? (
            <p className="mt-1 text-[10px] font-semibold text-status-danger-foreground">
              当前维修流程与设备保管状态冲突，请先核对并确认收机。
            </p>
          ) : null}
        </div>
      </div>
      {actions.length ? (
        <div className="flex min-w-0 flex-wrap gap-1.5 md:justify-end">{actions}</div>
      ) : null}
    </section>
  );
}

function getLatestCustodyHandoff(events: OrderEvent[]) {
  for (const event of [...events].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  )) {
    const formatted = formatDeviceCustodyEvent(event.payload);
    if (formatted) {
      return {
        summary: formatted,
        createdAt: event.created_at,
        operator: event.operator_name || "系统",
      };
    }
    const initialStatus = event.payload.device_custody_status;
    if (event.event_type === "created" && isDeviceCustodyStatus(initialStatus)) {
      return {
        summary: `创建时登记为${deviceCustodyLabel(initialStatus)}`,
        createdAt: event.created_at,
        operator: event.operator_name || "系统",
      };
    }
  }
  return null;
}

function OrderRecordsWorkspace({
  order,
  assigneeOptions,
  assigneePending,
  onAssigneeChange,
  supplier,
  partsSupplier,
  supplierOptions,
  partsSupplierPending,
  onPartsSupplierChange,
  messages,
  events,
  workflow,
  surface,
}: {
  order: OrderDetail["order"];
  assigneeOptions: OrderAssigneeOption[];
  assigneePending: boolean;
  onAssigneeChange?: (membershipId: string | null) => void;
  supplier?: OrderDetail["supplier"];
  partsSupplier?: Supplier;
  supplierOptions: Supplier[];
  partsSupplierPending: boolean;
  onPartsSupplierChange?: (supplierId: string | null) => void;
  messages: OrderDetail["messages"];
  events: OrderDetail["events"];
  workflow: Parameters<typeof getWorkflowStatusLabel>[0];
  surface: "page" | "dialog";
}) {
  return (
    <motion.div
      variants={fadeUp}
      data-order-records-workspace="true"
      className={cn(
        "grid min-w-0 gap-2 sm:gap-3",
        surface === "dialog"
          ? "lg:grid-cols-[minmax(240px,0.78fr)_minmax(0,1.22fr)]"
          : "lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]",
      )}
    >
      <div className="grid min-w-0 content-start gap-2 sm:gap-3">
        {onAssigneeChange ? (
          <OrderAssigneeCard
            order={order}
            options={assigneeOptions}
            pending={assigneePending}
            onChange={onAssigneeChange}
          />
        ) : null}
        {partsSupplier || supplierOptions.length || onPartsSupplierChange ? (
          <OrderPartsSupplierCard
            supplier={partsSupplier}
            suppliers={supplierOptions}
            isUpdating={partsSupplierPending}
            onChange={onPartsSupplierChange}
          />
        ) : null}
        <OrderKeyInfoCard order={order} supplier={supplier} surface={surface} className="h-fit" />
        <OrderMessagesLog messages={messages} />
      </div>
      <OrderTimelineLog events={events} workflow={workflow} />
    </motion.div>
  );
}

function OrderAssigneeCard({
  order,
  options,
  pending,
  onChange,
}: {
  order: OrderDetail["order"];
  options: OrderAssigneeOption[];
  pending: boolean;
  onChange: (membershipId: string | null) => void;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
        <UserRound className="size-3.5 text-primary" />
        负责人
      </div>
      <Select
        value={order.assignee_membership_id ?? "unassigned"}
        onValueChange={(value) => onChange(value === "unassigned" ? null : value)}
        disabled={pending}
      >
        <SelectTrigger className="h-8 rounded-md text-xs">
          <SelectValue placeholder={order.technician_name || "未分配"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">未分配</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

function OrderPartsSupplierCard({
  supplier,
  suppliers,
  isUpdating,
  onChange,
}: {
  supplier?: Supplier;
  suppliers: Supplier[];
  isUpdating: boolean;
  onChange?: (supplierId: string | null) => void;
}) {
  return (
    <section data-order-parts-supplier-card="true" className={detailWorkspace.flatPanel}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <PackageSearch className="size-3.5 text-primary" />
            <span className="truncate">配件供应商</span>
          </h3>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
            仅使用当前店铺设置中的供应商。
          </p>
        </div>
      </div>
      {onChange ? (
        <div className="mt-2">
          <OrderSupplierPicker
            supplier={supplier}
            suppliers={suppliers}
            isUpdating={isUpdating}
            onChange={onChange}
            mode="dropdown"
            size="comfortable"
          />
        </div>
      ) : supplier ? (
        <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          <PackageSearch className="size-3 shrink-0" />
          <span className="truncate">{supplier.short_name || supplier.name}</span>
        </div>
      ) : null}
    </section>
  );
}

function OrderMessagesLog({ messages }: { messages: OrderDetail["messages"] }) {
  return (
    <section data-order-records-messages="true" className={detailWorkspace.flatPanel}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <MessageCircle className="size-3.5 text-primary" />
          <span className="truncate">通知历史</span>
        </h3>
        <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {messages.length}
        </span>
      </div>
      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] p-3 text-center text-xs text-muted-foreground">
          暂无通知记录
        </div>
      ) : (
        <ul className="grid min-w-0 gap-1.5">
          {messages.map((message) => (
            <li
              key={message.id}
              data-order-message-row="true"
              className="grid min-w-0 gap-1 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/65 px-2 py-1.5 text-xs"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span className="truncate">
                    {message.channel === "whatsapp" ? "WhatsApp" : "短信"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none",
                    message.status === "read"
                      ? "bg-status-success text-status-success-foreground"
                      : "bg-status-info text-status-info-foreground",
                  )}
                >
                  {message.status === "read" ? "已读" : message.status}
                </span>
              </div>
              <p className="line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground">
                {message.message_body}
              </p>
              <p className="truncate font-mono text-[10px] leading-3 text-muted-foreground/70">
                {new Date(message.sent_at).toLocaleString("zh-CN")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OrderTimelineLog({
  events,
  workflow,
}: {
  events: OrderDetail["events"];
  workflow: Parameters<typeof getWorkflowStatusLabel>[0];
}) {
  return (
    <section data-order-records-timeline="true" className={detailWorkspace.flatPanel}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <FileText className="size-3.5 text-primary" />
          <span className="truncate">时间线日志</span>
        </h3>
        <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {events.length}
        </span>
      </div>
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] p-3 text-center text-xs text-muted-foreground">
          暂无时间线记录
        </div>
      ) : (
        <ol className="grid min-w-0 gap-1.5">
          {events.map((event, index) => (
            <li
              key={event.id}
              data-order-record-row="true"
              className="grid min-w-0 gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/55 px-2 py-1.5 text-xs sm:grid-cols-[92px_minmax(0,1fr)]"
            >
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground sm:block">
                <span
                  className={cn(
                    "inline-grid size-5 shrink-0 place-items-center rounded-full font-semibold leading-none sm:mb-1",
                    index === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-[var(--surface-panel)] text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="font-mono tabular-nums">{formatShortDate(event.created_at)}</span>
                <span className="font-mono tabular-nums sm:block">
                  {formatClockTime(event.created_at)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {renderEvent(event.event_type, event.payload, workflow)}
                  </span>
                  <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {event.operator_name}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground/70">
                  {event.event_type}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function useDesktopActionSurface() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function ApprovalDecisionSheet({
  open,
  order,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  order: OrderDetail["order"];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: OrderApprovalDecisionInput) => Promise<unknown>;
}) {
  const custodyStatus = deviceCustodyStatusFromOrder(order);
  const custodyReady = custodyStatus === DEVICE_CUSTODY_WITH_SHOP;
  const [decision, setDecision] = useState<OrderApprovalDecisionInput["decision"]>("approved");
  const [approvedNext, setApprovedNext] = useState<RepairOrderStatus>(
    custodyReady ? getDefaultApprovedNextStatus(order) : "parts_ordered",
  );
  const [rejectedNext, setRejectedNext] = useState<RepairOrderStatus>(
    custodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER ? "cancelled" : "unfixed_pickup",
  );
  const [reason, setReason] = useState("");
  const nextStatus = decision === "approved" ? approvedNext : rejectedNext;
  const canSubmit =
    deviceCustodyAllowsStatus(custodyStatus, nextStatus) &&
    (decision === "approved" || Boolean(reason.trim()));
  const isDesktop = useDesktopActionSurface();

  useEffect(() => {
    if (!open) return;
    setDecision("approved");
    setApprovedNext(custodyReady ? getDefaultApprovedNextStatus(order) : "parts_ordered");
    setRejectedNext(
      custodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER ? "cancelled" : "unfixed_pickup",
    );
    setReason("");
  }, [custodyReady, custodyStatus, open, order]);

  const body = (
    <div className={cn(componentOverlay.body, "space-y-2 pt-3 lg:px-0 lg:pb-0")}>
      <section
        className={cn(
          componentOverlay.flatSection,
          "space-y-2 p-2.5 lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(280px,0.7fr)] lg:gap-3 lg:space-y-0",
        )}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left transition-colors",
                decision === "approved"
                  ? "border-status-success-foreground/30 bg-status-success/65 text-status-success-foreground"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel)]",
              )}
              disabled={pending}
              onClick={() => setDecision("approved")}
            >
              <span className="block text-xs font-semibold">客户同意</span>
              <span className="mt-0.5 block truncate text-[10px] opacity-75">
                进入维修、订件或寄修
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left transition-colors",
                decision === "rejected"
                  ? "border-status-danger-foreground/30 bg-status-danger/65 text-status-danger-foreground"
                  : "border-[var(--border-panel)] bg-[var(--surface-panel)]",
              )}
              disabled={pending || custodyStatus === null}
              onClick={() => setDecision("rejected")}
            >
              <span className="block text-xs font-semibold">客户拒绝</span>
              <span className="mt-0.5 block truncate text-[10px] opacity-75">未修取机或取消</span>
            </button>
          </div>

          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
            下一步状态
            {decision === "approved" ? (
              <Select
                value={approvedNext}
                onValueChange={(value) => setApprovedNext(value as RepairOrderStatus)}
                disabled={pending}
              >
                <SelectTrigger className="h-8 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {custodyReady ? <SelectItem value="repairing">开始维修</SelectItem> : null}
                  <SelectItem value="parts_ordered">需要订件</SelectItem>
                  {custodyReady ? <SelectItem value="mail_in_progress">转入寄修</SelectItem> : null}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={rejectedNext}
                onValueChange={(value) => setRejectedNext(value as RepairOrderStatus)}
                disabled={pending}
              >
                <SelectTrigger className="h-8 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {custodyReady ? <SelectItem value="unfixed_pickup">未修取机</SelectItem> : null}
                  <SelectItem value="cancelled">取消工单</SelectItem>
                </SelectContent>
              </Select>
            )}
          </label>
          {!custodyReady ? (
            <p className="rounded-lg border border-status-warn-foreground/25 bg-status-warn/45 px-2.5 py-2 text-[10px] leading-4 text-status-warn-foreground">
              {custodyStatus === null
                ? "请先补录设备保管状态；当前只能在客户同意后继续订件。"
                : "设备仍由客户持有；可继续订件，开始维修、寄修或未修取机前需先确认收机。"}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
            {decision === "approved" ? "备注" : "拒绝原因"}
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
              className="min-h-20 resize-none rounded-lg text-xs lg:min-h-[104px]"
              placeholder={
                decision === "approved"
                  ? "例如：客户 WhatsApp 确认同意报价。"
                  : "例如：维修风险过高，客户确认不继续维修并取回设备。"
              }
            />
          </label>

          <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
            审批结果会写入时间线；客户消息保持为独立沟通记录。
          </p>
        </div>
      </section>
    </div>
  );

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() => onOpenChange(false)}
      >
        取消
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 text-xs"
        disabled={pending || !canSubmit}
        onClick={async () => {
          await onConfirm({
            decision,
            next_status: nextStatus,
            reason: reason.trim() || undefined,
          });
        }}
      >
        {pending ? "保存中..." : "确认处理"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-order-desktop-approval-dialog="true"
          className={cn(componentOverlay.modalLg, "max-h-[calc(100svh-32px)] overflow-y-auto p-4")}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-primary" />
              客户审批处理
            </DialogTitle>
            <DialogDescription>
              {order.public_no} · 记录客户对当前报价的同意或拒绝，并推进到对应处理状态。
            </DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter className="gap-2 sm:gap-2">{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100svh-24px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-24px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-primary" />
              客户审批处理
            </SheetTitle>
            <SheetDescription>
              {order.public_no} · 记录客户对当前报价的同意或拒绝，并推进到对应处理状态。
            </SheetDescription>
          </SheetHeader>
          {body}
          <SheetFooter className={cn(componentOverlay.footer, "px-3 pb-3 sm:px-4")}>
            {footer}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderEditOfflineDraftNotice({
  state,
  errorMessage,
  lastSavedAt,
  prompt,
  pendingRestoreNotice,
  hasSensitiveUnlockDraft,
  isEditing,
  onRestore,
  onDiscard,
}: {
  state: EditOrderOfflineAutosaveState;
  errorMessage: string | null;
  lastSavedAt: string | null;
  prompt: EditOrderOfflineDraftPrompt | null;
  pendingRestoreNotice: string | null;
  hasSensitiveUnlockDraft: boolean;
  isEditing: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const showStatus =
    isEditing &&
    (state === "saving" ||
      state === "saved" ||
      state === "error" ||
      state === "unavailable" ||
      hasSensitiveUnlockDraft);
  if (!prompt && !pendingRestoreNotice && !showStatus) return null;

  const tone =
    prompt?.hasConflict || state === "error" || state === "unavailable" ? "danger" : "info";
  const title = prompt
    ? prompt.hasConflict
      ? "发现旧版本本机编辑草稿"
      : "发现未保存的本机编辑草稿"
    : state === "saving"
      ? "正在保存本机编辑草稿"
      : state === "saved"
        ? "本机编辑草稿已保存"
        : state === "unavailable" || state === "error"
          ? "本机编辑草稿暂不可用"
          : "本机编辑草稿";
  const description = prompt
    ? prompt.hasConflict
      ? "工单已经更新，为避免覆盖其他人的修改，当前草稿不能直接恢复。"
      : "草稿仅保存在当前浏览器；恢复后仍需在线点击保存。"
    : (pendingRestoreNotice ??
      (state === "saved" && lastSavedAt
        ? `最近保存：${formatDateTime(lastSavedAt)}。草稿仅保存在当前浏览器。`
        : (errorMessage ?? "编辑内容会保存在当前浏览器，在线保存后才会进入系统。")));
  const unlockNotice = hasSensitiveUnlockDraft
    ? "手机密码、PIN 或图案不会进入普通本机草稿，刷新后需要重新输入或在线保存。"
    : null;

  return (
    <section
      data-order-edit-offline-draft="true"
      className={cn(
        "rounded-xl border px-3 py-2.5 text-xs shadow-[var(--shadow-card)] sm:px-4",
        tone === "danger"
          ? "border-status-danger-foreground/20 bg-status-danger text-status-danger-foreground"
          : "border-primary/20 bg-primary/5 text-foreground",
      )}
    >
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Save className="size-4 shrink-0" />
            <p className="truncate text-sm font-semibold">{title}</p>
          </div>
          <p className="mt-1 break-words leading-5 text-muted-foreground">{description}</p>
          {unlockNotice ? (
            <p className="mt-1 break-words leading-5 text-muted-foreground">{unlockNotice}</p>
          ) : null}
        </div>
        {prompt ? (
          <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
            {!prompt.hasConflict ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                onClick={onRestore}
              >
                恢复编辑
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={onDiscard}
            >
              <Trash2 className="mr-1 size-3.5" />
              丢弃草稿
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MobileOrderDetailView({
  data,
  deviceLabel,
  deviceImei,
  accessoryNotes,
  storeSettings,
  workflow,
  topNotice,
  transitionPending,
  onTransition,
  onImeiSave,
  imeiPending,
  onFaultSave,
  faultPending,
  onDeviceUnlockSave,
  deviceUnlockPending,
  onAttachmentUpload,
  attachmentUploadPending,
  financeDraft,
  financeEditing,
  financeSaveError,
  onFinanceEditingChange,
  onFinanceDraftChange,
  onFinanceSave,
  financePending,
  canAdjustFinance,
  onNotify,
  onApprovalDecision,
  approvalDecisionAvailable,
  whatsappDisabled,
  onPay,
  paymentDisabled,
  onPrint,
  onCancel,
  canCancel,
  onRequestKioskSignature,
  kioskSignaturePending,
  kioskSignatureAvailable,
  partsSupplier,
  supplierOptions,
  partsSupplierPending,
  onPartsSupplierChange,
  assigneeOptions,
  assigneePending,
  onAssigneeChange,
  className,
}: {
  data: OrderDetail;
  deviceLabel: string;
  deviceImei: string;
  accessoryNotes?: string;
  storeSettings?: StoreSettings;
  workflow?: OrderWorkflow;
  topNotice?: ReactNode;
  transitionPending: boolean;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
  onImeiSave: (imei: string) => Promise<void>;
  imeiPending: boolean;
  onFaultSave: (
    changes: Pick<PatchOrderChanges, "issue_description" | "diagnosis_result">,
  ) => Promise<void>;
  faultPending: boolean;
  onDeviceUnlockSave: (input: DeviceUnlockInput) => Promise<void>;
  deviceUnlockPending: boolean;
  onAttachmentUpload: (input: OrderAttachmentUploadInput) => Promise<void>;
  attachmentUploadPending: boolean;
  financeDraft: FinanceDraftState;
  financeEditing: boolean;
  financeSaveError: string;
  onFinanceEditingChange: (editing: boolean) => void;
  onFinanceDraftChange: (draft: FinanceDraftState) => void;
  onFinanceSave: () => Promise<boolean>;
  financePending: boolean;
  canAdjustFinance: boolean;
  onNotify: () => void;
  onApprovalDecision: () => void;
  approvalDecisionAvailable: boolean;
  whatsappDisabled: boolean;
  onPay: () => void;
  paymentDisabled: boolean;
  onPrint: () => void;
  onCancel: () => void;
  canCancel: boolean;
  onRequestKioskSignature?: () => void;
  kioskSignaturePending: boolean;
  kioskSignatureAvailable: boolean;
  partsSupplier?: Supplier;
  supplierOptions: Supplier[];
  partsSupplierPending: boolean;
  onPartsSupplierChange?: (supplierId: string | null) => void;
  assigneeOptions: OrderAssigneeOption[];
  assigneePending: boolean;
  onAssigneeChange?: (membershipId: string | null) => void;
  className?: string;
}) {
  const { order, customer } = data;
  const cancelled = isOrderCancelledForPayment(order);
  const isVoided = order.record_state === "voided" || Boolean(order.deleted_at);
  const custodyStatus = deviceCustodyStatusFromOrder(order);
  const events = data.events ?? [];
  const workflowStatus = cancelled ? "closed" : getOrderWorkflowStatus(order);
  const currentStageIndex = getWorkflowProgressValue(workflowStatus);
  const next = cancelled
    ? { primary: undefined, secondary: [] }
    : getWorkflowNextActions(workflow, order.status);
  const phone = customer?.phone_e164 || order.customer_phone;
  const rawCustomerName = (customer?.name || order.customer_name || "").trim();
  const customerDisplayName =
    rawCustomerName && normalizePhoneDigits(rawCustomerName) !== normalizePhoneDigits(phone)
      ? rawCustomerName
      : "未命名客户";
  const whatsappHref = getWhatsappHref(phone);
  const paidAmount = inferOrderPaidAmount(order);
  const currentStage = cancelled
    ? getOrderTaskGuidance(order).stage
    : (orderTaskStages[Math.min(currentStageIndex, orderTaskStages.length - 1)] ??
      orderTaskStages[0]);
  const [imeiEditing, setImeiEditing] = useState(false);
  const [imeiDraft, setImeiDraft] = useState(deviceImei);
  const [faultEditing, setFaultEditing] = useState(false);
  const [deviceUnlockEditing, setDeviceUnlockEditing] = useState(false);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [photoPreviewId, setPhotoPreviewId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [floatingHeaderOffset, setFloatingHeaderOffset] = useState(
    "calc(env(safe-area-inset-top) + 10.75rem)",
  );
  const photoAttachments = useMemo(
    () =>
      (data.attachments ?? []).filter(
        (attachment) =>
          attachment.mime_type.startsWith("image/") && attachment.kind !== "signature",
      ),
    [data.attachments],
  );
  const latestEvent = events[0];
  const currentStatusChangedAt = findCurrentOrderStatusChangedAt({
    status: order.status,
    createdAt: order.created_at,
    events,
  });
  const normalizedFinance = useMemo(
    () => normalizeFinanceDraft(financeDraft, paidAmount),
    [financeDraft, paidAmount],
  );
  const statusActions =
    data.capabilities?.canTransition && !cancelled && !isVoided
      ? getWorkflowTransitionActions(workflow, order.status).filter((action) =>
          deviceCustodyAllowsStatus(
            custodyStatus,
            action.to,
            getWorkflowStatus(workflow, action.to)?.bucket,
          ),
        )
      : [];

  useEffect(() => {
    if (!photoPreviewId) return;
    if (!photoAttachments.some((attachment) => attachment.id === photoPreviewId)) {
      setPhotoPreviewId(null);
    }
  }, [photoAttachments, photoPreviewId]);

  useEffect(() => {
    if (!imeiEditing) setImeiDraft(deviceImei);
  }, [deviceImei, imeiEditing]);

  const handleFloatingHeaderHeight = useCallback((height: number) => {
    setFloatingHeaderOffset(`${Math.ceil(height + 8)}px`);
  }, []);

  return (
    <div
      data-mobile-order-page="true"
      className={cn(repairOs.mobileFloatingPage, className)}
      style={
        {
          "--repair-os-mobile-floating-offset": floatingHeaderOffset,
        } as CSSProperties
      }
    >
      <MobileStickyWorkflowHeader
        order={order}
        workflow={workflow}
        currentStageIndex={currentStageIndex}
        currentStage={currentStage}
        nextLabel={next.primary?.label}
        onHeightChange={handleFloatingHeaderHeight}
        onPrint={onPrint}
        onCancel={onCancel}
        canCancel={canCancel}
      />

      {topNotice}

      {approvalDecisionAvailable ? (
        <section className={cn(mobileDetailCardClass, "border-primary/25 bg-primary/5")}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <MobileSectionTitle icon={MessageCircle} title="客户审批" />
              <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
                报价已发送或待确认，请记录客户同意/拒绝后的真实处理结果。
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg px-2 text-[11px]"
              onClick={onApprovalDecision}
            >
              审批处理
            </Button>
          </div>
        </section>
      ) : null}

      <section data-mobile-order-first-card="true" className={mobileDetailCardClass}>
        <MobileSectionTitle icon={Calendar} title="基础信息" />
        <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-4">
          <MobileMeta icon={Calendar} label="送修时间" value={formatDateTime(order.created_at)} />
          <MobileMeta
            icon={Clock3}
            label="状态时间"
            value={formatDateTime(currentStatusChangedAt)}
          />
          <MobileMeta icon={UserRound} label="负责人" value={order.technician_name || "-"} />
          <MobileMeta icon={Store} label="门店" value={storeSettings?.store_name || "ChinaTech"} />
        </div>
      </section>

      {onAssigneeChange ? (
        <section className={mobileDetailCardClass}>
          <MobileSectionTitle icon={UserRound} title="负责人" />
          <div className="mt-1.5">
            <Select
              value={order.assignee_membership_id ?? "unassigned"}
              onValueChange={(value) => onAssigneeChange(value === "unassigned" ? null : value)}
              disabled={assigneePending}
            >
              <SelectTrigger className="h-9 rounded-md text-xs">
                <SelectValue placeholder={order.technician_name || "未分配"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">未分配</SelectItem>
                {assigneeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      ) : null}

      {partsSupplier || supplierOptions.length || onPartsSupplierChange ? (
        <section className={mobileDetailCardClass}>
          <MobileSectionTitle icon={PackageSearch} title="配件供应商" />
          <div className="mt-1.5">
            {onPartsSupplierChange ? (
              <OrderSupplierPicker
                supplier={partsSupplier}
                suppliers={supplierOptions}
                isUpdating={partsSupplierPending}
                onChange={onPartsSupplierChange}
                mode="sheet"
                size="comfortable"
              />
            ) : partsSupplier ? (
              <div className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                <PackageSearch className="size-3 shrink-0" />
                <span className="truncate">{partsSupplier.short_name || partsSupplier.name}</span>
              </div>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[9px] leading-3 text-muted-foreground">
            只读取当前店铺设置中的供应商。
          </p>
        </section>
      ) : null}

      <button
        type="button"
        className={cn(
          mobileDetailCardClass,
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left transition-colors active:bg-[var(--surface-panel-muted)]",
        )}
        onClick={() => setTimelineOpen(true)}
      >
        <div className="min-w-0">
          <MobileSectionTitle icon={Clock3} title="历史记录" />
          <p className="mt-1 truncate text-[11px] font-medium leading-4">
            {latestEvent
              ? renderEvent(latestEvent.event_type, latestEvent.payload, workflow)
              : "暂无操作记录"}
          </p>
          <p className="truncate text-[9px] leading-3 text-muted-foreground">
            {latestEvent
              ? `${formatDateTime(latestEvent.created_at)} · ${latestEvent.operator_name || "系统"}`
              : "状态流转、报价、收款、照片上传都会记录在这里"}
          </p>
        </div>
        <span className="rounded-lg border border-[var(--border-panel)] px-2 py-1 text-[10px] font-medium text-primary">
          查看全部
        </span>
      </button>

      <div className="grid min-w-0 grid-cols-1 gap-1.5 min-[390px]:grid-cols-2">
        <section className={mobileDetailCardClass}>
          <MobileSectionTitle icon={UserRound} title="客户信息" />
          <div className="mt-1.5 grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-1.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
              {customerDisplayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold leading-4">{customerDisplayName}</p>
              <PhoneText value={phone} className="block truncate text-[11px] leading-4" />
            </div>
          </div>
          {customer?.preferred_channel ? (
            <div className="mt-1 flex min-w-0">
              <span className="truncate rounded bg-status-success px-1.5 py-0.5 text-[9px] font-medium leading-3 text-status-success-foreground">
                {customer.preferred_channel}
              </span>
            </div>
          ) : null}
          <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 w-full min-w-0 gap-1 overflow-hidden rounded-lg px-1.5 text-[11px] font-semibold [&_svg]:size-3.5"
            >
              <a href={`tel:${phone}`} aria-label="拨打电话" title="拨打电话">
                <Phone className="shrink-0" />
                <span className="min-w-0 truncate">电话</span>
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 w-full min-w-0 gap-1 overflow-hidden rounded-lg px-1.5 text-[11px] font-semibold text-status-success-foreground [&_svg]:size-3.5"
            >
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
                <MessageCircle className="shrink-0" />
                <span className="min-w-0 truncate">WhatsApp</span>
              </a>
            </Button>
            {onRequestKioskSignature ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2 h-9 w-full min-w-0 gap-1 overflow-hidden rounded-lg px-1.5 text-[11px] font-semibold [&_svg]:size-3.5"
                disabled={!kioskSignatureAvailable || kioskSignaturePending}
                onClick={onRequestKioskSignature}
              >
                <TabletSmartphone className="shrink-0" />
                <span className="min-w-0 truncate">
                  {kioskSignaturePending
                    ? "发送中"
                    : kioskSignatureAvailable
                      ? "发送到 iPad"
                      : "无可用 iPad"}
                </span>
              </Button>
            ) : null}
          </div>
        </section>

        <section className={mobileDetailCardClass}>
          <MobileSectionTitle
            icon={Smartphone}
            title="设备信息"
            action={
              data.capabilities?.canEditIntake || data.capabilities?.canEditRepair ? (
                <div className="flex shrink-0 items-center gap-1">
                  {data.capabilities?.canEditRepair &&
                  custodyStatus === DEVICE_CUSTODY_WITH_SHOP ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-2 text-[11px]"
                      onClick={() => setDeviceUnlockEditing(true)}
                    >
                      密码
                    </Button>
                  ) : null}
                  {data.capabilities?.canEditIntake ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-2 text-[11px]"
                      onClick={() => {
                        setImeiDraft(deviceImei);
                        setImeiEditing(true);
                      }}
                    >
                      <ScanLine className="mr-1 size-4" />
                      扫码
                    </Button>
                  ) : null}
                </div>
              ) : undefined
            }
          />
          <div className="mt-1.5 min-w-0">
            <p className="truncate text-xs font-semibold leading-4">{deviceLabel}</p>
            <DetailRows
              rows={[
                ["IMEI", deviceImei || "-"],
                ["质保", order.warranty_text || "-"],
                ["设备保管", deviceCustodyLabel(custodyStatus)],
                ["随附物品", accessoryNotes || "-"],
              ]}
            />
            {custodyStatus === DEVICE_CUSTODY_WITH_SHOP ? (
              <DeviceUnlockViewer order={order} compact className="mt-1.5" />
            ) : (
              <p className="mt-1.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
                {custodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER
                  ? "设备未留店，不登记手机密码。"
                  : "保管状态待确认，暂不展示手机密码。"}
              </p>
            )}
          </div>
        </section>
      </div>

      <ImeiCaptureSheet
        open={imeiEditing}
        onOpenChange={(open) => {
          setImeiEditing(open);
          if (open) setImeiDraft(deviceImei);
        }}
        value={imeiDraft}
        savedValue={deviceImei}
        pending={imeiPending}
        onChange={setImeiDraft}
        onSave={async () => {
          await onImeiSave(imeiDraft);
          setImeiEditing(false);
        }}
      />

      <section className={mobileDetailCardClass}>
        <MobileSectionTitle
          icon={FileText}
          title="故障描述"
          action={
            data.capabilities?.canEditIntake || data.capabilities?.canEditRepair ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 rounded-md px-1.5 text-[10px]"
                onClick={() => setFaultEditing(true)}
              >
                编辑
              </Button>
            ) : undefined
          }
        />
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs font-medium leading-4 text-foreground">
          {order.issue_description || "-"}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
          诊断结果：{order.diagnosis_result || "尚未填写"}
        </p>
        {order.fault_prices.length ? (
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            {order.fault_prices.slice(0, 3).map((item, index) => (
              <span
                key={`${item.name}-${index}`}
                className="max-w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium leading-3 text-primary"
              >
                {item.name || "未命名项目"}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <FaultDescriptionEditSheet
        open={faultEditing}
        order={order}
        canEditIntake={Boolean(data.capabilities?.canEditIntake)}
        canEditRepair={Boolean(data.capabilities?.canEditRepair)}
        pending={faultPending}
        onOpenChange={setFaultEditing}
        onSave={onFaultSave}
      />

      <DeviceUnlockEditSheet
        open={deviceUnlockEditing}
        order={order}
        pending={deviceUnlockPending}
        onOpenChange={setDeviceUnlockEditing}
        onSave={onDeviceUnlockSave}
      />

      {order.finance_redacted ? (
        <section className={mobileDetailCardClass}>
          <MobileSectionTitle icon={WalletCards} title="报价与支付" />
          <div className="mt-1.5 rounded-lg border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-[10px] font-medium text-muted-foreground">
            金额与结算状态受限
          </div>
        </section>
      ) : (
        <div className="grid min-w-0 grid-cols-2 gap-1.5">
          <section className={cn(mobileDetailCardClass, financeEditing && "col-span-2")}>
            <MobileSectionTitle
              icon={ReceiptText}
              title="维修项目与报价"
              action={
                canAdjustFinance ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 rounded-md px-1.5 text-[10px]"
                    onClick={() => onFinanceEditingChange(!financeEditing)}
                  >
                    {financeEditing ? "收起" : "编辑"}
                  </Button>
                ) : undefined
              }
            />
            {financeEditing ? (
              <MobileFinanceEditor
                draft={financeDraft}
                normalized={normalizedFinance}
                saveError={financeSaveError}
                pending={financePending}
                onChange={onFinanceDraftChange}
                onCancel={() => {
                  onFinanceDraftChange(
                    createFinanceDraftState(order.fault_prices, order.deposit_amount),
                  );
                  onFinanceEditingChange(false);
                }}
                onSave={async () => {
                  try {
                    const saved = await onFinanceSave();
                    if (saved) onFinanceEditingChange(false);
                    return saved;
                  } catch {
                    // Mutation error toast is handled by the parent mutation.
                    return false;
                  }
                }}
              />
            ) : (
              <div className="mt-1.5 space-y-1">
                {order.fault_prices.length ? (
                  order.fault_prices.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex min-w-0 items-center gap-1 text-[11px] leading-4"
                    >
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {item.name || "未命名项目"}
                      </span>
                      <MoneyText amount={item.price} className="shrink-0 font-semibold" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[var(--border-panel)] px-1.5 py-2 text-center text-[10px] text-muted-foreground">
                    暂无报价项目
                  </div>
                )}
              </div>
            )}
          </section>

          <section className={mobileDetailCardClass}>
            <MobileSectionTitle icon={WalletCards} title="支付信息" />
            <MobilePaymentSummary
              total={order.quotation_amount}
              deposit={order.deposit_amount}
              balance={order.balance_amount}
              cancelled={cancelled}
              className="mt-1.5"
            />
          </section>
        </div>
      )}

      <section className={mobileDetailCardClass}>
        <MobileSectionTitle icon={ImageIcon} title="设备照片" />
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {photoAttachments.slice(0, 2).map((attachment) => (
            <PhotoPreview
              key={attachment.id}
              attachment={attachment}
              onOpen={() => setPhotoPreviewId(attachment.id)}
            />
          ))}
          {photoAttachments.length === 0 ? (
            <>
              <PhotoPlaceholder label="正面" />
              <PhotoPlaceholder label="背面" />
            </>
          ) : photoAttachments.length === 1 ? (
            <PhotoPlaceholder label="补充" />
          ) : null}
          {!isVoided ? (
            <button
              type="button"
              className="grid h-14 place-items-center rounded-lg border border-dashed border-primary/35 bg-primary/5 text-[10px] font-medium text-primary disabled:opacity-60"
              disabled={attachmentUploadPending}
              onClick={() => setPhotoCaptureOpen(true)}
            >
              <span className="grid place-items-center gap-1">
                <Camera className="size-4" />
                {attachmentUploadPending ? "上传中" : "拍照"}
              </span>
            </button>
          ) : null}
        </div>
        {photoAttachments.length ? (
          <p className="mt-1 text-[9px] leading-3 text-muted-foreground">
            已保存 {photoAttachments.length} 张照片到工单，更多操作可在历史记录查看。
          </p>
        ) : null}
      </section>

      {!isVoided ? (
        <CameraCaptureSheet
          open={photoCaptureOpen}
          onOpenChange={setPhotoCaptureOpen}
          title="拍摄设备照片"
          description="拍摄设备外观、故障位置或取件凭证。确认后会保存到当前工单。"
          attachmentKind="fault_photo"
          onCapture={(draft) => {
            void uploadAttachmentDraft(draft, onAttachmentUpload);
          }}
        />
      ) : null}

      <OrderPhotoPreviewDialog
        attachments={photoAttachments}
        activeId={photoPreviewId}
        onActiveIdChange={setPhotoPreviewId}
      />

      <MobileTimelineSheet
        open={timelineOpen}
        events={events}
        workflow={workflow}
        onOpenChange={setTimelineOpen}
      />

      {!isVoided ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-panel)] bg-background/95 px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-1.5 shadow-[0_-10px_30px_color-mix(in_oklch,var(--foreground)_10%,transparent)] backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-[430px] grid-cols-[1.25fr_1fr_1fr] gap-1.5">
            <Button
              className="h-9 rounded-xl border-0 text-xs text-primary-foreground"
              style={{ background: "var(--gradient-brand)" }}
              disabled={whatsappDisabled}
              onClick={onNotify}
            >
              <Send className="mr-1 size-3.5" /> WhatsApp
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-xl text-xs"
              disabled={financeEditing || statusActions.length === 0 || transitionPending}
              onClick={() => setStatusSheetOpen(true)}
            >
              <Clock3 className="mr-1 size-3.5" /> 流转
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-xl text-xs"
              disabled={
                financeEditing ||
                paymentDisabled ||
                cancelled ||
                order.finance_redacted ||
                order.is_paid ||
                order.balance_amount <= 0
              }
              onClick={onPay}
            >
              <CreditCard className="mr-1 size-3.5" /> {cancelled ? "不可收款" : "收款"}
            </Button>
          </div>
        </div>
      ) : null}

      <MobileStatusTransitionSheet
        open={statusSheetOpen}
        order={order}
        statusLabel={getWorkflowStatusLabel(workflow, order.status)}
        currentStage={currentStage}
        actions={statusActions}
        pending={transitionPending}
        onOpenChange={setStatusSheetOpen}
        onTransition={onTransition}
      />
    </div>
  );
}

async function uploadAttachmentDraft(
  draft: AttachmentDraft,
  onUpload: (input: OrderAttachmentUploadInput) => Promise<void>,
) {
  try {
    const dataBase64 = await fileToBase64(draft.file);
    await onUpload({
      kind: draft.kind,
      file_name: draft.name,
      mime_type: draft.mimeType || draft.file.type || "image/jpeg",
      file_size: draft.size,
      data_base64: dataBase64,
    });
  } finally {
    revokeAttachmentDraft(draft);
  }
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取照片失败，请重新拍摄"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      if (!base64) {
        reject(new Error("照片内容为空，请重新拍摄"));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function MobileTimelineSheet({
  open,
  events,
  workflow,
  onOpenChange,
}: {
  open: boolean;
  events: OrderDetail["events"];
  workflow?: OrderWorkflow;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4 text-primary" />
              历史操作记录
            </SheetTitle>
            <SheetDescription>
              状态流转、报价、收款、通知和附件上传都会记录在这里。
            </SheetDescription>
          </SheetHeader>
          <div className={cn(componentOverlay.body, "space-y-2 pt-3")}>
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-panel)] px-3 py-6 text-center text-xs text-muted-foreground">
                暂无操作记录
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel)] px-3 py-2"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-xs font-semibold leading-5">
                      {renderEvent(event.event_type, event.payload, workflow)}
                    </p>
                    <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      {event.operator_name || "系统"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ImeiCaptureSheet({
  open,
  value,
  savedValue,
  pending,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  value: string;
  savedValue: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"choice" | "barcode" | "ocr">("choice");
  const [scannerToken, setScannerToken] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [ocrCandidates, setOcrCandidates] = useState<ImeiCandidate[]>([]);
  const [selectedOcrCandidateId, setSelectedOcrCandidateId] = useState("");
  const [ocrPending, setOcrPending] = useState(false);
  const [error, setError] = useState("");
  const selectedOcrCandidate =
    ocrCandidates.find((candidate) => candidate.id === selectedOcrCandidateId) ??
    ocrCandidates[0] ??
    null;

  useEffect(() => {
    if (!open) return;
    setMode("choice");
    setOcrText("");
    setOcrCandidates([]);
    setSelectedOcrCandidateId("");
    setError("");
  }, [open]);

  const chooseBarcode = () => {
    setMode("barcode");
    setError("");
    setScannerToken((current) => current + 1);
  };

  const handleOcrFile = async (file?: File) => {
    if (!file) return;
    const fileError = validateImeiOcrImageFile(file);
    if (fileError) {
      setError(fileError);
      toast.error(fileError);
      return;
    }

    setOcrPending(true);
    setError("");
    setOcrCandidates([]);
    setSelectedOcrCandidateId("");
    try {
      const text = await withImeiOcrTimeout(
        detectTextFromImageFile(file),
        imeiOcrDecodeTimeoutMs,
        "OCR 识别超时",
      );
      const candidates = extractImeiCandidates(text, {
        source: "ocr",
        includeGenericSerial: true,
      });
      setOcrText(candidates.length > 0 ? `已识别到 ${candidates.length} 个候选编号。` : "");
      const candidate = getPreferredImeiCandidate(candidates);
      if (!candidate) {
        setError("未自动识别到 IMEI / 序列号。请检查照片清晰度，或手动确认输入。");
        return;
      }
      if (candidates.length > 1 || candidate.kind === "suspect_imei") {
        setOcrCandidates(candidates);
        setSelectedOcrCandidateId(candidate.id);
        setError(
          candidates.length > 1
            ? "找到多个可能的编号，请选择一个后保存。"
            : "找到疑似编号，请确认后再填入。",
        );
        return;
      }
      onChange(candidate.value);
      toast.success("已识别并填入 IMEI / 序列号");
    } catch (error) {
      const message = getImeiOcrErrorMessage(error);
      setError(message);
      toast.error(message);
    } finally {
      setOcrPending(false);
    }
  };

  const save = async () => {
    try {
      await onSave();
    } catch (error) {
      const message = getImeiSaveErrorMessage(error);
      setError(message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ScanLine className="size-4 text-primary" />
              录入 IMEI / 序列号
            </SheetTitle>
            <SheetDescription>
              选择二维码 / 条码扫描，或用 OCR 拍照识别机身、包装上的数字。
            </SheetDescription>
          </SheetHeader>

          <div className={cn(componentOverlay.body, "space-y-3 pt-3")}>
            <input
              ref={fileInputRef}
              type="file"
              accept={imeiOcrImageAccept}
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void handleOcrFile(file);
              }}
            />

            {mode === "choice" ? (
              <section className={cn(componentOverlay.flatSection, "grid gap-2 p-2.5")}>
                <button
                  type="button"
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2 text-left"
                  disabled={pending}
                  onClick={chooseBarcode}
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <ScanLine className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">扫描二维码 / 条码</span>
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground">
                      对准 IMEI 条码或序列号二维码，识别后自动填入。
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] px-2.5 py-2 text-left"
                  disabled={pending || ocrPending}
                  onClick={() => {
                    setMode("ocr");
                    fileInputRef.current?.click();
                  }}
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
                    <Camera className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">OCR 识别文字</span>
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground">
                      适合没有二维码、只显示数字的设备标签。
                    </span>
                  </span>
                </button>
              </section>
            ) : null}

            {mode === "barcode" ? (
              <section
                className={cn(
                  componentOverlay.flatSection,
                  "space-y-2 p-2.5",
                  pending && "pointer-events-none opacity-60",
                )}
              >
                <ImeiScannerField
                  value={value}
                  onChange={onChange}
                  placeholder="扫描或输入 IMEI"
                  density="compact"
                  showPaste={false}
                  startScannerToken={scannerToken}
                />
                <p className="text-[10px] leading-4 text-muted-foreground">
                  当前入口不显示粘贴按钮；无法识别时可直接手动输入。
                </p>
              </section>
            ) : null}

            {mode === "ocr" ? (
              <section className={cn(componentOverlay.flatSection, "space-y-2 p-2.5")}>
                <div className="grid gap-1">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    识别结果 / 手动确认
                  </label>
                  <Input
                    value={value}
                    onChange={(event) =>
                      onChange(normalizeImeiIdentifier(event.target.value).value)
                    }
                    disabled={pending}
                    className="h-8 font-mono text-xs"
                    placeholder="拍照识别后会填入这里"
                  />
                </div>
                {ocrText ? (
                  <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
                    {ocrText}
                  </div>
                ) : null}
                {ocrCandidates.length > 0 ? (
                  <div className="grid gap-1.5">
                    {ocrCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={cn(
                          "min-w-0 rounded-lg border px-2 py-1.5 text-left",
                          selectedOcrCandidateId === candidate.id
                            ? "border-primary bg-primary/10"
                            : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
                        )}
                        aria-pressed={selectedOcrCandidateId === candidate.id}
                        onClick={() => setSelectedOcrCandidateId(candidate.id)}
                      >
                        <span className="flex min-w-0 items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-semibold">
                            {candidate.label}
                          </span>
                          <span className="shrink-0 text-[9px] text-muted-foreground">
                            {candidate.confidence === "high" ? "高可信" : "需确认"}
                          </span>
                        </span>
                        <span className="mt-0.5 block break-all font-mono text-[10px]">
                          {candidate.value}
                        </span>
                        {candidate.reason ? (
                          <span className="mt-0.5 block text-[9px] leading-3 text-status-warn-foreground">
                            {candidate.reason}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full rounded-lg text-xs"
                      disabled={!selectedOcrCandidate || pending}
                      onClick={() => {
                        if (selectedOcrCandidate) onChange(selectedOcrCandidate.value);
                      }}
                    >
                      使用选择的编号
                    </Button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-lg text-xs"
                  disabled={pending || ocrPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 size-3.5" />
                  {ocrPending ? "识别中..." : "重新拍照识别"}
                </Button>
              </section>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-status-danger px-2.5 py-2 text-[10px] leading-4 text-status-danger-foreground">
                {error}
              </p>
            ) : null}

            <SheetFooter className={componentOverlay.footer}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={pending}
                onClick={() => {
                  onChange(savedValue);
                  onOpenChange(false);
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={pending || ocrPending}
                onClick={() => void save()}
              >
                {pending ? "保存中..." : "保存"}
              </Button>
            </SheetFooter>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeviceUnlockEditSheet({
  open,
  order,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  order: OrderDetail["order"];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: DeviceUnlockInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DeviceUnlockInput>(() => deviceUnlockInputFromOrder(order));
  const [error, setError] = useState("");
  const validationError = useMemo(() => {
    try {
      normalizeDeviceUnlockInput(draft);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "手机密码格式不正确";
    }
  }, [draft]);
  const helperError = error || validationError;

  useEffect(() => {
    if (!open) return;
    setDraft(deviceUnlockInputFromOrder(order));
    setError("");
  }, [open, order]);

  const save = async () => {
    setError("");
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await onSave(draft);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "手机密码保存失败";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] rounded-t-xl p-0 md:h-auto md:max-h-[calc(100svh-64px)] md:w-[min(520px,calc(100vw-32px))] md:max-w-[calc(100vw-32px)] md:rounded-xl"
      >
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-3 py-2 pr-11 text-left">
            <SheetTitle className="text-sm leading-5">编辑手机密码</SheetTitle>
            <SheetDescription className="text-[10px] leading-3">
              {order.public_no} · 默认只在详情里遮挡查看，不进入列表、打印或消息正文。
            </SheetDescription>
          </SheetHeader>
          <div
            className={cn(componentOverlay.body, "min-h-0 flex-1 space-y-2 overflow-y-auto p-3")}
          >
            <DeviceUnlockEditor value={draft} onChange={setDraft} />
            {helperError ? (
              <p className="rounded-lg bg-status-danger px-2 py-1.5 text-[10px] font-medium leading-3 text-status-danger-foreground">
                {helperError}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-t border-[var(--border-panel)] p-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={pending || Boolean(validationError)}
              onClick={() => void save()}
            >
              {pending ? "保存中..." : "保存"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FaultDescriptionEditSheet({
  open,
  order,
  canEditIntake,
  canEditRepair,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  order: OrderDetail["order"];
  canEditIntake: boolean;
  canEditRepair: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    changes: Pick<PatchOrderChanges, "issue_description" | "diagnosis_result">,
  ) => Promise<void>;
}) {
  const [issue, setIssue] = useState(order.issue_description || "");
  const [diagnosis, setDiagnosis] = useState(order.diagnosis_result || "");
  const [error, setError] = useState("");
  const quoteItems = getFaultDescriptionSourceItems(order.fault_prices);
  const missingIssueCount = countMissingFaultDescriptionItems(issue, quoteItems);
  const missingDiagnosisCount = countMissingFaultDescriptionItems(diagnosis, quoteItems);

  useEffect(() => {
    if (!open) return;
    setIssue(order.issue_description || "");
    setDiagnosis(order.diagnosis_result || "");
    setError("");
  }, [open, order.diagnosis_result, order.issue_description]);

  const appendItems = (target: "issue" | "diagnosis", items: FaultDescriptionSourceItem[]) => {
    const setter = target === "issue" ? setIssue : setDiagnosis;
    const current = target === "issue" ? issue : diagnosis;
    setter(appendFaultDescriptionItems(current, items));
    setError("");
  };

  const save = async () => {
    const normalizedIssue = issue.trim();
    const normalizedDiagnosis = diagnosis.trim();
    if (canEditIntake && !normalizedIssue) {
      setError("故障描述不能为空。");
      return;
    }

    try {
      const changes: Pick<PatchOrderChanges, "issue_description" | "diagnosis_result"> = {};
      if (canEditIntake && normalizedIssue !== (order.issue_description || "").trim()) {
        changes.issue_description = normalizedIssue;
      }
      if (canEditRepair && normalizedDiagnosis !== (order.diagnosis_result || "").trim()) {
        changes.diagnosis_result = normalizedDiagnosis || undefined;
      }
      if (!Object.keys(changes).length) {
        setError("没有可保存的修改。");
        return;
      }
      await onSave(changes);
      onOpenChange(false);
    } catch (error) {
      const message = getOrderPatchSaveErrorMessage(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] rounded-t-xl p-0 md:h-[82svh] md:max-h-[760px] md:w-[calc(100vw-32px)] md:max-w-[920px] md:rounded-xl"
      >
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-3 py-2 pr-11 text-left sm:px-4">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="min-w-0">
                <SheetTitle className="flex min-w-0 items-center gap-2 text-sm leading-5">
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="truncate">编辑故障描述</span>
                </SheetTitle>
                <SheetDescription className="mt-0.5 truncate text-[10px] leading-3">
                  {order.public_no} · {quoteItems.length} 个维修项目
                </SheetDescription>
              </div>
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-primary/15 bg-primary/5 text-center">
                <div className="min-w-0 border-r border-primary/10 px-2 py-1">
                  <p className="text-[9px] leading-3 text-muted-foreground">故障缺</p>
                  <p className="font-mono text-xs font-semibold leading-4 text-primary">
                    {missingIssueCount}
                  </p>
                </div>
                <div className="min-w-0 px-2 py-1">
                  <p className="text-[9px] leading-3 text-muted-foreground">诊断缺</p>
                  <p className="font-mono text-xs font-semibold leading-4 text-primary">
                    {missingDiagnosisCount}
                  </p>
                </div>
              </div>
            </div>
          </SheetHeader>

          <div
            className={cn(
              componentOverlay.body,
              "min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2 pt-2 sm:px-3 md:grid md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] md:items-start md:gap-2 md:space-y-0",
            )}
          >
            {quoteItems.length ? (
              <section className={cn(componentOverlay.flatSection, "space-y-1.5 p-2")}>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-medium leading-3 text-muted-foreground">
                    维修项目来源
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      disabled={pending || !canEditIntake || missingIssueCount === 0}
                      onClick={() => appendItems("issue", quoteItems)}
                    >
                      全入故障
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      disabled={pending || !canEditRepair || missingDiagnosisCount === 0}
                      onClick={() => appendItems("diagnosis", quoteItems)}
                    >
                      全入诊断
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1 md:max-h-[calc(82svh-9rem)] md:overflow-y-auto md:pr-0.5">
                  {quoteItems.map((item, index) => {
                    const inIssue = hasFaultDescriptionItem(issue, item);
                    const inDiagnosis = hasFaultDescriptionItem(diagnosis, item);

                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md bg-[var(--surface-panel-muted)] px-2 py-1"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold leading-4">
                            {item.name}
                          </p>
                          <div className="flex min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground">
                            <MoneyText amount={item.price} className="shrink-0" />
                            {item.note ? <span className="truncate">{item.note}</span> : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          disabled={pending || !canEditIntake || inIssue}
                          aria-label={`将 ${item.name} 加入故障描述`}
                          onClick={() => appendItems("issue", [item])}
                        >
                          {inIssue ? "已故障" : "故障"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          disabled={pending || !canEditRepair || inDiagnosis}
                          aria-label={`将 ${item.name} 加入诊断结果`}
                          onClick={() => appendItems("diagnosis", [item])}
                        >
                          {inDiagnosis ? "已诊断" : "诊断"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className={cn(componentOverlay.flatSection, "p-2")}>
                <p className="grid rounded-lg border border-dashed border-[var(--border-panel)] px-2 py-3 text-center text-[10px] leading-4 text-muted-foreground md:min-h-40 md:place-items-center">
                  暂无可带入项目，可直接手动填写。
                </p>
              </section>
            )}

            <section className={cn(componentOverlay.flatSection, "space-y-2 p-2")}>
              <label className="grid gap-1 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center justify-between gap-2">
                  <span>故障描述{canEditIntake ? "" : "（只读）"}</span>
                  <span className="font-mono text-[9px] font-normal text-muted-foreground">
                    {issue.trim().length}
                  </span>
                </span>
                <Textarea
                  value={issue}
                  onChange={(event) => setIssue(event.target.value)}
                  disabled={pending || !canEditIntake}
                  className="min-h-24 resize-none rounded-lg text-xs md:min-h-[230px]"
                  placeholder="描述客户反馈、故障表现、可复现条件等"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center justify-between gap-2">
                  <span>诊断结果{canEditRepair ? "" : "（只读）"}</span>
                  <span className="font-mono text-[9px] font-normal text-muted-foreground">
                    {diagnosis.trim().length}
                  </span>
                </span>
                <Textarea
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  disabled={pending || !canEditRepair}
                  className="min-h-20 resize-none rounded-lg text-xs md:min-h-[180px]"
                  placeholder="填写检测结果、风险、建议处理方式"
                />
              </label>
            </section>

            {error ? (
              <p className="rounded-lg bg-status-danger px-2.5 py-2 text-[10px] leading-4 text-status-danger-foreground md:col-span-2">
                {error}
              </p>
            ) : null}
          </div>
          <SheetFooter className="!grid grid-cols-2 gap-2 border-t border-[var(--border-panel)] px-3 py-2 sm:!flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs sm:h-8"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 text-xs sm:h-8"
              disabled={pending}
              onClick={() => void save()}
            >
              {pending ? "保存中..." : "保存"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PhotoPreview({
  attachment,
  onOpen,
}: {
  attachment: OrderAttachment;
  onOpen?: () => void;
}) {
  const source = attachment.signed_url || attachment.public_url;
  const label = attachmentKindLabels[attachment.kind] || "照片";

  if (!source) {
    return (
      <div className="relative h-14 overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]">
        <div className="grid size-full place-items-center text-primary">
          <ImageIcon className="size-4" />
        </div>
        <span className="absolute inset-x-1 bottom-1 rounded bg-background/85 px-1 py-0.5 text-center text-[8px] font-medium leading-3 text-muted-foreground backdrop-blur">
          {label} · {formatAttachmentSize(attachment.file_size)}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group relative h-14 overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      aria-label={`查看照片 ${attachment.file_name || label}`}
    >
      <img src={source} alt={attachment.file_name || label} className="size-full object-cover" />
      <span className="absolute inset-0 hidden place-items-center bg-background/20 text-[9px] font-semibold text-foreground backdrop-blur-[1px] group-hover:grid group-focus-visible:grid">
        查看
      </span>
      <span className="absolute inset-x-1 bottom-1 rounded bg-background/85 px-1 py-0.5 text-center text-[8px] font-medium leading-3 text-muted-foreground backdrop-blur">
        {label} · {formatAttachmentSize(attachment.file_size)}
      </span>
    </button>
  );
}

function DesktopStatusTransitionPanel({
  order,
  statusLabel,
  currentStage,
  actions,
  pending,
  onOpenChange,
  onTransition,
}: {
  order: OrderDetail["order"];
  statusLabel: string;
  currentStage: OrderTaskStage;
  actions: WorkflowTransitionAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card/95 p-2.5 shadow-sm">
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <Clock3 className="size-4 shrink-0 text-primary" />
            <span className="truncate">状态流转</span>
          </h3>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            当前：{currentStage.label} · {statusLabel}。可手动选择任一启用状态，确认后会写入时间线。
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg"
          disabled={pending}
          onClick={() => onOpenChange(false)}
          aria-label="收起状态流转"
        >
          <X className="size-4" />
        </Button>
      </header>
      <StatusTransitionPanelBody
        open
        order={order}
        statusLabel={statusLabel}
        currentStage={currentStage}
        actions={actions}
        pending={pending}
        onOpenChange={onOpenChange}
        onTransition={onTransition}
      />
    </section>
  );
}

function StatusTransitionPanelBody({
  open,
  order,
  statusLabel,
  currentStage,
  actions,
  pending,
  onOpenChange,
  onTransition,
}: {
  open: boolean;
  order: OrderDetail["order"];
  statusLabel: string;
  currentStage: OrderTaskStage;
  actions: WorkflowTransitionAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  const hasCommunicationStatus = actions.some((action) => isCommunicationStatus(action.to));
  const [reasonAction, setReasonAction] = useState<WorkflowTransitionAction | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const reasonConfig = reasonAction ? getOrderTransitionReasonConfig(reasonAction.to) : undefined;
  const canConfirmReason = !reasonConfig?.required || Boolean(reasonDraft.trim());

  useEffect(() => {
    if (!open) {
      setReasonAction(null);
      setReasonDraft("");
    }
  }, [open]);

  const chooseAction = (action: WorkflowTransitionAction) => {
    const config = getOrderTransitionReasonConfig(action.to);
    if (config || action.to === "completed") {
      setReasonAction(action);
      setReasonDraft(getDefaultOrderTransitionReason(action.to));
      return;
    }
    onOpenChange(false);
    onTransition(action.to);
  };

  return (
    <div className={cn(componentOverlay.body, "space-y-2 pt-3 lg:px-0 lg:pb-0")}>
      <div
        className={cn(
          "grid min-w-0 gap-2",
          reasonAction
            ? "lg:grid-cols-[minmax(220px,0.58fr)_minmax(0,1fr)]"
            : "lg:grid-cols-[minmax(220px,0.58fr)_minmax(0,1fr)]",
        )}
      >
        <section className={cn(componentOverlay.flatSection, "space-y-1.5 p-2.5")}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] leading-3 text-muted-foreground">当前工单</p>
              <p className="truncate font-mono text-xs font-semibold leading-4 text-primary">
                {order.public_no}
              </p>
            </div>
            <StatusBadge status={order.status} label={statusLabel} />
          </div>
          <div className="rounded-lg bg-[var(--surface-panel)] px-2 py-1.5">
            <p className="text-[10px] leading-3 text-muted-foreground">当前阶段</p>
            <p className="mt-0.5 truncate text-xs font-semibold">{currentStage.label}</p>
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            {reasonAction
              ? reasonAction.to === "completed" &&
                deviceCustodyStatusFromOrder(order) === DEVICE_CUSTODY_WITH_CUSTOMER
                ? order.delivered_at
                  ? "设备此前已交还客户；确认后只会行政结案，不会新增设备交付时间。"
                  : "设备从未由门店保管；确认后只会行政结案，不会记录设备交付时间。"
                : `准备流转为「${reasonAction.label}」，确认后会写入状态时间线。`
              : "可手动切换到任一启用工单状态；客户消息会保留为独立沟通记录。"}
          </p>
        </section>

        {reasonAction ? (
          <section className={cn(componentOverlay.flatSection, "space-y-2 p-2.5")}>
            <OrderTransitionReasonSelector
              target={reasonAction.to}
              value={reasonDraft}
              onChange={setReasonDraft}
              disabled={pending}
              compact
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                disabled={pending}
                onClick={() => {
                  setReasonAction(null);
                  setReasonDraft("");
                }}
              >
                返回
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg text-xs"
                disabled={pending || !canConfirmReason}
                onClick={() => {
                  const reason = reasonDraft.trim();
                  if (reasonConfig?.required && !reason) return;
                  onOpenChange(false);
                  onTransition(reasonAction.to, reason || undefined);
                }}
              >
                确认流转
              </Button>
            </div>
          </section>
        ) : (
          <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-1.5 lg:space-y-0 xl:grid-cols-3">
            {actions.length ? (
              actions.map((action, index) => {
                const hint = getStatusActionHint(action.to, order);
                const destructive = action.to === "cancelled";
                const needsReason = Boolean(getOrderTransitionReasonConfig(action.to));
                return (
                  <button
                    key={`${action.to}-${index}`}
                    type="button"
                    disabled={pending}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      action.isPrimary
                        ? "border-primary/35 bg-primary/5"
                        : "border-[var(--border-panel)] bg-[var(--surface-panel)]",
                      destructive &&
                        "border-status-danger-foreground/25 bg-status-danger/45 text-status-danger-foreground",
                      pending && "pointer-events-none opacity-60",
                    )}
                    onClick={() => chooseAction(action)}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg",
                        action.isPrimary
                          ? "bg-primary text-primary-foreground"
                          : "bg-[var(--surface-panel-muted)] text-muted-foreground",
                        destructive && "bg-status-danger text-status-danger-foreground",
                      )}
                    >
                      {action.isPrimary ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Clock3 className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-semibold leading-4">
                          {statusLabel} → {action.label}
                        </span>
                        {action.isPrimary ? (
                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary">
                            推荐
                          </span>
                        ) : null}
                        {needsReason ? (
                          <span className="shrink-0 rounded bg-status-warn px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-status-warn-foreground">
                            原因
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-3 text-muted-foreground">
                        {hint}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-4 text-center text-xs text-muted-foreground lg:col-span-2 xl:col-span-3">
                当前没有其他已启用状态可切换。
              </div>
            )}
          </div>
        )}
      </div>

      {hasCommunicationStatus && !reasonAction ? (
        <p className="rounded-lg bg-status-warn px-2.5 py-2 text-[10px] leading-4 text-status-warn-foreground">
          提醒：选择“待审批”或“已通知”只会改状态，不会自动发送
          WhatsApp。需要发送给客户时请走通知入口。
        </p>
      ) : null}
    </div>
  );
}

function MobileStatusTransitionSheet({
  open,
  order,
  statusLabel,
  currentStage,
  actions,
  pending,
  onOpenChange,
  onTransition,
}: {
  open: boolean;
  order: OrderDetail["order"];
  statusLabel: string;
  currentStage: OrderTaskStage;
  actions: WorkflowTransitionAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4 text-primary" />
              状态流转
            </SheetTitle>
            <SheetDescription>
              当前：{currentStage.label} · {statusLabel}。
              {"可手动选择任一启用状态，确认后会写入时间线。"}
            </SheetDescription>
          </SheetHeader>
          <StatusTransitionPanelBody
            open={open}
            order={order}
            statusLabel={statusLabel}
            currentStage={currentStage}
            actions={actions}
            pending={pending}
            onOpenChange={onOpenChange}
            onTransition={onTransition}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileStickyWorkflowHeader({
  order,
  workflow,
  currentStageIndex,
  currentStage,
  nextLabel,
  onHeightChange,
  onPrint,
  onCancel,
  canCancel,
}: {
  order: OrderDetail["order"];
  workflow?: OrderWorkflow;
  currentStageIndex: number;
  currentStage: OrderTaskStage;
  nextLabel?: string;
  onHeightChange?: (height: number) => void;
  onPrint: () => void;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const cancelled = isOrderCancelledForPayment(order);
  const statusLabel = cancelled ? "已取消" : getWorkflowStatusLabel(workflow, order.status);
  const nextText = nextLabel ? `下一步：${nextLabel}` : currentStage.nextAction;
  const sideBadges = getOrderSideStatusBadges(order).slice(0, 3);

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
    <div
      ref={shellRef}
      data-mobile-order-header="true"
      className={repairOs.mobileFloatingHeaderShell}
    >
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg">
            <Link href="/orders" aria-label="返回工单列表">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold leading-4">订单详情</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">
              {currentStage.label} · {statusLabel}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label="打印工单"
              onClick={onPrint}
            >
              <Printer className="size-[18px]" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg"
                  aria-label="更多操作"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={!canCancel}
                  onClick={onCancel}
                >
                  {canCancel ? "取消工单" : "当前状态不可取消"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className={repairOs.mobileFloatingHeaderBody}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-[12px] font-semibold leading-4 text-primary">
                {order.public_no}
              </p>
              <p className="truncate text-[9px] leading-3 text-muted-foreground">
                {currentStage.label} · {nextText}
              </p>
            </div>
            <StatusBadge
              status={cancelled ? "cancelled" : order.status}
              label={statusLabel}
              className="mt-0.5 scale-90"
            />
          </div>
          {sideBadges.length ? (
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {sideBadges.map((badge) => (
                <StatusBadge
                  key={badge.key}
                  status={order.status}
                  label={badge.label}
                  tone={badge.tone}
                  className="max-w-[7.5rem] scale-90 truncate text-[10px]"
                />
              ))}
            </div>
          ) : null}
          <div className="mt-1 border-t border-[var(--border-panel)] pt-1">
            <MobileWorkflowTimeline
              compact
              currentIndex={currentStageIndex}
              currentStage={currentStage}
              createdAt={order.created_at}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const mobileDetailCardClass = repairOs.mobileInfoCard;

function MobileSectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof UserRound;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <Icon className="size-3 shrink-0 text-primary" />
        <h2 className="truncate text-[11px] font-semibold leading-4">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function MobileMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[9px] leading-3 text-muted-foreground">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-[11px] font-medium leading-4">{value}</p>
    </div>
  );
}

function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-1.5 grid min-w-0 gap-1 text-[11px] leading-4">
      {rows.map(([label, value]) => (
        <div key={label} className="grid min-w-0 grid-cols-[34px_minmax(0,1fr)] gap-1.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MobileDenseFinanceInput({
  value,
  onValueChange,
  disabled,
  placeholder,
  inputMode = "text",
  align = "left",
  mono = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
  inputMode?: "text" | "decimal" | "numeric";
  align?: "left" | "right";
  mono?: boolean;
}) {
  if (inputMode === "decimal") {
    return (
      <MoneyKeypadInput
        ariaLabel={placeholder}
        value={value}
        onChange={onValueChange}
        disabled={disabled}
        placeholder={placeholder}
        align={align}
        triggerClassName={cn(
          "h-7 rounded-md border border-[var(--border-panel)] bg-card px-2 py-0 text-base shadow-sm md:text-[11px]",
          mono && "font-mono tabular-nums",
        )}
        valueClassName={cn("text-base md:text-[11px]", mono && "font-mono tabular-nums")}
      />
    );
  }

  return (
    <span
      className={cn(
        "relative block h-7 min-w-0 overflow-hidden rounded-md border border-[var(--border-panel)] bg-card shadow-sm transition-colors focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10",
        disabled && "opacity-60",
      )}
    >
      <Input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "absolute top-1/2 h-9 w-[133.333%] -translate-y-1/2 scale-75 border-0 bg-transparent px-2 py-0 text-base shadow-none focus-visible:ring-0 md:text-[11px]",
          align === "right" ? "right-0 origin-right text-right" : "left-0 origin-left",
          mono && "font-mono tabular-nums",
        )}
      />
    </span>
  );
}

function MobileFinanceEditor({
  draft,
  normalized,
  saveError,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  draft: FinanceDraftState;
  normalized: ReturnType<typeof normalizeFinanceDraft>;
  saveError: string;
  pending: boolean;
  onChange: (draft: FinanceDraftState) => void;
  onCancel: () => void;
  onSave: () => Promise<boolean>;
}) {
  const patchFault = (index: number, patch: Partial<FinanceDraftState["faults"][number]>) => {
    const faults = [...draft.faults];
    faults[index] = { ...faults[index], ...patch };
    onChange({ ...draft, faults });
  };
  const selectedFaults = useMemo(
    () =>
      normalizeFaultPrices(
        draft.faults
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name,
            note: item.note,
            price: parseFinancePickerPrice(item.priceText),
          })),
      ),
    [draft.faults],
  );

  return (
    <div className="mt-1.5 min-w-0 space-y-1.5">
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-semibold leading-3 text-muted-foreground">
          选择维修项目
        </p>
        <FaultDiagnosisPicker
          selected={selectedFaults}
          onChange={(items) => onChange(mergeSelectedFaultsIntoFinanceDraft(draft, items))}
          className="gap-1.5"
          density="compact"
          compactColumns={3}
        />
      </div>

      <div className="space-y-1">
        {draft.faults.length ? (
          draft.faults.map((item, index) => (
            <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_74px_24px] gap-1">
              <MobileDenseFinanceInput
                value={item.name}
                onValueChange={(value) => patchFault(index, { name: value })}
                disabled={pending}
                placeholder="项目"
              />
              <MobileDenseFinanceInput
                value={item.priceText}
                onValueChange={(value) => patchFault(index, { priceText: value })}
                disabled={pending}
                placeholder="金额"
                inputMode="decimal"
                align="right"
                mono
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                disabled={pending}
                onClick={() =>
                  onChange({ ...draft, faults: draft.faults.filter((_, i) => i !== index) })
                }
                aria-label="删除报价项目"
              >
                <Trash2 className="size-3 text-muted-foreground" />
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-[var(--border-panel)] px-2 py-2 text-center text-[10px] text-muted-foreground">
            暂无报价项目
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-full rounded-md text-[10px]"
        disabled={pending}
        onClick={() => {
          const faults = [...draft.faults, emptyFinanceFaultDraft()];
          onChange({ ...draft, faults });
        }}
      >
        <Plus className="mr-1 size-3" /> 添加自定义项目
      </Button>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_86px] items-end gap-1.5">
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1">
            <span className="block text-muted-foreground">总额</span>
            <MoneyText amount={normalized.quotation} className="font-semibold text-primary" />
          </div>
          <div className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1">
            <span className="block text-muted-foreground">尾款</span>
            <MoneyText amount={normalized.balance} className="font-semibold" />
          </div>
        </div>
        <label className="grid min-w-0 gap-0.5 text-[10px] text-muted-foreground">
          <span>押金</span>
          <MobileDenseFinanceInput
            value={draft.depositText}
            onValueChange={(value) => onChange({ ...draft, depositText: value })}
            disabled={pending}
            placeholder="0"
            inputMode="decimal"
            align="right"
            mono
          />
        </label>
      </div>

      {normalized.error || saveError ? (
        <p className="rounded-md bg-status-danger px-2 py-1 text-[10px] leading-3 text-status-danger-foreground">
          {normalized.error ?? saveError}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-md text-[10px]"
          onClick={onCancel}
          disabled={pending}
        >
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-md text-[10px]"
          onClick={() => void onSave().catch(() => undefined)}
          disabled={pending || !normalized.canSave}
        >
          <Save className="mr-1 size-3" /> 保存
        </Button>
      </div>
    </div>
  );
}

function parseFinancePickerPrice(text: string) {
  const normalized = text.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function getFinanceSaveErrorMessage(error: Error) {
  const message = (error.message || "保存失败，请稍后重试。").replace(/^Error:\s*/i, "").trim();
  if (/工单已被更新|版本|expected_updated_at|conflict/i.test(message)) {
    return "工单刚刚被更新，报价未保存。请刷新后重新确认报价。";
  }
  if (/写入财务时间线|写入审计日志|日志/i.test(message)) {
    return "报价可能已保存，但记录日志失败。请刷新页面确认，必要时联系管理员。";
  }
  if (/押金|金额|报价|项目|fault|price/i.test(message)) {
    return message.startsWith("保存失败") ? message : `保存失败：${message}`;
  }
  if (/未登录|店铺|权限|unauthorized|forbidden/i.test(message)) {
    return message.startsWith("保存失败") ? message : `保存失败：${message}`;
  }
  return message.startsWith("保存失败") ? message : `保存失败：${message}`;
}

function getOrderPatchSaveErrorMessage(error: unknown) {
  const raw = error instanceof Error && error.message ? error.message : "保存失败，请稍后重试。";
  const message = raw.replace(/^Error:\s*/i, "").trim();
  if (/工单已被更新|版本|expected_updated_at|conflict/i.test(message)) {
    return "保存失败：工单刚刚被其他操作更新，请刷新后再保存。";
  }
  if (/没有可保存的字段|缺少版本|字段|schema|column/i.test(message)) {
    return `保存失败：${message}`;
  }
  if (/未登录|店铺|权限|unauthorized|forbidden/i.test(message)) {
    return `保存失败：${message}`;
  }
  return message.startsWith("保存失败") ? message : `保存失败：${message}`;
}

function getImeiSaveErrorMessage(error: unknown) {
  const raw = error instanceof Error && error.message ? error.message : "";
  const message = raw.replace(/^Error:\s*/i, "").trim();
  if (/IMEI|序列号/i.test(message) && /不能为空|empty|required/i.test(message)) {
    return "IMEI / 序列号不能为空，请先扫描、上传照片或手动输入。";
  }
  if (/工单已被更新|版本|expected_updated_at|conflict/i.test(message)) {
    return "IMEI / 序列号未保存：工单刚刚被其他操作更新，请刷新后再保存。";
  }
  if (/未登录|店铺|权限|unauthorized|forbidden/i.test(message)) {
    return "IMEI / 序列号未保存：当前账号没有权限或登录状态已失效。";
  }
  return "IMEI / 序列号保存失败，请刷新后重试。";
}

function getImeiOcrErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/当前浏览器暂不支持本机 OCR/.test(message)) {
    return "当前浏览器暂不支持本机 OCR。请改用二维码/条码扫描或手动输入。";
  }
  if (/超时|timeout/i.test(message)) {
    return "OCR 识别超时，请换一张更清晰的照片或手动输入。";
  }
  return "OCR 识别失败，请重新拍摄或手动输入。";
}

function validateImeiOcrImageFile(file: File) {
  if (!imeiOcrImageMimeTypes.has(file.type) && !imeiOcrImageExtensionPattern.test(file.name)) {
    return "仅支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。";
  }
  if (file.size > 8 * 1024 * 1024) {
    return "图片不能超过 8 MB。";
  }
  return "";
}

type BrowserTextDetector = {
  detect: (source: unknown) => Promise<Array<{ rawValue?: string }>>;
};

type BrowserWindowWithTextDetector = Window & {
  TextDetector?: new () => BrowserTextDetector;
};

async function detectTextFromImageFile(file: File) {
  const TextDetectorCtor = (window as BrowserWindowWithTextDetector).TextDetector;
  if (!TextDetectorCtor) {
    throw new Error("当前浏览器暂不支持本机 OCR。请改用二维码/条码扫描或手动输入。");
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = imageUrl;
    await image.decode();
    const detector = new TextDetectorCtor();
    const results = await detector.detect(image);
    return results
      .map((item) => item.rawValue?.trim())
      .filter((item): item is string => Boolean(item))
      .join(" ");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function withImeiOcrTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isCommunicationStatus(status: RepairOrderStatus) {
  return status === "waiting_approval" || status === "notified";
}

function isApprovalDecisionAvailable(order: OrderDetail["order"]) {
  return (
    order.approval_flow_status === "waiting_customer" ||
    (order.status === "waiting_approval" && order.approval_status === "pending") ||
    (order.status === "quoted" && order.approval_status === "pending")
  );
}

function getDefaultApprovedNextStatus(order: OrderDetail["order"]): RepairOrderStatus {
  if (order.status === "mail_in_progress" || order.supplier_id) return "mail_in_progress";
  if (order.parts_status && order.parts_status !== "not_required") return "parts_ordered";
  return "repairing";
}

function getStatusActionHint(status: RepairOrderStatus, order?: OrderDetail["order"]) {
  if (status === "waiting_approval") return "进入客户审批阶段；不会自动发送报价消息。";
  if (status === "notified") return "标记客户已通知；不会自动发送取机消息。";
  if (status === "mail_in_progress")
    return "用于店内未修起、主板外修或供应商复检；需要记录寄修说明。";
  if (status === "parts_ordered") return "记录为已订配件，后续可流转到配件到货。";
  if (status === "parts_arrived") return "记录为配件已到，下一步通常进入维修。";
  if (status === "unfixed_pickup") return "用于无法维修但客户取回设备的情况。";
  if (status === "rework") return "从结案或未修取机回到返修流程。";
  if (status === "cancelled") return "需要填写取消原因后才能完成取消。";
  if (status === "completed") {
    return order && deviceCustodyStatusFromOrder(order) === DEVICE_CUSTODY_WITH_CUSTOMER
      ? order.delivered_at
        ? "设备此前已交还客户；仅行政结案，不新增设备交付时间。"
        : "设备未留店；仅行政结案，不记录设备交付时间。"
      : "完成交付并归档当前工单。";
  }
  return "仅更新工单状态并写入时间线。";
}

function mergeSelectedFaultsIntoFinanceDraft(
  draft: FinanceDraftState,
  selected: ReturnType<typeof normalizeFaultPrices>,
): FinanceDraftState {
  const existingByName = new Map(draft.faults.map((item) => [item.name, item]));
  return {
    ...draft,
    faults: toFaultPriceItems(selected).map((item) => {
      const existing = existingByName.get(item.name);
      const price = Number(item.price);
      return {
        name: item.name,
        note: item.note ?? existing?.note ?? "",
        priceText:
          existing?.priceText ?? (Number.isFinite(price) && price > 0 ? String(price) : ""),
      };
    }),
  };
}

function MobilePaymentSummary({
  total,
  deposit,
  balance,
  cancelled = false,
  className,
}: {
  total: number;
  deposit: number;
  balance: number;
  cancelled?: boolean;
  className?: string;
}) {
  const hasBalance = balance > 0;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)} data-mobile-payment-summary="true">
      <div className="rounded-lg border border-primary/15 bg-primary/5 px-2 py-1.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="shrink-0 text-[10px] font-semibold leading-4 text-primary">总金额</span>
          <MoneyText
            amount={total}
            className="min-w-0 text-right font-mono text-lg font-bold leading-6 text-foreground"
          />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <MobilePaymentTile
          label="已收定金"
          amount={deposit}
          valueClassName={deposit > 0 ? "text-status-success-foreground" : undefined}
        />
        <MobilePaymentTile
          label={cancelled ? "取消时余额" : "待付尾款"}
          amount={balance}
          valueClassName={
            cancelled
              ? "text-muted-foreground"
              : hasBalance
                ? "text-status-danger-foreground"
                : "text-status-success-foreground"
          }
        />
      </div>
      {cancelled ? (
        <p className="text-[10px] leading-4 text-muted-foreground">已取消 · 此余额不计入待收</p>
      ) : null}
    </div>
  );
}

function MobilePaymentTile({
  label,
  amount,
  valueClassName,
}: {
  label: string;
  amount: number;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <div className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
        {label}
      </div>
      <MoneyText
        amount={amount}
        className={cn("mt-0.5 min-w-0 text-right font-mono text-xs font-semibold", valueClassName)}
      />
    </div>
  );
}

function MobileWorkflowTimeline({
  currentIndex,
  currentStage,
  createdAt,
  compact = false,
}: {
  currentIndex: number;
  currentStage?: OrderTaskStage;
  createdAt: string;
  compact?: boolean;
}) {
  const stageGridStyle = {
    gridTemplateColumns: `repeat(${orderTaskStages.length}, minmax(0, 1fr))`,
  };

  return (
    <div className={cn("grid min-w-0 gap-0.5", compact ? "mt-1" : "mt-4")} style={stageGridStyle}>
      {orderTaskStages.map((stage, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const displayStage = current ? (currentStage ?? stage) : stage;
        return (
          <div key={stage.key} className="relative min-w-0 text-center">
            {index > 0 ? (
              <span
                className={cn(
                  "absolute -left-1/2 h-0.5 w-full bg-border",
                  compact ? "top-2" : "top-3",
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mx-auto grid place-items-center rounded-full border font-semibold",
                compact ? "size-4 text-[8px]" : "size-6 text-[10px]",
                done && "border-primary bg-primary text-primary-foreground",
                current &&
                  (compact
                    ? "border-primary bg-card text-primary shadow-[0_0_0_2px_color-mix(in_oklch,var(--primary)_14%,transparent)]"
                    : "border-primary bg-card text-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]"),
                !done && !current && "border-border bg-surface-muted text-muted-foreground",
              )}
            >
              {done ? (
                <Check className={compact ? "size-2.5" : "size-3.5"} />
              ) : (
                displayStage.shortLabel
              )}
            </span>
            <p
              className={cn(
                "truncate",
                compact ? "mt-0.5 text-[8px] leading-3" : "mt-1 text-[10px]",
                current ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {displayStage.label}
            </p>
            {!compact ? (
              <p className="truncate text-[9px] text-muted-foreground/70">
                {index === 0 ? formatShortDate(createdAt) : current ? "当前" : ""}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="grid h-14 place-items-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-center text-[10px] text-muted-foreground">
      <span className="grid place-items-center gap-0.5">
        <ImageIcon className="size-3.5 opacity-70" />
        {label}
      </span>
    </div>
  );
}

function getWhatsappHref(phone: string) {
  const normalized = normalizePhoneDigits(phone);
  return normalized ? `https://wa.me/${normalized}` : "#";
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDateTime(value: string) {
  return formatOrderDateTime(value);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatClockTime(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderEvent(
  type: string,
  payload: Record<string, unknown>,
  workflow: Parameters<typeof getWorkflowStatusLabel>[0],
) {
  const label = (value: unknown) =>
    typeof value === "string" ? getWorkflowStatusLabel(workflow, value) : String(value ?? "");
  switch (type) {
    case "created":
      return "工单创建";
    case "status_changed": {
      const custodyEvent = formatDeviceCustodyEvent(payload);
      if (custodyEvent) return custodyEvent;
      const reason =
        typeof payload.reason === "string" && payload.reason.trim()
          ? `，原因：${payload.reason.trim()}`
          : "";
      return `状态变更：${label(payload.from)} → ${label(payload.to)}${reason}`;
    }
    case "quoted":
      return `提交报价 ${formatMoney(Number(payload.amount ?? 0))}`;
    case "approval_sent":
      return payload.status_changed ? "已发送审批并进入待审批" : "已发送审批消息";
    case "approval_result": {
      const result = payload.result === "approved" ? "通过" : "拒绝";
      const route =
        typeof payload.from === "string" && typeof payload.to === "string"
          ? `：${label(payload.from)} → ${label(payload.to)}`
          : "";
      const reason =
        typeof payload.reason === "string" && payload.reason.trim()
          ? `，原因：${payload.reason.trim()}`
          : "";
      return `客户审批${result}${route}${reason}`;
    }
    case "payment":
      return `收款 ${formatMoney(Number(payload.amount ?? 0))}（${payload.method}）`;
    case "message_sent":
      return payload.status_changed
        ? `已发送 WhatsApp 通知并流转：${label(payload.from)} → ${label(payload.to)}`
        : "已发送 WhatsApp 通知";
    case "note": {
      const custodyEvent = formatDeviceCustodyEvent(payload);
      if (custodyEvent) return custodyEvent;
      if (payload.action === "order_updated") return "工单信息已更新";
      if (payload.action === "warranty_changed") {
        const reason =
          typeof payload.reason === "string" && payload.reason ? `，原因：${payload.reason}` : "";
        return `质保已调整：${payload.from_text ?? payload.from_months} → ${payload.to_text ?? payload.to_months}${reason}`;
      }
      if (payload.action === "order_patched") {
        const fields = Array.isArray(payload.changed_fields)
          ? payload.changed_fields.filter((field): field is string => typeof field === "string")
          : [];
        return fields.length ? `工单资料已更新：${fields.join("、")}` : "工单资料已更新";
      }
      if (payload.action === "order_finance_updated") return "工单财务已更新";
      if (payload.action === "attachment_uploaded") {
        const fileName = typeof payload.file_name === "string" ? payload.file_name : "附件";
        return `已上传设备照片：${fileName}`;
      }
      return "备注";
    }
    default:
      return type;
  }
}

function getEditValidationError(
  draft: UpdateOrderInput | null,
  financeError?: string,
  defaultWarrantyMonths = 6,
  capabilities: {
    canEditIntake: boolean;
    canEditRepair: boolean;
    canAdjustFinance: boolean;
  } = { canEditIntake: true, canEditRepair: true, canAdjustFinance: true },
): string | undefined {
  if (!draft) return "缺少工单草稿。";
  if (capabilities.canEditIntake && !draft.customer_name.trim()) return "客户姓名不能为空。";
  if (capabilities.canEditIntake && !draft.customer_phone.trim()) return "手机号不能为空。";
  if (capabilities.canEditIntake && !draft.device_brand.trim()) return "设备品牌不能为空。";
  if (capabilities.canEditIntake && !draft.device_model.trim()) return "设备型号不能为空。";
  if (capabilities.canEditIntake && !draft.issue_description.trim()) return "故障描述不能为空。";
  if (
    capabilities.canEditRepair &&
    warrantyReasonRequired(draft.warranty_months ?? defaultWarrantyMonths, defaultWarrantyMonths) &&
    !draft.warranty_change_reason?.trim()
  ) {
    return "非默认质保需要填写原因。";
  }
  return capabilities.canAdjustFinance ? financeError : undefined;
}
