"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Calendar,
  Check,
  CheckCircle2,
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
  RefreshCw,
  Save,
  ScanLine,
  Send,
  Smartphone,
  Store,
  TabletSmartphone,
  Trash2,
  TriangleAlert,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import { ImeiScannerField, normalizeImeiIdentifier } from "@/components/imei-scanner-field";
import {
  extractValidImeiCandidates,
  getPreferredValidImeiCandidate,
} from "@/entities/device/model/imei-candidates";
import { DeviceCustodyBadge, MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { DiagnosisQuoteDialog } from "@/components/orders/diagnosis-quote-dialog";
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
  listAvailableKioskDevices,
  listOrderWorkflow,
  patchOrder,
  patchOrderFinance,
  publishOrderQuote,
  confirmOrderQuoteSent,
  recordPayment,
  sendWhatsappNotification,
  transitionOrder,
  updateOrderCustody,
  uploadOrderAttachment,
  type UpdateOrderInput,
} from "@/lib/repairdesk/api";
import {
  CameraCaptureSheet,
  formatAttachmentSize,
  revokeAttachmentDraft,
  type AttachmentDraft,
} from "@/features/capture";
import type { ImeiCandidate } from "@/features/capture/model/barcode-parser";
import {
  RepairOrderPrintSheet,
  canPrintRepairOrderCustomerDocument,
} from "@/features/orders/components/repair-order-print-sheet";
import {
  OrderPrintPaperDialog,
  readOrderPrintPaperMode,
  rememberOrderPrintPaperMode,
} from "@/features/orders/components/order-print-paper-dialog";
import { FixedPdfReadyDialog } from "@/features/orders/components/fixed-pdf-ready-dialog";
import type { PrintPaperMode } from "@/features/orders/components/print-portal";
import {
  issueCustomerStatusLinks,
  revokeCustomerStatusLinks,
} from "@/features/customer-status/api/customer-status-client";
import { useFixedOrderPdfPrint } from "@/features/orders/print/use-fixed-order-pdf-print";
import { OrderDetailSkeleton } from "@/features/orders/components/order-detail-skeleton";
import { orderDetailQueryOptions } from "@/features/orders/api/query-options";
import { StoreShellUnavailableState } from "@/features/stores/components/store-shell-unavailable-state";
import { OrderSupplierPicker } from "@/features/suppliers/components/order-supplier-picker";
import {
  DeviceUnlockEditor,
  DeviceUnlockViewer,
} from "@/features/orders/components/device-unlock-fields";
import { OrderHero } from "@/features/orders/components/order-hero";
import {
  advanceOrderEditBaseline,
  buildOrderEditSavePlan,
  executeOrderEditSavePlan,
  OrderEditSaveExecutionError,
} from "@/features/orders/model/order-edit-save";
import { hasOrderEditRemoteConflict } from "@/features/orders/model/order-edit-conflict";
import { OrderPhotoPreviewDialog } from "@/features/orders/components/order-photo-preview-dialog";
import { OrderTerminalActions } from "@/features/orders/components/order-terminal-actions";
import { OrderInternalCostCard } from "@/features/orders/components/order-internal-cost-card";
import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import {
  useEditOrderOfflineAutosave,
  type EditOrderOfflineAutosaveState,
  type EditOrderOfflineDraftPrompt,
} from "@/features/orders/api/use-edit-order-offline-autosave";
import {
  DesktopOrderPhotosPanel,
  OrderDetailActionDock,
  OrderDetailHeaderFinanceSummary,
  OrderKeyInfoCard,
  OrderOverviewTab,
} from "@/features/orders/components/order-overview-tab";
import {
  OrderDetailTabs,
  type OrderDetailTab,
} from "@/features/orders/components/order-detail-tabs";
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
  isOrderCancelledState,
  isOrderTerminalState,
  isOrderPaymentCollectible,
} from "@/features/orders/model/order-payment-state";
import {
  resolveOrderDetailPrimaryAction,
  type OrderDetailPrimaryAction,
} from "@/features/orders/model/order-detail-primary-action";
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
  deviceCustodyAllowsChange,
  deviceCustodyAllowsStatus,
  deviceCustodyBlocksStatus,
  deviceCustodyLabel,
  deviceCustodyStatusFromOrder,
  isDeviceCustodyReasonValid,
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
import { ordersKeys } from "@/features/orders/api/query-keys";
import { invalidateOrderReadCaches, patchOrderReadCaches } from "@/features/orders/api/cache-sync";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { useViewportMode, type ViewportMode } from "@/hooks/use-mobile";
import {
  registerOrderDetailBodyOwner,
  updateOrderDetailBodyOwner,
} from "@/features/orders/screens/order-detail-body-state";
import {
  buildStoreCustomerOutputUrl,
  resolveStoreOutputIdentity,
} from "@/entities/store/model/store-output-identity";
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
import { formatCurrency } from "@/shared/i18n/format";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  getOrderDetailSafeErrorMessage,
  localizeOrderAttachmentKind,
  localizeOrderDetailBadge,
  localizeOrderDetailEvent,
  localizeOrderMessageChannel,
  localizeOrderMessageStatus,
} from "@/features/orders/model/order-detail-i18n";
import {
  localizeDeviceCustody,
  localizeOrderFlowStage,
  localizeWorkflowStatusLabel,
} from "@/features/orders/model/order-i18n";
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
  StoreSettings,
  Supplier,
} from "@/lib/repairdesk/types";

type WorkflowTransitionAction = ReturnType<typeof getWorkflowTransitionActions>[number];
type DesktopDetailView = "overview" | "records" | "photos" | "costs";
type DesktopRecordsView = "key-info" | "messages" | "timeline";
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
  const { locale, t } = useLocale();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const viewportMode = useViewportMode();
  const renderModeOwnerId = useId();
  const lockedOrderIdRef = useRef(id);
  const [lockedPageRenderMode, setLockedPageRenderMode] = useState<ViewportMode>("pending");
  const orderDetailRenderMode: ViewportMode =
    surface === "dialog"
      ? "desktop"
      : lockedOrderIdRef.current === id
        ? lockedPageRenderMode
        : "pending";
  const initialBodyOwnerRef = useRef({
    ownerId: renderModeOwnerId,
    surface,
    renderMode: orderDetailRenderMode,
  });

  useEffect(() => {
    if (surface === "dialog") return;
    if (lockedOrderIdRef.current !== id) {
      lockedOrderIdRef.current = id;
      setLockedPageRenderMode("pending");
      return;
    }
    if (lockedPageRenderMode === "pending" && viewportMode !== "pending") {
      setLockedPageRenderMode(viewportMode);
    }
  }, [id, lockedPageRenderMode, surface, viewportMode]);

  useEffect(() => registerOrderDetailBodyOwner(initialBodyOwnerRef.current), [renderModeOwnerId]);

  useEffect(() => {
    updateOrderDetailBodyOwner(renderModeOwnerId, { surface, renderMode: orderDetailRenderMode });
  }, [orderDetailRenderMode, renderModeOwnerId, surface]);

  const activeStoreId = shell.activeStore?.id;
  const activeUserId = shell.userId;
  const offlineScope = useMemo(
    () => (activeStoreId && activeUserId ? { storeId: activeStoreId, userId: activeUserId } : null),
    [activeStoreId, activeUserId],
  );
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [diagnosisQuoteOpen, setDiagnosisQuoteOpen] = useState(false);
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
  const desktopPhotoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopPhotoOutsideDismissedRef = useRef(false);
  const handleDesktopPhotoCloseAutoFocus = useCallback((event: Event) => {
    if (!desktopPhotoOutsideDismissedRef.current) {
      event.preventDefault();
      desktopPhotoTriggerRef.current?.focus({ preventScroll: true });
    }
    desktopPhotoOutsideDismissedRef.current = false;
  }, []);
  const [desktopDetailView, setDesktopDetailView] = useState<DesktopDetailView>("overview");
  const [desktopRecordsView, setDesktopRecordsView] = useState<DesktopRecordsView>("key-info");
  const [desktopCostsVisited, setDesktopCostsVisited] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBaseline, setEditBaseline] = useState<UpdateOrderInput | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateOrderInput | null>(null);
  const [mobileFinanceEditing, setMobileFinanceEditing] = useState(false);
  const [mobileFinanceSaveError, setMobileFinanceSaveError] = useState("");
  const [customerStatusUrl, setCustomerStatusUrl] = useState("");
  const [printPreparing, setPrintPreparing] = useState(false);
  const [printPaperDialogOpen, setPrintPaperDialogOpen] = useState(false);
  const [printPaperMode, setPrintPaperMode] = useState<PrintPaperMode>(readOrderPrintPaperMode);
  const [customerStatusRevokePending, setCustomerStatusRevokePending] = useState(false);
  const [financeDraft, setFinanceDraft] = useState<FinanceDraftState>(() =>
    createFinanceDraftState([], 0),
  );
  const editSaveInFlightRef = useRef(false);
  const {
    requestPrint,
    preparedPdf,
    generationPending,
    deliveryPending,
    deliveryError,
    dismissPreparedPdf,
    sharePreparedPdf,
    openPreparedPdf,
    downloadPreparedPdf,
  } = useFixedOrderPdfPrint(
    () => {
      setPrintPreparing(false);
    },
    (error) => {
      setPrintPreparing(false);
      toast.error(getOrderDetailSafeErrorMessage(error, "print", t));
    },
    {
      scopeKey: `${activeStoreId ?? "no-store"}:${id}`,
      onPdfReady: () => setCustomerStatusUrl(""),
      onInvalidate: () => setCustomerStatusUrl(""),
    },
  );

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
    setDesktopDetailView("overview");
    setDesktopRecordsView("key-info");
    setDesktopCostsVisited(false);
  }, [id]);

  const changeDesktopDetailView = useCallback((view: DesktopDetailView) => {
    if (view === "costs") setDesktopCostsVisited(true);
    setDesktopDetailView(view);
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
  const storeSettingsQuery = useQuery({
    queryKey: messageSettingsKeys.storeScoped(activeStoreId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId),
  });
  const storeSettings = storeSettingsQuery.data;
  const storeOutputIdentity = useMemo(
    () =>
      resolveStoreOutputIdentity({
        activeStore: shell.activeStore,
        settings: storeSettings,
        settingsState: storeSettingsQuery.isLoading
          ? "loading"
          : storeSettingsQuery.isError
            ? "error"
            : "ready",
      }),
    [shell.activeStore, storeSettings, storeSettingsQuery.isError, storeSettingsQuery.isLoading],
  );
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
  const canCreateKioskSession = data?.capabilities?.canCreateKioskSession === true;
  const { data: kioskDevices = [] } = useQuery({
    queryKey: kioskKeys.availableDevices(activeStoreId, id),
    queryFn: ({ signal }) => listAvailableKioskDevices(id, { signal }),
    staleTime: CACHE_TIMES.settings,
    enabled: Boolean(activeStoreId && canCreateKioskSession),
  });
  const activeKioskDevice = kioskDevices.find((device) => device.status === "active");
  const defaultWarrantyMonths = storeSettings?.default_order_warranty_months ?? 6;
  const editFinance = useMemo(() => {
    if (!data || !editDraft) return null;
    return normalizeFinanceDraft(financeDraft, inferOrderPaidAmount(data.order));
  }, [data, editDraft, financeDraft]);
  const persistedEditDraft = useMemo(() => {
    if (!editDraft || !editFinance?.canSave) return editDraft;
    return {
      ...editDraft,
      fault_prices: editFinance.faultPrices,
      deposit_amount: editFinance.deposit,
    };
  }, [editDraft, editFinance]);
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
    saveDraftSnapshot: saveEditOfflineDraftSnapshot,
  } = useEditOrderOfflineAutosave({
    draft: persistedEditDraft,
    orderDetail: data,
    scope: offlineScope,
    defaultWarrantyMonths,
    autosaveEnabled: isEditing,
  });

  const invalidate = useCallback(() => {
    invalidateOrderReadCaches(queryClient, id);
  }, [id, queryClient]);

  const orderUrl = useMemo(
    () => buildStoreCustomerOutputUrl(storeOutputIdentity, `/orders/${id}`),
    [id, storeOutputIdentity],
  );

  useEffect(() => {
    setNotifyOpen(false);
  }, [activeStoreId]);

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
      toast.success(
        t("orders2b2.success.transition", {
          status: localizeWorkflowStatusLabel(workflow, vars.to, t),
        }),
      );
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(getOrderDetailSafeErrorMessage(error, "transition", t)),
  });

  const cancelledReturn = useMutation({
    mutationFn: () => {
      if (!data) throw new Error("工单未加载");
      return confirmCancelledOrderReturn(id, data.order.updated_at, crypto.randomUUID());
    },
    onSuccess: () => {
      toast.success(t("orders2b2.success.cancelledReturn"));
      closeCancelledReturnOverlay();
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(getOrderDetailSafeErrorMessage(error, "cancelledReturn", t)),
  });

  const custodyUpdate = useMutation({
    mutationFn: (input: { target: DeviceCustodyStatus; reason?: string }) => {
      const currentDetail =
        queryClient.getQueryData<OrderDetail>(ordersKeys.detail(id, activeStoreId)) ?? data;
      if (!currentDetail) throw new Error("工单未加载");
      return updateOrderCustody(id, {
        expected_updated_at: currentDetail.order.updated_at,
        device_custody_status: input.target,
        idempotency_key: crypto.randomUUID(),
        reason: input.reason,
      });
    },
    onSuccess: (result, input) => {
      const cachedDetail =
        queryClient.getQueryData<OrderDetail>(ordersKeys.detail(id, activeStoreId)) ?? data;
      const previousOrder = cachedDetail?.order;
      const previousCustodyStatus = previousOrder
        ? deviceCustodyStatusFromOrder(previousOrder)
        : null;
      const previousWorkflowBucket =
        previousOrder?.workflow_bucket ??
        (previousOrder ? getWorkflowStatus(workflow, previousOrder.status)?.bucket : undefined);
      const previousTerminal =
        previousOrder?.status === "completed" ||
        (previousOrder ? isOrderCancelledState(previousOrder) : false) ||
        previousWorkflowBucket === "done" ||
        (previousWorkflowBucket === undefined && previousOrder?.workflow_status === "closed");
      patchOrderReadCaches(queryClient, id, {
        updated_at: result.updated_at,
        device_custody_status: input.target,
        ...(input.target === DEVICE_CUSTODY_WITH_SHOP
          ? { delivered_at: null }
          : previousCustodyStatus === DEVICE_CUSTODY_WITH_SHOP && !previousTerminal
            ? { delivered_at: result.updated_at }
            : {}),
      });
      toast.success(
        t(
          input.target === DEVICE_CUSTODY_WITH_SHOP
            ? "orders2b2.success.custodyShop"
            : "orders2b2.success.custodyCustomer",
        ),
      );
      closeCustodyOverlay();
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "custody", t)),
  });

  const orderUpdate = useMutation({
    retry: false,
    mutationFn: async (input: {
      baseline: UpdateOrderInput;
      draft: UpdateOrderInput;
      capabilities: {
        canEditIntake: boolean;
        canEditRepair: boolean;
        canAdjustFinance: boolean;
      };
    }) => {
      const plan = buildOrderEditSavePlan(input);
      const result = await executeOrderEditSavePlan({
        plan,
        expectedUpdatedAt: input.baseline.expected_updated_at,
        saveRoutine: (expectedUpdatedAt, changes) =>
          patchOrder(id, { expected_updated_at: expectedUpdatedAt, changes }),
        saveFinance: (expectedUpdatedAt, change) =>
          patchOrderFinance(id, {
            expected_updated_at: expectedUpdatedAt,
            fault_prices: change.faultPrices,
            deposit_amount: change.depositAmount,
          }),
      });
      return { ...result, plan };
    },
    onSuccess: (result) => {
      patchOrderReadCaches(queryClient, id, { updated_at: result.updatedAt });
      toast.success(
        t(
          result.completedSteps.length === 1 && result.completedSteps[0] === "finance"
            ? "orders2b2.success.finance"
            : "orders2b2.success.save",
        ),
      );
      void discardCurrentEditOfflineDraft();
      setIsEditing(false);
      setEditBaseline(null);
      setEditDraft(null);
      invalidate();
    },
    onError: async (error, input) => {
      if (error instanceof OrderEditSaveExecutionError && error.completedSteps.length > 0) {
        const plan = buildOrderEditSavePlan(input);
        const nextBaseline = advanceOrderEditBaseline({
          baseline: input.baseline,
          plan,
          completedSteps: error.completedSteps,
          updatedAt: error.latestUpdatedAt,
        });
        const nextDraft = { ...input.draft, expected_updated_at: error.latestUpdatedAt };
        setEditBaseline(nextBaseline);
        setEditDraft(nextDraft);
        if (data) {
          await saveEditOfflineDraftSnapshot({
            draft: nextDraft,
            orderDetail: {
              ...data,
              order: { ...data.order, updated_at: error.latestUpdatedAt },
            },
          }).catch(() => false);
        }
        patchOrderReadCaches(queryClient, id, { updated_at: error.latestUpdatedAt });
        invalidate();
      }
      const failure = error instanceof OrderEditSaveExecutionError ? error.reason : error;
      const operation =
        error instanceof OrderEditSaveExecutionError && error.failedStep === "finance"
          ? "finance"
          : "save";
      const failureMessage = getOrderDetailSafeErrorMessage(failure, operation, t);
      if (error instanceof OrderEditSaveExecutionError && error.completedSteps.length > 0) {
        const completed = error.completedSteps
          .map((step) =>
            t(step === "finance" ? "orders2b2.saveStep.finance" : "orders2b2.saveStep.routine"),
          )
          .join(t("orders2b2.saveStep.separator"));
        toast.error(t("orders2b2.error.partial", { failure: failureMessage, completed }));
        return;
      }
      toast.error(failureMessage);
    },
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
      toast.success(t("orders2b2.success.imei"));
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "imei", t)),
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
      toast.success(t("orders2b2.success.diagnosis"));
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "diagnosis", t)),
  });

  const quotePublish = useMutation({
    mutationFn: (input: {
      idempotencyKey: string;
      diagnosisResult: string;
      faultPrices: OrderDetail["order"]["fault_prices"];
      priceException?: Parameters<typeof publishOrderQuote>[1]["price_exception"];
    }) => {
      if (!data) throw new Error("工单未加载");
      return publishOrderQuote(id, {
        expected_updated_at: data.order.updated_at,
        idempotency_key: input.idempotencyKey,
        diagnosis_result: input.diagnosisResult,
        fault_prices: input.faultPrices,
        price_exception: input.priceException,
      });
    },
    onSuccess: (result) => {
      toast.success(
        t(result.replayed ? "orders2b2.success.quoteReplayed" : "orders2b2.success.quotePublished"),
      );
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "quote", t)),
  });

  const deviceUnlockUpdate = useMutation({
    mutationFn: (device_unlock: DeviceUnlockInput) => {
      if (!data) throw new Error("工单未加载");
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes: { device_unlock },
      });
    },
    onSuccess: () => {
      toast.success(t("orders2b2.success.unlock"));
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "unlock", t)),
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
      toast.success(t("orders2b2.success.supplier"));
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "supplier", t)),
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
      toast.success(t("orders2b2.success.assignee"));
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "assignee", t)),
  });

  const attachmentUpload = useMutation({
    mutationFn: (input: OrderAttachmentUploadInput) => uploadOrderAttachment(id, input),
    onSuccess: () => {
      toast.success(t("orders2b2.success.attachment"));
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(getOrderDetailSafeErrorMessage(error, "attachment", t)),
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
      toast.success(t("orders2b2.success.finance"));
      invalidate();
    },
    onError: (error: unknown) => {
      const message = getOrderDetailSafeErrorMessage(error, "finance", t);
      setMobileFinanceSaveError(message);
      toast.error(message);
    },
  });

  const quoteSentConfirmation = useMutation({
    mutationFn: (input: { body: string; quoteEventId: string; idempotencyKey: string }) => {
      if (!data) throw new Error("工单未加载");
      return confirmOrderQuoteSent(id, {
        expected_updated_at: data.order.updated_at,
        idempotency_key: input.idempotencyKey,
        quote_event_id: input.quoteEventId,
        message_body: input.body,
      });
    },
    onSuccess: () => {
      toast.success(t("orders2b2.success.quoteSent"));
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(getOrderDetailSafeErrorMessage(error, "quoteConfirmation", t)),
  });

  const approvalDecision = useMutation({
    mutationFn: (input: OrderApprovalDecisionInput) => decideOrderApproval(id, input),
    onSuccess: (result) => {
      toast.success(
        t(
          result.decision === "approved"
            ? "orders2b2.success.approved"
            : "orders2b2.success.rejected",
          { status: localizeWorkflowStatusLabel(workflow, result.to, t) },
        ),
      );
      setApprovalDecisionOpen(false);
      invalidate();
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "approval", t)),
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
          ? t("orders2b2.success.notificationTransition", {
              status: localizeWorkflowStatusLabel(workflow, result.to, t),
            })
          : t("orders2b2.success.notification"),
      );
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(getOrderDetailSafeErrorMessage(error, "notification", t)),
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
      toast.success(
        t("orders2b2.success.kiosk", {
          device: session.device?.label ?? activeKioskDevice?.label ?? "iPad",
        }),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: kioskKeys.sessions(activeStoreId) }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.detail(id, activeStoreId) }),
      ]);
    },
    onError: (error: unknown) => toast.error(getOrderDetailSafeErrorMessage(error, "kiosk", t)),
  });

  const mobileFinance = useMemo(() => {
    if (!data) return null;
    return normalizeFinanceDraft(financeDraft, inferOrderPaidAmount(data.order));
  }, [data, financeDraft]);

  const editSavePlanState = useMemo(() => {
    if (!data?.capabilities || !editBaseline || !persistedEditDraft) {
      return { plan: null, error: undefined };
    }
    try {
      return {
        plan: buildOrderEditSavePlan({
          baseline: editBaseline,
          draft: persistedEditDraft,
          capabilities: data.capabilities,
        }),
        error: undefined,
      };
    } catch {
      return {
        plan: null,
        error: getOrderDetailSafeErrorMessage(undefined, "save", t),
      };
    }
  }, [data?.capabilities, editBaseline, persistedEditDraft, t]);
  const editSavePlan = editSavePlanState.plan;
  const baselineFinanceDraft = useMemo(
    () =>
      editBaseline
        ? createFinanceDraftState(editBaseline.fault_prices, editBaseline.deposit_amount ?? 0)
        : null,
    [editBaseline],
  );
  const invalidFinanceDraftChanged = Boolean(
    editFinance &&
    !editFinance.canSave &&
    baselineFinanceDraft &&
    JSON.stringify(financeDraft) !== JSON.stringify(baselineFinanceDraft),
  );
  const editFinanceChanged = Boolean(
    editSavePlan?.financeChange || editSavePlanState.error || invalidFinanceDraftChanged,
  );
  const hasLocalEditChanges = Boolean(editSavePlan?.steps.length || editFinanceChanged);
  const editServerVersionChanged = Boolean(
    isEditing &&
    editBaseline?.expected_updated_at &&
    data?.order.updated_at &&
    editBaseline.expected_updated_at !== data.order.updated_at,
  );
  const remoteEditConflict = hasOrderEditRemoteConflict({
    baselineUpdatedAt: editBaseline?.expected_updated_at,
    currentUpdatedAt: data?.order.updated_at,
    hasLocalChanges: hasLocalEditChanges,
    isEditing,
  });
  const editValidationError = useMemo(
    () =>
      remoteEditConflict
        ? t("orders2b2.conflict.description")
        : (editSavePlanState.error ??
          getEditValidationError(
            editDraft,
            {
              routineChanges: editSavePlan?.routineChanges ?? {},
              financeChanged: editFinanceChanged,
              financeError: editFinance?.error,
              defaultWarrantyMonths,
            },
            t,
          )),
    [
      defaultWarrantyMonths,
      editDraft,
      editFinance?.error,
      editFinanceChanged,
      editSavePlan?.routineChanges,
      editSavePlanState.error,
      remoteEditConflict,
      t,
    ],
  );
  const editCanSave = Boolean(
    persistedEditDraft &&
    (editSavePlan?.steps.length || editFinanceChanged) &&
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
      toast.error(t("orders2b2.permission.edit"));
      return;
    }
    const draft = buildEditForm(data, defaultWarrantyMonths);
    setEditBaseline(draft);
    setEditDraft(draft);
    setFinanceDraft(createFinanceDraftState(draft.fault_prices, draft.deposit_amount ?? 0));
    setDesktopDetailView("overview");
    setIsEditing(true);
  }, [data, defaultWarrantyMonths, t]);

  const cancelEditing = useCallback(() => {
    void discardCurrentEditOfflineDraft();
    setIsEditing(false);
    setEditBaseline(null);
    setEditDraft(null);
    if (data) {
      const draft = buildEditForm(data, defaultWarrantyMonths);
      setFinanceDraft(createFinanceDraftState(draft.fault_prices, draft.deposit_amount ?? 0));
    }
  }, [data, defaultWarrantyMonths, discardCurrentEditOfflineDraft]);

  const loadLatestEditVersion = useCallback(async () => {
    if (!data) return;
    await discardCurrentEditOfflineDraft();
    const latestDraft = buildEditForm(data, defaultWarrantyMonths);
    setEditBaseline(latestDraft);
    setEditDraft(latestDraft);
    setFinanceDraft(
      createFinanceDraftState(latestDraft.fault_prices, latestDraft.deposit_amount ?? 0),
    );
    toast.success(t("orders2b2.conflict.loaded"));
  }, [data, defaultWarrantyMonths, discardCurrentEditOfflineDraft, t]);

  useEffect(() => {
    if (!data || !editServerVersionChanged || hasLocalEditChanges) return;
    void discardCurrentEditOfflineDraft();
    const latestDraft = buildEditForm(data, defaultWarrantyMonths);
    setEditBaseline(latestDraft);
    setEditDraft(latestDraft);
    setFinanceDraft(
      createFinanceDraftState(latestDraft.fault_prices, latestDraft.deposit_amount ?? 0),
    );
  }, [
    data,
    defaultWarrantyMonths,
    discardCurrentEditOfflineDraft,
    editServerVersionChanged,
    hasLocalEditChanges,
  ]);

  const showDesktopRecords = useCallback(() => {
    setDesktopDetailView("records");
    setDesktopRecordsView("key-info");
  }, []);

  const saveEditing = useCallback(async () => {
    if (
      editSaveInFlightRef.current ||
      orderUpdate.isPending ||
      !editBaseline ||
      !persistedEditDraft ||
      !editFinance ||
      !data?.capabilities
    ) {
      return;
    }
    if (editValidationError || (editFinanceChanged && !editFinance.canSave)) {
      toast.error(editValidationError ?? editFinance.error ?? t("orders2b2.validation.checkOrder"));
      return;
    }
    editSaveInFlightRef.current = true;
    try {
      await orderUpdate.mutateAsync({
        baseline: editBaseline,
        draft: persistedEditDraft,
        capabilities: data.capabilities,
      });
    } catch {
      // Mutation callbacks preserve retry state and show the actionable error.
    } finally {
      editSaveInFlightRef.current = false;
    }
  }, [
    data?.capabilities,
    editBaseline,
    editFinance,
    editFinanceChanged,
    editValidationError,
    orderUpdate,
    persistedEditDraft,
    t,
  ]);
  const restoreEditOfflineDraft = useCallback(async () => {
    const result = await restoreEditOfflinePromptDraft();
    if (!result) return;
    if (result.status === "conflict") {
      toast.error(getOrderDetailSafeErrorMessage({ status: 409 }, "save", t));
      return;
    }
    if (data) setEditBaseline(buildEditForm(data, defaultWarrantyMonths));
    setEditDraft(result.draft);
    setFinanceDraft(
      createFinanceDraftState(result.draft.fault_prices, result.draft.deposit_amount ?? 0),
    );
    setIsEditing(true);
    toast.success(t("orders2b2.draft.restored"));
  }, [data, defaultWarrantyMonths, restoreEditOfflinePromptDraft, t]);
  const discardEditOfflinePrompt = useCallback(async () => {
    const discarded = await discardEditOfflinePromptDraft();
    if (discarded) toast.success(t("orders2b2.draft.discarded"));
  }, [discardEditOfflinePromptDraft, t]);

  if (
    !data &&
    (shell.status === "loading" || (Boolean(activeStoreId) && (isLoading || isPending)))
  ) {
    return (
      <div
        data-order-detail-render-mode={orderDetailRenderMode}
        data-order-detail-renderer={orderDetailRenderMode}
        className="contents"
      >
        <OrderDetailSkeleton
          surface={surface}
          onClose={onClose}
          renderMode={orderDetailRenderMode}
        />
      </div>
    );
  }
  if (!activeStoreId) {
    return (
      <StoreShellUnavailableState
        shell={shell}
        onRetry={shell.retry}
        title={t("orders2b2.storeUnavailable.title")}
        description={t("orders2b2.storeUnavailable.description")}
        actionLabel={t("orders2b2.storeUnavailable.action")}
        retryLabel={t("orders2b2.storeUnavailable.retry")}
      />
    );
  }
  if (detailIsError || !data) {
    const message = getOrderDetailSafeErrorMessage(detailError, "load", t);
    return (
      <div
        className={cn(
          "min-w-0 max-w-full space-y-3 overflow-x-clip",
          surface === "page"
            ? "mx-auto w-full max-w-[1200px] px-2.5 pb-28 pt-0 sm:px-4 sm:pb-32 md:px-6"
            : cn(detailWorkspace.root, "flex h-full flex-col p-2 sm:p-3"),
        )}
      >
        <section className="rounded-xl border border-status-danger-foreground/20 bg-status-danger px-4 py-4 text-status-danger-foreground">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-semibold">{t("orders2b2.loadFailed")}</p>
            {surface === "dialog" && onClose ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 rounded-lg bg-background/80"
                onClick={onClose}
                aria-label={t("orders2b2.close")}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <p className="mt-1 break-words text-xs leading-5">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg bg-background/80 text-xs"
              onClick={() => void refetchDetail()}
            >
              {t("orders2b2.reload")}
            </Button>
            {surface === "page" ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-lg bg-background/80 text-xs"
              >
                <Link href="/orders">
                  <ArrowLeft className="size-3.5" /> {t("orders2b2.backOrders")}
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }
  if (surface === "page" && orderDetailRenderMode === "pending") {
    return (
      <div
        data-order-detail-render-mode="pending"
        data-order-detail-renderer="pending"
        className="min-w-0"
      >
        <OrderDetailSkeleton surface="page" onClose={onClose} renderMode={orderDetailRenderMode} />
      </div>
    );
  }
  const { order, customer, device, supplier, events, messages } = data;
  const isVoided = order.record_state === "voided" || Boolean(order.deleted_at);
  const cancelled = isOrderCancelledState(order);
  const isTerminalOrder = isOrderTerminalState(order);
  const canPrintCustomerDocument = canPrintRepairOrderCustomerDocument(order);
  const printDisabledReason =
    printPreparing || generationPending ? t("orders2b2.print.preparing") : undefined;
  const printCustomerDocument = async (paperMode: PrintPaperMode) => {
    rememberOrderPrintPaperMode(paperMode);
    setPrintPaperMode(paperMode);
    setPrintPaperDialogOpen(false);
    const outcome = await requestPrint(paperMode, `${order.public_no}.pdf`, async (context) => {
      setPrintPreparing(true);
      try {
        setCustomerStatusUrl("");
        const links = await issueCustomerStatusLinks([order.id], { signal: context.signal });
        if (!context.isCurrent()) return;
        const link = links.find((item) => item.order_id === order.id);
        if (!link?.url) throw new Error(t("orders2b2.customerStatus.prepareFailed"));
        setCustomerStatusUrl(link.url);
      } finally {
        setPrintPreparing(false);
      }
    });
    if (outcome === "busy") toast.info(t("orders2b2.print.busy"));
  };
  const canRevokeCustomerStatusLinks = shell.activeStore?.role === "owner";
  const revokePrintedCustomerStatusLinks = async () => {
    if (!canRevokeCustomerStatusLinks || customerStatusRevokePending) return;
    if (!window.confirm(t("orders2b2.customerStatus.resetConfirm"))) {
      return;
    }
    setCustomerStatusRevokePending(true);
    try {
      const revokedCount = await revokeCustomerStatusLinks(order.id);
      setCustomerStatusUrl("");
      toast.success(
        revokedCount > 0
          ? t("orders2b2.customerStatus.resetDone")
          : t("orders2b2.customerStatus.resetNone"),
      );
    } catch (error) {
      toast.error(getOrderDetailSafeErrorMessage(error, "customerStatus", t));
    } finally {
      setCustomerStatusRevokePending(false);
    }
  };
  const canNotify = !isVoided && !cancelled && !order.customer_contact_redacted;
  const canPromoteNotification =
    canNotify && order.contact_phones.some((phone) => phone.replace(/\D/g, "").length >= 6);
  const latestPublishedQuoteId = data.latest_quote_event_id;
  const canOpenDiagnosisQuote = Boolean(
    data.capabilities?.canEditRepair || data.capabilities?.canPrepareQuote,
  );
  const approvalQuoteReady = Boolean(
    data.capabilities?.canSendQuote &&
    latestPublishedQuoteId &&
    order.status === "quoted" &&
    order.contact_phones.some((phone) => phone.replace(/\D/g, "").length >= 6),
  );
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
  const desktopPrimaryAction = resolveOrderDetailPrimaryAction({
    status: order.status,
    cancelled: cancelled || isVoided,
    notifyStatus: order.notify_status,
    approvalOverdue: order.approval_overdue,
    pickupOverdue: order.pickup_overdue,
    approvalDecisionAvailable: canDecideApproval,
    flowAvailable: desktopStatusActions.length > 0,
    notificationAvailable: canPromoteNotification,
    paymentAvailable: canCollectPayment && !order.finance_redacted,
  });
  const deviceBrand = order.device_snapshot?.brand || device?.brand || "";
  const deviceModel = order.device_snapshot?.model || device?.model || "";
  const deviceLabel = `${deviceBrand} ${deviceModel}`.trim() || order.device_label;
  const deviceImei =
    order.device_snapshot?.serial_or_imei || order.device_imei || device?.serial_or_imei || "";
  const deviceNotes = order.device_snapshot?.device_notes || device?.device_notes;
  const accessoryNotes = order.accessory_notes;
  const canUpdateCustody = Boolean(
    data.capabilities?.canEditIntake || data.capabilities?.canCorrect,
  );
  const canCorrectTerminalCustody = data.capabilities?.canCorrect === true;
  const custodyTerminal =
    order.status === "completed" ||
    cancelled ||
    (order.workflow_bucket !== undefined
      ? order.workflow_bucket === "done"
      : order.workflow_status === "closed");
  const custodyReasonRequired = custodyStatus === null || custodyTerminal;
  const signatureAttachments = (data.attachments ?? []).filter(
    (attachment) => attachment.kind === "signature",
  );
  const photoAttachments = (data.attachments ?? []).filter(
    (attachment) => attachment.mime_type.startsWith("image/") && attachment.kind !== "signature",
  );
  const canReadInternalCosts = Boolean(data.capabilities?.canReadInternalCosts && activeStoreId);
  const safeDesktopDetailView =
    desktopDetailView === "costs" && !canReadInternalCosts ? "overview" : desktopDetailView;
  const desktopDetailTabs: OrderDetailTab<DesktopDetailView>[] = [
    { key: "overview", label: t("orders2b2.tab.overview") },
    {
      key: "records",
      label: t("orders2b2.tab.records", { count: events.length + messages.length }),
    },
    {
      key: "photos",
      label: t("orders2b2.tab.photos", { count: photoAttachments.length }),
    },
    ...(canReadInternalCosts
      ? ([
          { key: "costs", label: t("orders2b2.tab.costs") },
        ] satisfies OrderDetailTab<DesktopDetailView>[])
      : []),
  ];
  const desktopRecordsTabs: OrderDetailTab<DesktopRecordsView>[] = [
    { key: "key-info", label: t("orders2b2.tab.keyInfo") },
    {
      key: "messages",
      label: t("orders2b2.tab.notifications", { count: messages.length }),
    },
    { key: "timeline", label: t("orders2b2.tab.timeline", { count: events.length }) },
  ];
  const renderCustodyPanel = () => (
    <div className={cn("min-w-0", surface === "dialog" && "mx-auto w-full max-w-[780px]")}>
      {cancelled && custodyStatus === DEVICE_CUSTODY_WITH_SHOP && !order.delivered_at ? (
        <section
          className={cn(
            "mb-2 flex min-w-0 items-center gap-2 border border-status-warn-foreground/25 bg-status-warn/55 px-3 py-2 text-status-warn-foreground md:rounded-lg",
          )}
        >
          <PackageCheck className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{t("orders2b2.custody.returnPending")}</p>
            <p className="truncate text-[11px] opacity-80 lg:text-xs lg:leading-4 lg:opacity-100">
              {t("orders2b2.custody.returnReminder")}
            </p>
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
              {t("orders2b2.custody.confirmReturned")}
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
        workflowBucket={getWorkflowStatus(workflow, order.status)?.bucket}
        canUpdate={canUpdateCustody}
        canCorrectTerminal={canCorrectTerminalCustody}
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
    </div>
  );
  const renderDesktopCustodyControl = () => (
    <OrderDeviceCustodyCard
      order={order}
      events={events}
      workflowBucket={getWorkflowStatus(workflow, order.status)?.bucket}
      canUpdate={canUpdateCustody}
      canCorrectTerminal={canCorrectTerminalCustody}
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
      variant="inline"
    />
  );

  return (
    <div
      data-order-detail-root="true"
      data-order-detail-surface={surface}
      data-order-detail-render-mode={orderDetailRenderMode}
      data-order-detail-renderer={orderDetailRenderMode}
      className={cn(
        "relative min-w-0 max-w-full overflow-x-clip",
        surface === "page"
          ? "mx-auto w-full max-w-[430px] px-2 pb-28 pt-0 sm:max-w-[430px] sm:px-2 sm:pb-32 md:max-w-[1100px] md:px-6"
          : cn(detailWorkspace.root, "flex h-full flex-col"),
      )}
    >
      <h1 className="sr-only">{t("orders2b2.title")}</h1>
      {orderDetailRenderMode === "compact" ? (
        <>
          <MobileOrderDetailView
            data={data}
            deviceLabel={deviceLabel}
            deviceImei={deviceImei}
            accessoryNotes={accessoryNotes}
            storeSettings={storeSettings}
            workflow={workflow}
            topNotice={
              <OrderTerminalActions
                detail={data}
                workflow={workflow}
                onCompleted={invalidate}
                className="mb-2"
              />
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
                const message = t("orders2b2.validation.checkOrder");
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
            primaryAction={desktopPrimaryAction}
            onPrint={() => setPrintPaperDialogOpen(true)}
            printDisabled={!canPrintCustomerDocument || generationPending}
            printDisabledReason={printDisabledReason}
            onRevokeCustomerStatusLinks={
              canRevokeCustomerStatusLinks
                ? () => void revokePrintedCustomerStatusLinks()
                : undefined
            }
            customerStatusRevokePending={customerStatusRevokePending}
            onCancel={() => setCancelOpen(true)}
            canCancel={canCancelOrder}
            onRequestKioskSignature={
              canCreateKioskSession ? () => kioskSignatureRequest.mutate() : undefined
            }
            kioskSignaturePending={kioskSignatureRequest.isPending}
            kioskSignatureAvailable={
              canCreateKioskSession &&
              Boolean(activeKioskDevice) &&
              custodyStatus === DEVICE_CUSTODY_WITH_SHOP
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
            custodyPanel={renderCustodyPanel()}
          />
          {data.capabilities?.canReadInternalCosts && activeStoreId ? (
            <OrderInternalCostCard
              orderId={order.id}
              storeId={activeStoreId}
              faultPrices={order.fault_prices}
              canManage={Boolean(data.capabilities.canManageInternalCosts)}
              canAllocatePartsCosts={Boolean(data.capabilities.canAllocatePartsCosts)}
              onRepairQuoteLines={
                data.capabilities?.canAdjustFinance && !isVoided && !isTerminalOrder
                  ? () => {
                      setMobileFinanceEditing(true);
                      window.requestAnimationFrame(() => {
                        document.getElementById("mobile-order-quote")?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      });
                    }
                  : undefined
              }
            />
          ) : null}
        </>
      ) : (
        <div
          className={cn(
            surface === "dialog" &&
              "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-2.5 md:p-3",
          )}
        >
          <div className={cn("relative z-20", detailWorkspace.orderDetailContent)}>
            <OrderHero
              order={order}
              onPrint={() => setPrintPaperDialogOpen(true)}
              printDisabled={!canPrintCustomerDocument || generationPending}
              printDisabledReason={printDisabledReason}
              printPending={printPreparing || generationPending}
              onRevokeCustomerStatusLinks={
                canRevokeCustomerStatusLinks
                  ? () => void revokePrintedCustomerStatusLinks()
                  : undefined
              }
              customerStatusRevokePending={customerStatusRevokePending}
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
              storeName={storeOutputIdentity.storeName}
              isEditing={isEditing}
              editPending={orderUpdate.isPending}
              editSaveDisabled={!editCanSave}
              showBackLink={surface === "page"}
              surface={surface}
              onClose={onClose}
              currentStage={desktopCurrentStage}
              currentStageIndex={desktopStageIndex}
              nextActionLabel={
                canDecideApproval
                  ? t("orders2b2.hero.approval")
                  : next.primary
                    ? localizeWorkflowStatusLabel(workflow, next.primary.to, t)
                    : undefined
              }
              taskHint={
                canDecideApproval
                  ? t("orders2b2.approval.taskHint")
                  : next.primary
                    ? getStatusActionHint(next.primary.to, order, t)
                    : undefined
              }
              approvalDecisionAvailable={canDecideApproval}
              financeSummary={
                surface === "dialog" ? (
                  <OrderDetailHeaderFinanceSummary
                    order={order}
                    isEditing={isEditing}
                    financeDraft={financeDraft}
                  />
                ) : undefined
              }
              contextualStatus={
                <OrderTerminalActions
                  detail={data}
                  workflow={workflow}
                  onCompleted={invalidate}
                  variant="compact"
                />
              }
              printRecovery={undefined}
            />
          </div>

          {surface === "dialog" ? (
            <div
              data-order-detail-view-switcher="true"
              className="relative z-10 mx-auto mb-2 flex w-fit max-w-full min-w-0 items-center gap-2"
            >
              <OrderDetailTabs
                tabs={isEditing ? desktopDetailTabs.slice(0, 1) : desktopDetailTabs}
                activeTab={safeDesktopDetailView}
                onChange={changeDesktopDetailView}
                ariaLabel={t("orders2b2.tabsAria")}
                idPrefix="order-detail-workspace"
                className="!m-0 min-w-0"
              />
              {canOpenDiagnosisQuote ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 min-w-11 shrink-0 px-3 text-xs lg:h-8 lg:min-w-0 lg:px-2.5"
                  onClick={() => setDiagnosisQuoteOpen(true)}
                >
                  {data.capabilities?.canPrepareQuote
                    ? t("orders2b2.diagnosis.openPrepare")
                    : t("orders2b2.diagnosis.openRecord")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className={cn("min-w-0", surface === "dialog" && "min-h-0 flex-1 overflow-y-auto")}>
            <motion.div
              data-order-desktop-single-workspace="true"
              data-order-detail-content-end="true"
              variants={stagger(0.05)}
              initial="hidden"
              animate="show"
              className={cn("min-w-0 space-y-2 sm:space-y-3", surface === "dialog" && "min-h-full")}
            >
              <OrderEditOfflineDraftNotice
                state={editOfflineState}
                errorMessage={
                  editOfflineErrorMessage
                    ? getOrderDetailSafeErrorMessage(undefined, "save", t)
                    : null
                }
                lastSavedAt={editOfflineLastSavedAt}
                prompt={editOfflineDraftPrompt}
                pendingRestoreNotice={editOfflineRestoreNotice}
                hasSensitiveUnlockDraft={editOfflineHasSensitiveUnlockDraft}
                isEditing={isEditing}
                onRestore={() => void restoreEditOfflineDraft()}
                onDiscard={() => void discardEditOfflinePrompt()}
              />
              {remoteEditConflict ? (
                <section
                  role="alert"
                  data-order-edit-remote-conflict="true"
                  className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border border-status-warn-foreground/30 bg-status-warn/20 px-3 py-2.5 text-status-warn-foreground sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{t("orders2b2.conflict.title")}</div>
                      <p className="mt-0.5 text-[11px] leading-4 opacity-80 lg:text-xs lg:leading-[18px] lg:opacity-100">
                        {t("orders2b2.conflict.description")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 border-status-warn-foreground/30 bg-background px-2.5 text-xs text-status-warn-foreground hover:bg-status-warn/15"
                    onClick={() => void loadLatestEditVersion()}
                  >
                    <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />
                    {t("orders2b2.conflict.reload")}
                  </Button>
                </section>
              ) : null}
              {isEditing && editValidationError && !remoteEditConflict ? (
                <p
                  role="alert"
                  data-order-edit-validation="true"
                  className="rounded-lg border border-status-danger-foreground/20 bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
                >
                  {editValidationError}
                </p>
              ) : null}
              {surface !== "dialog" && canOpenDiagnosisQuote ? (
                <section className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-primary/20 bg-primary/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">
                      {t("orders2b2.diagnosis.workspaceTitle")}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
                      {latestPublishedQuoteId
                        ? t("orders2b2.diagnosis.versionNotice")
                        : t("orders2b2.diagnosis.newNotice")}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 text-xs"
                    onClick={() => setDiagnosisQuoteOpen(true)}
                  >
                    {data.capabilities?.canPrepareQuote
                      ? t("orders2b2.diagnosis.actionPrepare")
                      : t("orders2b2.diagnosis.actionRecord")}
                  </Button>
                </section>
              ) : null}
              {surface !== "dialog" || safeDesktopDetailView === "overview" ? (
                <section
                  id={surface === "dialog" ? "order-detail-workspace-panel-overview" : undefined}
                  role={surface === "dialog" ? "tabpanel" : undefined}
                  aria-labelledby={
                    surface === "dialog" ? "order-detail-workspace-tab-overview" : undefined
                  }
                  className={cn("min-w-0", detailWorkspace.orderDetailContent)}
                >
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
                    activeStoreId={activeStoreId}
                    canReadInternalCosts={Boolean(data.capabilities?.canReadInternalCosts)}
                    canManageInternalCosts={Boolean(data.capabilities?.canManageInternalCosts)}
                    canAllocatePartsCosts={Boolean(data.capabilities?.canAllocatePartsCosts)}
                    onRepairQuoteLines={
                      data.capabilities?.canAdjustFinance && !isVoided && !isTerminalOrder
                        ? startEditing
                        : undefined
                    }
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
                    onShowRecords={showDesktopRecords}
                    photoAttachments={photoAttachments}
                    signatureAttachments={signatureAttachments}
                    photoUploadPending={attachmentUpload.isPending}
                    onPhotoCapture={
                      data.capabilities?.canUploadPhoto === true && !isVoided
                        ? (trigger) => {
                            desktopPhotoTriggerRef.current = trigger;
                            desktopPhotoOutsideDismissedRef.current = false;
                            setDesktopPhotoCaptureOpen(true);
                          }
                        : undefined
                    }
                    onRequestKioskSignature={
                      canCreateKioskSession ? () => kioskSignatureRequest.mutate() : undefined
                    }
                    kioskSignaturePending={kioskSignatureRequest.isPending}
                    kioskSignatureAvailable={
                      canCreateKioskSession &&
                      Boolean(activeKioskDevice) &&
                      custodyStatus === DEVICE_CUSTODY_WITH_SHOP
                    }
                    custodyControl={renderDesktopCustodyControl()}
                  />
                </section>
              ) : null}
              {surface === "dialog" ? (
                <>
                  {safeDesktopDetailView === "records" ? (
                    <section
                      id="order-detail-workspace-panel-records"
                      role="tabpanel"
                      aria-labelledby="order-detail-workspace-tab-records"
                      className={cn("min-w-0", detailWorkspace.orderDetailReadable)}
                    >
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
                        tabs={desktopRecordsTabs}
                        activeView={desktopRecordsView}
                        onViewChange={setDesktopRecordsView}
                      />
                    </section>
                  ) : null}
                  {safeDesktopDetailView === "photos" ? (
                    <section
                      id="order-detail-workspace-panel-photos"
                      role="tabpanel"
                      aria-labelledby="order-detail-workspace-tab-photos"
                      className={cn("min-w-0", detailWorkspace.orderDetailReadable)}
                    >
                      <DesktopOrderPhotosPanel
                        attachments={photoAttachments}
                        uploadPending={attachmentUpload.isPending}
                        onCapture={
                          data.capabilities?.canUploadPhoto === true && !isVoided
                            ? (trigger) => {
                                desktopPhotoTriggerRef.current = trigger;
                                desktopPhotoOutsideDismissedRef.current = false;
                                setDesktopPhotoCaptureOpen(true);
                              }
                            : undefined
                        }
                        surface={surface}
                      />
                    </section>
                  ) : null}
                  {canReadInternalCosts &&
                  (desktopCostsVisited || safeDesktopDetailView === "costs") ? (
                    <section
                      id="order-detail-workspace-panel-costs"
                      role="tabpanel"
                      aria-labelledby="order-detail-workspace-tab-costs"
                      hidden={safeDesktopDetailView !== "costs"}
                      className={cn("min-w-0", detailWorkspace.orderDetailReadable)}
                    >
                      <OrderInternalCostCard
                        orderId={order.id}
                        storeId={activeStoreId}
                        faultPrices={order.fault_prices}
                        canManage={Boolean(data.capabilities?.canManageInternalCosts)}
                        canAllocatePartsCosts={Boolean(data.capabilities?.canAllocatePartsCosts)}
                        onRepairQuoteLines={
                          data.capabilities?.canAdjustFinance && !isVoided && !isTerminalOrder
                            ? startEditing
                            : undefined
                        }
                      />
                    </section>
                  ) : null}
                </>
              ) : (
                <div className={cn("scroll-mt-24", detailWorkspace.orderDetailReadable)}>
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
              )}
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
                  workflow={workflow}
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
              primaryAction={desktopPrimaryAction}
              surface={surface}
            />
          ) : null}
        </div>
      )}

      {canNotify ? (
        <NotifyDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          data={data}
          workflow={workflow}
          orderUrl={orderUrl}
          storeIdentity={storeOutputIdentity}
          canReadStoreSettings={shell.permissions?.canReadStoreSettings === true}
          canUpdateStoreSettings={shell.permissions?.canUpdateStoreSettings === true}
          onRetryStoreSettings={storeSettingsQuery.refetch}
          onReloadStoreContext={shell.retry}
          busy={whatsappNotification.isPending || quoteSentConfirmation.isPending}
          approvalQuoteReady={approvalQuoteReady}
          approvalQuoteBlockedReason={
            data.capabilities?.canSendQuote !== true
              ? t("orders2b2.notify.blockedPermission")
              : !latestPublishedQuoteId
                ? t("orders2b2.notify.quoteBlocked")
                : order.status !== "quoted"
                  ? t("orders2b2.notify.blockedStatus")
                  : t("orders2b2.notify.blockedPhone")
          }
          onConfirm={async (input) => {
            if (
              input.templateKind === "approval_request" &&
              (order.status === "quoted" || order.status === "waiting_approval")
            ) {
              if (!latestPublishedQuoteId) {
                throw new Error(t("orders2b2.notify.latestQuoteRequired"));
              }
              await quoteSentConfirmation.mutateAsync({
                body: input.body,
                quoteEventId: latestPublishedQuoteId,
                idempotencyKey: input.idempotencyKey,
              });
              return;
            }
            await whatsappNotification.mutateAsync(input);
          }}
        />
      ) : null}
      {canOpenDiagnosisQuote ? (
        <DiagnosisQuoteDialog
          open={diagnosisQuoteOpen}
          onOpenChange={setDiagnosisQuoteOpen}
          order={order}
          capabilities={data.capabilities}
          isPending={quotePublish.isPending || faultUpdate.isPending}
          onSaveDiagnosis={async (diagnosisResult) => {
            await faultUpdate.mutateAsync({ diagnosis_result: diagnosisResult });
          }}
          onPublish={async (input) => {
            await quotePublish.mutateAsync(input);
          }}
        />
      ) : null}
      <ApprovalDecisionSheet
        open={approvalDecisionOpen}
        onOpenChange={setApprovalDecisionOpen}
        order={order}
        pending={approvalDecision.isPending}
        onConfirm={async (input) => {
          try {
            await approvalDecision.mutateAsync(input);
          } catch {
            // The mutation onError owns safe feedback; keep the decision draft open.
          }
        }}
      />
      {canCollectPayment && !order.finance_redacted ? (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          balance={order.balance_amount}
          onPay={async (amount, method, idempotencyKey) => {
            await recordPayment(id, amount, method, order.updated_at, idempotencyKey);
            toast.success(
              t("orders2b2.success.payment", { amount: formatCurrency(amount, locale) }),
            );
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
        current={custodyStatus}
        target={custodyDialogTarget}
        reason={custodyReason}
        reasonRequired={custodyReasonRequired}
        minimumReasonLength={custodyTerminal ? 5 : custodyReasonRequired ? 1 : 0}
        pending={custodyUpdate.isPending}
        canSubmit={canUpdateCustody && !(custodyTerminal && !canCorrectTerminalCustody)}
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
      {data.capabilities?.canUploadPhoto === true && !isVoided ? (
        <CameraCaptureSheet
          open={desktopPhotoCaptureOpen}
          onOpenChange={setDesktopPhotoCaptureOpen}
          attachmentKind="fault_photo"
          purpose="order-attachment"
          onOutsideDismiss={() => {
            desktopPhotoOutsideDismissedRef.current = true;
          }}
          onCloseAutoFocus={handleDesktopPhotoCloseAutoFocus}
          onCapture={(draft) => {
            void uploadAttachmentDraft(draft, async (input) => {
              await attachmentUpload.mutateAsync(input);
            }).catch(() => undefined);
          }}
        />
      ) : null}
      <RepairOrderPrintSheet
        data={data}
        storeSettings={storeSettings}
        activeStore={shell.activeStore}
        customerStatusUrl={customerStatusUrl}
        paperMode={printPaperMode}
      />
      <OrderPrintPaperDialog
        open={printPaperDialogOpen}
        onOpenChange={setPrintPaperDialogOpen}
        onSelect={(mode) => void printCustomerDocument(mode)}
      />
      <FixedPdfReadyDialog
        prepared={preparedPdf}
        pending={deliveryPending}
        errorMessage={
          deliveryError ? getOrderDetailSafeErrorMessage(undefined, "print", t) : undefined
        }
        onClose={dismissPreparedPdf}
        onShare={() => void sharePreparedPdf()}
        onOpenPdf={openPreparedPdf}
        onDownload={downloadPreparedPdf}
      />
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
  const { t } = useLocale();
  const isDesktop = useDesktopActionSurface();
  const footer = (
    <>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
        {t("orders2b2.custody.back")}
      </Button>
      <Button type="button" disabled={pending} onClick={onConfirm}>
        <PackageCheck className="size-4" />
        {pending ? t("orders2b2.custody.confirming") : t("orders2b2.custody.confirmReturn")}
      </Button>
    </>
  );
  const description = t("orders2b2.custody.returnHelp");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-busy={pending} className={componentOverlay.modalSm}>
          <DialogHeader>
            <DialogTitle>{t("orders2b2.custody.returnTitle")}</DialogTitle>
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
          <SheetTitle>{t("orders2b2.custody.returnTitle")}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <p className="sr-only" role="status" aria-live="polite">
          {pending ? t("orders2b2.custody.returnSaving") : ""}
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
  current,
  target,
  reason,
  reasonRequired,
  minimumReasonLength,
  pending,
  canSubmit,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  current: DeviceCustodyStatus | null;
  target: DeviceCustodyStatus | null;
  reason: string;
  reasonRequired: boolean;
  minimumReasonLength: number;
  pending: boolean;
  canSubmit: boolean;
  onReasonChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const isDesktop = useDesktopActionSurface();
  const title =
    target === DEVICE_CUSTODY_WITH_SHOP
      ? t("orders2b2.custody.receiveTitle")
      : t("orders2b2.custody.customerTitle");
  const description =
    target === DEVICE_CUSTODY_WITH_SHOP
      ? t("orders2b2.custody.receiveHelp")
      : current === DEVICE_CUSTODY_WITH_SHOP
        ? t("orders2b2.custody.deliverHelp")
        : t("orders2b2.custody.backfillCustomerHelp");
  const body = (
    <div className="grid min-w-0 gap-3 p-4">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        <span>
          {t("orders2b2.custody.reason")}
          {reasonRequired
            ? t("orders2b2.custody.required", {
                minimum:
                  minimumReasonLength > 1
                    ? t("orders2b2.custody.minimum", { count: minimumReasonLength })
                    : "",
              })
            : t("orders2b2.custody.optional")}
        </span>
        <Textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          maxLength={240}
          disabled={pending}
          className="min-h-24 resize-none text-sm"
          placeholder={
            reasonRequired
              ? t("orders2b2.custody.reasonRequiredPlaceholder")
              : t("orders2b2.custody.reasonOptionalPlaceholder")
          }
        />
      </label>
      <p className="sr-only" role="status" aria-live="polite">
        {pending ? t("orders2b2.custody.saving") : ""}
      </p>
    </div>
  );
  const footer = (
    <>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
        {t("common.cancel")}
      </Button>
      <Button
        type="button"
        disabled={
          pending ||
          !target ||
          !isDeviceCustodyReasonValid(reason, minimumReasonLength) ||
          !canSubmit
        }
        onClick={onConfirm}
      >
        {pending ? t("orders2b2.hero.saving") : t("orders2b2.custody.confirmSave")}
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
  workflowBucket,
  canUpdate,
  canCorrectTerminal,
  pending,
  onRequestChange,
  onConfirmCancelledReturn,
  className,
  variant = "card",
}: {
  order: OrderDetail["order"];
  events: OrderEvent[];
  workflowBucket?: string;
  canUpdate: boolean;
  canCorrectTerminal: boolean;
  pending: boolean;
  onRequestChange: (target: DeviceCustodyStatus) => void;
  onConfirmCancelledReturn: () => void;
  className?: string;
  variant?: "card" | "inline";
}) {
  const { locale, t } = useLocale();
  const status = deviceCustodyStatusFromOrder(order);
  const cancelled = isOrderCancelledState(order);
  const isVoided = order.record_state === "voided" || Boolean(order.deleted_at);
  const isTerminal =
    order.status === "completed" ||
    cancelled ||
    workflowBucket === "done" ||
    (workflowBucket === undefined && order.workflow_status === "closed");
  const canUpdateResolved = canUpdate && !isVoided;
  const latestHandoff = getLatestCustodyHandoff(events, t, locale);
  const description =
    status === DEVICE_CUSTODY_WITH_SHOP
      ? cancelled
        ? t("orders2b2.custody.cancelledShop")
        : t("orders2b2.custody.shop")
      : status === DEVICE_CUSTODY_WITH_CUSTOMER
        ? order.delivered_at
          ? t("orders2b2.custody.delivered", {
              date: formatOrderDateTime(order.delivered_at, locale),
            })
          : t("orders2b2.custody.customer")
        : t("orders2b2.custody.unknown");

  const actions: ReactNode[] = [];
  const allowsTarget = (target: DeviceCustodyStatus) =>
    deviceCustodyAllowsChange({
      current: status,
      target,
      status: order.status,
      exceptionStatus: order.exception_status,
      workflowBucket,
    });
  if (status === null && canUpdateResolved && (!isTerminal || canCorrectTerminal)) {
    actions.push(
      ...([DEVICE_CUSTODY_WITH_SHOP, DEVICE_CUSTODY_WITH_CUSTOMER] as const)
        .filter(allowsTarget)
        .map((target) => (
          <Button
            key={`backfill-${target}`}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              variant === "inline"
                ? "h-11 min-w-11 px-3 text-xs lg:h-7 lg:min-w-0 lg:px-2 lg:text-[11px] lg:leading-4"
                : "h-9 text-xs",
            )}
            disabled={pending}
            onClick={() => onRequestChange(target)}
          >
            {target === DEVICE_CUSTODY_WITH_SHOP
              ? t("orders2b2.custody.backfillShop")
              : t("orders2b2.custody.backfillCustomer")}
          </Button>
        )),
    );
  } else if (
    cancelled &&
    status === DEVICE_CUSTODY_WITH_SHOP &&
    !order.delivered_at &&
    canUpdateResolved
  ) {
    actions.push(
      <Button
        key="cancelled-return"
        type="button"
        size="sm"
        className={cn(
          variant === "inline"
            ? "h-11 min-w-11 px-3 text-xs lg:h-7 lg:min-w-0 lg:px-2 lg:text-[11px] lg:leading-4"
            : "h-9 text-xs",
        )}
        disabled={pending}
        onClick={onConfirmCancelledReturn}
      >
        <PackageCheck className="size-3.5" />
        {t("orders2b2.custody.confirmReturned")}
      </Button>,
    );
  } else if (!isTerminal && canUpdateResolved && status) {
    const target =
      status === DEVICE_CUSTODY_WITH_SHOP ? DEVICE_CUSTODY_WITH_CUSTOMER : DEVICE_CUSTODY_WITH_SHOP;
    if (allowsTarget(target))
      actions.push(
        <Button
          key="custody-toggle"
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            variant === "inline"
              ? "h-11 min-w-11 px-3 text-xs lg:h-7 lg:min-w-0 lg:px-2 lg:text-[11px] lg:leading-4"
              : "h-9 text-xs",
          )}
          disabled={pending}
          onClick={() => onRequestChange(target)}
        >
          {target === DEVICE_CUSTODY_WITH_SHOP
            ? t("orders2b2.custody.receive")
            : t("orders2b2.custody.deliver")}
        </Button>,
      );
  } else if (isTerminal && canCorrectTerminal && canUpdateResolved && status) {
    const target =
      status === DEVICE_CUSTODY_WITH_SHOP ? DEVICE_CUSTODY_WITH_CUSTOMER : DEVICE_CUSTODY_WITH_SHOP;
    if (allowsTarget(target)) {
      actions.push(
        <Button
          key="terminal-correction"
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            variant === "inline"
              ? "h-11 min-w-11 px-3 text-xs lg:h-7 lg:min-w-0 lg:px-2 lg:text-[11px] lg:leading-4"
              : "h-9 text-xs",
          )}
          disabled={pending}
          onClick={() => onRequestChange(target)}
        >
          {t("orders2b2.custody.correct")}
        </Button>,
      );
    }
  }

  return (
    <section
      data-order-device-custody="true"
      className={cn(
        variant === "inline"
          ? "grid min-w-0 gap-1.5 rounded-md bg-[var(--surface-panel-muted)]/55 px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          : "grid min-w-0 gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] px-2.5 py-2 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-3",
        status === null && "border-status-warn-foreground/30 bg-status-warn/35",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary",
            variant === "inline" ? "size-6" : "size-7",
          )}
        >
          {status === DEVICE_CUSTODY_WITH_CUSTOMER ? (
            <UserRound className="size-3.5" />
          ) : (
            <PackageSearch className="size-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h2 className="text-xs font-semibold">{t("orders2b2.overview.custody")}</h2>
            <DeviceCustodyBadge
              status={status}
              deliveredAt={order.delivered_at}
              label={localizeDeviceCustody(status, order.delivered_at, t)}
              className="text-[10px] lg:text-[11px] lg:leading-4"
            />
          </div>
          <p
            className={cn(
              "mt-0.5 break-words text-[10px] text-muted-foreground lg:text-[12px] lg:leading-4",
              variant === "inline" ? "line-clamp-2 leading-3" : "leading-3.5",
            )}
          >
            {description}
          </p>
          {latestHandoff ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4",
                variant !== "inline" && "md:break-words md:text-[10px] md:leading-4 lg:text-[11px]",
              )}
            >
              {t("orders2b2.custody.latest", {
                summary: latestHandoff.summary,
                date: formatOrderDateTime(latestHandoff.createdAt, locale),
                operator: latestHandoff.operator,
              })}
            </p>
          ) : null}
          {isTerminal && !canCorrectTerminal && status === null ? (
            <p className="mt-1 text-[10px] font-medium text-status-warn-foreground lg:text-xs lg:leading-[18px]">
              {t("orders2b2.custody.terminalNeedsManager")}
            </p>
          ) : null}
          {status !== DEVICE_CUSTODY_WITH_SHOP &&
          deviceCustodyBlocksStatus(order.status, workflowBucket) ? (
            <p className="mt-1 text-[10px] font-semibold text-status-danger-foreground lg:text-xs lg:leading-[18px]">
              {t("orders2b2.custody.conflictCustomer")}
            </p>
          ) : null}
          {status === DEVICE_CUSTODY_WITH_SHOP &&
          deviceCustodyBlocksStatus(order.status, workflowBucket) ? (
            <p className="mt-1 text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-[18px]">
              {t("orders2b2.custody.conflictShop")}
            </p>
          ) : null}
        </div>
      </div>
      {actions.length ? (
        <div className="flex min-w-0 flex-wrap gap-1 md:justify-end">{actions}</div>
      ) : null}
    </section>
  );
}

function getLatestCustodyHandoff(
  events: OrderEvent[],
  t: ReturnType<typeof useLocale>["t"],
  locale: ReturnType<typeof useLocale>["locale"],
) {
  for (const event of [...events].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  )) {
    const action = typeof event.payload.action === "string" ? event.payload.action : "";
    if (action.includes("custody")) {
      return {
        summary: localizeOrderDetailEvent(event, undefined, t, locale),
        createdAt: event.created_at,
        operator: event.operator_name || "-",
      };
    }
    const initialStatus = event.payload.device_custody_status;
    if (event.event_type === "created" && isDeviceCustodyStatus(initialStatus)) {
      return {
        summary: localizeOrderDetailEvent(
          {
            event_type: "note",
            payload: { action: "device_custody_backfilled", to: initialStatus },
          },
          undefined,
          t,
          locale,
        ),
        createdAt: event.created_at,
        operator: event.operator_name || "-",
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
  tabs,
  activeView,
  onViewChange,
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
  tabs?: readonly OrderDetailTab<DesktopRecordsView>[];
  activeView?: DesktopRecordsView;
  onViewChange?: (view: DesktopRecordsView) => void;
}) {
  const { t } = useLocale();
  const showAssignee = Boolean(onAssigneeChange);
  const showSupplier = Boolean(partsSupplier || supplierOptions.length || onPartsSupplierChange);

  return (
    <motion.div
      variants={fadeUp}
      data-order-records-workspace="true"
      className={cn(
        "grid min-w-0 items-start gap-2",
        surface === "dialog"
          ? cn(detailWorkspace.orderDetailReadable, "grid-cols-1")
          : "sm:gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]",
      )}
    >
      {showAssignee || showSupplier ? (
        <div
          data-order-responsibility-row="true"
          data-order-records-controls="true"
          className={cn(
            showAssignee && showSupplier
              ? detailWorkspace.orderDetailControlGrid
              : "grid min-w-0 grid-cols-1 items-stretch gap-2 sm:gap-3",
            surface !== "dialog" && "lg:col-span-2",
          )}
        >
          {onAssigneeChange ? (
            <OrderAssigneeCard
              order={order}
              options={assigneeOptions}
              pending={assigneePending}
              onChange={onAssigneeChange}
            />
          ) : null}
          {showSupplier ? (
            <OrderPartsSupplierCard
              supplier={partsSupplier}
              suppliers={supplierOptions}
              isUpdating={partsSupplierPending}
              onChange={onPartsSupplierChange}
            />
          ) : null}
        </div>
      ) : null}
      {surface === "dialog" && tabs && activeView && onViewChange ? (
        <div data-order-records-group="true" className="grid min-w-0 content-start gap-2">
          <OrderDetailTabs
            tabs={tabs}
            activeTab={activeView}
            onChange={onViewChange}
            ariaLabel={t("orders2b2.records.aria")}
            idPrefix="order-records-group"
            className="!m-0"
          />
          <section
            id="order-records-group-panel-key-info"
            role="tabpanel"
            aria-labelledby="order-records-group-tab-key-info"
            hidden={activeView !== "key-info"}
          >
            <OrderKeyInfoCard order={order} supplier={supplier} surface={surface} />
          </section>
          <section
            id="order-records-group-panel-messages"
            role="tabpanel"
            aria-labelledby="order-records-group-tab-messages"
            hidden={activeView !== "messages"}
          >
            <OrderMessagesLog messages={messages} />
          </section>
          <section
            id="order-records-group-panel-timeline"
            role="tabpanel"
            aria-labelledby="order-records-group-tab-timeline"
            hidden={activeView !== "timeline"}
          >
            <OrderTimelineLog events={events} workflow={workflow} />
          </section>
        </div>
      ) : (
        <>
          <div className="grid min-w-0 content-start gap-2 sm:gap-3">
            <OrderKeyInfoCard
              order={order}
              supplier={supplier}
              surface={surface}
              className="h-fit"
            />
            <OrderMessagesLog messages={messages} />
          </div>
          <OrderTimelineLog events={events} workflow={workflow} />
        </>
      )}
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
  const { t } = useLocale();
  return (
    <section
      data-order-record-control-card="assignee"
      className={cn(detailWorkspace.densePanel, "flex h-full flex-col")}
    >
      <div className="min-w-0">
        <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <UserRound className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{t("orders2b2.overview.assignee")}</span>
        </h3>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
          {t("orders2b2.records.assigneeHelp")}
        </p>
      </div>
      <div className="mt-auto pt-2">
        <Select
          value={order.assignee_membership_id ?? "unassigned"}
          onValueChange={(value) => onChange(value === "unassigned" ? null : value)}
          disabled={pending}
        >
          <SelectTrigger className="h-8 rounded-md text-xs">
            <SelectValue placeholder={order.technician_name || t("orders2b2.mobile.unassigned")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">{t("orders2b2.mobile.unassigned")}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
  const { t } = useLocale();
  return (
    <section
      data-order-parts-supplier-card="true"
      data-order-record-control-card="supplier"
      className={cn(detailWorkspace.densePanel, "flex h-full flex-col")}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <PackageSearch className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{t("orders2b2.supplier.label")}</span>
          </h3>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.records.supplierHelp")}
          </p>
        </div>
      </div>
      {onChange ? (
        <div className="mt-auto pt-2">
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
        <div className="mt-auto min-w-0 pt-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            <PackageSearch className="size-3 shrink-0" />
            <span className="truncate">{supplier.short_name || supplier.name}</span>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function OrderMessagesLog({ messages }: { messages: OrderDetail["messages"] }) {
  const { locale, t } = useLocale();
  return (
    <section data-order-records-messages="true" className={detailWorkspace.flatPanel}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <MessageCircle className="size-3.5 text-primary" />
          <span className="truncate">{t("orders2b2.overview.notifications")}</span>
        </h3>
        <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground lg:text-[11px] lg:leading-4">
          {messages.length}
        </span>
      </div>
      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] p-3 text-center text-xs text-muted-foreground">
          {t("orders2b2.overview.noNotifications")}
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
                    {localizeOrderMessageChannel(message.channel, t)}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none lg:text-[11px] lg:leading-4",
                    message.status === "read"
                      ? "bg-status-success text-status-success-foreground"
                      : "bg-status-info text-status-info-foreground",
                  )}
                >
                  {localizeOrderMessageStatus(message.status, t)}
                </span>
              </div>
              <p className="line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {message.message_body}
              </p>
              <p className="truncate font-mono text-[10px] leading-3 text-muted-foreground/70 lg:text-[11px] lg:leading-4 lg:text-muted-foreground">
                {formatOrderDateTime(message.sent_at, locale)}
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
  const { locale, t } = useLocale();
  return (
    <section data-order-records-timeline="true" className={detailWorkspace.flatPanel}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <FileText className="size-3.5 text-primary" />
          <span className="truncate">{t("orders2b2.tab.timeline", { count: events.length })}</span>
        </h3>
        <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground lg:text-[11px] lg:leading-4">
          {events.length}
        </span>
      </div>
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-panel)] p-3 text-center text-xs text-muted-foreground">
          {t("orders2b2.overview.noTimeline")}
        </div>
      ) : (
        <ol className="grid min-w-0 gap-1.5">
          {events.map((event, index) => (
            <li
              key={event.id}
              data-order-record-row="true"
              className="grid min-w-0 gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/55 px-2 py-1.5 text-xs sm:grid-cols-[92px_minmax(0,1fr)]"
            >
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground sm:block lg:text-[11px] lg:leading-4">
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
                <span className="font-mono tabular-nums">
                  {formatShortDate(event.created_at, locale)}
                </span>
                <span className="font-mono tabular-nums sm:block">
                  {formatClockTime(event.created_at, locale)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {localizeOrderDetailEvent(event, workflow, t, locale)}
                  </span>
                  <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                    {event.operator_name}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground/70 lg:text-[11px] lg:leading-4 lg:text-muted-foreground">
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
  const { t } = useLocale();
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
              <span className="block text-xs font-semibold">{t("orders2b2.approval.accept")}</span>
              <span className="mt-0.5 block truncate text-[10px] opacity-75 lg:text-xs lg:leading-4 lg:opacity-100">
                {t("orders2b2.approval.acceptHelp")}
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
              <span className="block text-xs font-semibold">{t("orders2b2.approval.reject")}</span>
              <span className="mt-0.5 block truncate text-[10px] opacity-75 lg:text-xs lg:leading-4 lg:opacity-100">
                {t("orders2b2.approval.rejectHelp")}
              </span>
            </button>
          </div>

          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.approval.next")}
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
                  {custodyReady ? (
                    <SelectItem value="repairing">
                      {localizeWorkflowStatusLabel(undefined, "repairing", t)}
                    </SelectItem>
                  ) : null}
                  <SelectItem value="parts_ordered">
                    {localizeWorkflowStatusLabel(undefined, "parts_ordered", t)}
                  </SelectItem>
                  {custodyReady ? (
                    <SelectItem value="mail_in_progress">
                      {localizeWorkflowStatusLabel(undefined, "mail_in_progress", t)}
                    </SelectItem>
                  ) : null}
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
                  {custodyReady ? (
                    <SelectItem value="unfixed_pickup">
                      {localizeWorkflowStatusLabel(undefined, "unfixed_pickup", t)}
                    </SelectItem>
                  ) : null}
                  <SelectItem value="cancelled">
                    {localizeWorkflowStatusLabel(undefined, "cancelled", t)}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </label>
          {!custodyReady ? (
            <p className="rounded-lg border border-status-warn-foreground/25 bg-status-warn/45 px-2.5 py-2 text-[10px] leading-4 text-status-warn-foreground lg:text-xs lg:leading-[18px]">
              {custodyStatus === null
                ? t("orders2b2.approval.custodyUnknown")
                : t("orders2b2.approval.custodyCustomer")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
            {decision === "approved"
              ? t("orders2b2.approval.note")
              : t("orders2b2.approval.rejectReason")}
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
              className="min-h-20 resize-none rounded-lg text-xs lg:min-h-[104px]"
              placeholder={
                decision === "approved"
                  ? t("orders2b2.approval.notePlaceholder")
                  : t("orders2b2.approval.rejectPlaceholder")
              }
            />
          </label>

          <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.approval.auditHelp")}
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
        {t("common.cancel")}
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
        {pending ? t("orders2b2.hero.saving") : t("orders2b2.approval.confirm")}
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
              {t("orders2b2.hero.approval")}
            </DialogTitle>
            <DialogDescription>
              {t("orders2b2.approval.description", { publicNo: order.public_no })}
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
              {t("orders2b2.hero.approval")}
            </SheetTitle>
            <SheetDescription>
              {t("orders2b2.approval.description", { publicNo: order.public_no })}
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
  const { locale, t } = useLocale();
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
      ? t("orders2b2.offline.oldDraft")
      : t("orders2b2.offline.unsavedDraft")
    : state === "saving"
      ? t("orders2b2.offline.saving")
      : state === "saved"
        ? t("orders2b2.offline.saved")
        : state === "unavailable" || state === "error"
          ? t("orders2b2.offline.unavailable")
          : t("orders2b2.offline.draft");
  const description = prompt
    ? prompt.hasConflict
      ? t("orders2b2.offline.conflict")
      : t("orders2b2.offline.restoreHelp")
    : (pendingRestoreNotice ??
      (state === "saved" && lastSavedAt
        ? t("orders2b2.offline.lastSaved", { date: formatDateTime(lastSavedAt, locale) })
        : t("orders2b2.offline.defaultHelp")));
  const unlockNotice = hasSensitiveUnlockDraft ? t("orders2b2.offline.unlockHelp") : null;

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
                {t("orders2b2.offline.restore")}
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
              {t("orders2b2.offline.discard")}
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
  primaryAction,
  onPrint,
  printDisabled,
  printDisabledReason,
  onRevokeCustomerStatusLinks,
  customerStatusRevokePending,
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
  custodyPanel,
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
  primaryAction: OrderDetailPrimaryAction;
  onPrint: () => void;
  printDisabled: boolean;
  printDisabledReason?: string;
  onRevokeCustomerStatusLinks?: () => void;
  customerStatusRevokePending: boolean;
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
  custodyPanel: ReactNode;
  className?: string;
}) {
  const { locale, t } = useLocale();
  const { order, customer } = data;
  const cancelled = isOrderCancelledState(order);
  const isVoided = order.record_state === "voided" || Boolean(order.deleted_at);
  const custodyStatus = deviceCustodyStatusFromOrder(order);
  const events = data.events ?? [];
  const workflowStatus = cancelled ? "closed" : getOrderWorkflowStatus(order);
  const currentStageIndex = getWorkflowProgressValue(workflowStatus);
  const next = cancelled
    ? { primary: undefined, secondary: [] }
    : getWorkflowNextActions(workflow, order.status);
  const phone = customer?.phone_e164 || order.customer_phone;
  const rawCustomerName = (
    order.customer_name_snapshot ||
    customer?.name ||
    order.customer_name ||
    ""
  ).trim();
  const customerDisplayName =
    rawCustomerName && normalizePhoneDigits(rawCustomerName) !== normalizePhoneDigits(phone)
      ? rawCustomerName
      : t("orders2b1.new.lookup.unnamed");
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
  const mobilePhotoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobilePhotoOutsideDismissedRef = useRef(false);
  const handleMobilePhotoCloseAutoFocus = useCallback((event: Event) => {
    if (!mobilePhotoOutsideDismissedRef.current) {
      event.preventDefault();
      mobilePhotoTriggerRef.current?.focus({ preventScroll: true });
    }
    mobilePhotoOutsideDismissedRef.current = false;
  }, []);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [assignmentEditing, setAssignmentEditing] = useState(false);
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
  const hasMobileSupplierManagement = Boolean(
    partsSupplier || supplierOptions.length || onPartsSupplierChange,
  );
  const availableMobileActions = (
    [
      approvalDecisionAvailable ? "approval" : null,
      !whatsappDisabled ? "notify" : null,
      statusActions.length > 0 && !transitionPending ? "flow" : null,
      !paymentDisabled && isOrderPaymentCollectible(order) ? "payment" : null,
    ] as OrderDetailPrimaryAction[]
  ).filter((action): action is Exclude<OrderDetailPrimaryAction, null> => Boolean(action));
  const mobilePrimaryAction =
    primaryAction && availableMobileActions.includes(primaryAction)
      ? primaryAction
      : (availableMobileActions[0] ?? null);
  const mobileDockActions = mobilePrimaryAction
    ? [
        mobilePrimaryAction,
        ...availableMobileActions.filter((action) => action !== mobilePrimaryAction).slice(0, 2),
      ]
    : [];

  const renderMobileDockAction = (
    action: Exclude<OrderDetailPrimaryAction, null>,
    primary: boolean,
  ) => {
    const commonProps = {
      className: cn(
        "h-9 min-w-0 rounded-lg text-xs",
        primary && "flex-[1.25] border-0 text-primary-foreground",
        !primary && "flex-1",
      ),
      style: primary ? ({ background: "var(--gradient-brand)" } as CSSProperties) : undefined,
    };
    if (action === "approval") {
      return (
        <Button key={action} {...commonProps} onClick={onApprovalDecision}>
          <CheckCircle2 className="mr-1 size-3.5" /> {t("orders2b2.overview.approvalAction")}
        </Button>
      );
    }
    if (action === "notify") {
      return (
        <Button
          key={action}
          variant={primary ? "default" : "outline"}
          {...commonProps}
          onClick={onNotify}
        >
          <Send className="mr-1 size-3.5" /> WhatsApp
        </Button>
      );
    }
    if (action === "flow") {
      return (
        <Button
          key={action}
          variant={primary ? "default" : "outline"}
          {...commonProps}
          onClick={() => setStatusSheetOpen(true)}
        >
          <Clock3 className="mr-1 size-3.5" /> {t("orders2b2.overview.flowAction")}
        </Button>
      );
    }
    return (
      <Button
        key={action}
        variant={primary ? "default" : "outline"}
        {...commonProps}
        onClick={onPay}
      >
        <CreditCard className="mr-1 size-3.5" /> {t("orders2b2.overview.collect")}
      </Button>
    );
  };

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
        nextLabel={
          next.primary ? localizeWorkflowStatusLabel(workflow, next.primary.to, t) : undefined
        }
        onHeightChange={handleFloatingHeaderHeight}
        onPrint={onPrint}
        printDisabled={printDisabled}
        printDisabledReason={printDisabledReason}
        onRevokeCustomerStatusLinks={onRevokeCustomerStatusLinks}
        customerStatusRevokePending={customerStatusRevokePending}
        onCancel={onCancel}
        canCancel={canCancel}
      />

      {topNotice}
      {custodyPanel}

      {approvalDecisionAvailable ? (
        <section className={cn(mobileDetailCardClass, "border-primary/25 bg-primary/5")}>
          <MobileSectionTitle icon={MessageCircle} title={t("orders2b2.mobile.approval")} />
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.mobile.approvalHelp")}
          </p>
        </section>
      ) : null}

      <section data-mobile-order-first-card="true" className={mobileDetailCardClass}>
        <MobileSectionTitle icon={Calendar} title={t("orders2b2.mobile.basic")} />
        <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-4">
          <MobileMeta
            icon={Calendar}
            label={t("orders2b2.overview.createdAt")}
            value={formatDateTime(order.created_at, locale)}
          />
          <MobileMeta
            icon={Clock3}
            label={t("orders2b2.overview.statusAt")}
            value={formatDateTime(currentStatusChangedAt, locale)}
          />
          {!(onAssigneeChange || hasMobileSupplierManagement) ? (
            <MobileMeta
              icon={UserRound}
              label={t("orders2b2.overview.assignee")}
              value={order.technician_name || "-"}
            />
          ) : null}
          <MobileMeta
            icon={Store}
            label={t("orders2b2.overview.store")}
            value={storeSettings?.store_name || t("orders2b2.overview.notConfigured")}
          />
        </div>
      </section>

      {onAssigneeChange || hasMobileSupplierManagement ? (
        <section className={mobileDetailCardClass}>
          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
            <MobileSectionTitle icon={UserRound} title={t("orders2b2.mobile.peopleSuppliers")} />
            {onAssigneeChange || onPartsSupplierChange ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg px-3 text-[11px] lg:h-8 lg:text-xs"
                aria-expanded={assignmentEditing}
                onClick={() => setAssignmentEditing((editing) => !editing)}
              >
                {assignmentEditing ? t("orders2b2.mobile.done") : t("orders2b2.mobile.adjust")}
              </Button>
            ) : null}
          </div>
          {!assignmentEditing ? (
            <div className="grid min-w-0 grid-cols-2 gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-2 text-[11px] lg:text-xs lg:leading-4">
              <div className="min-w-0">
                <span className="text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
                  {t("orders2b2.overview.assignee")}
                </span>
                <p className="truncate font-semibold">
                  {order.technician_name || t("orders2b2.mobile.unassigned")}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
                  {t("orders2b2.overview.externalSupplier")}
                </span>
                <p className="truncate font-semibold">
                  {partsSupplier?.short_name ||
                    partsSupplier?.name ||
                    t("orders2b2.overview.notConfigured")}
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "grid min-w-0 gap-1.5",
                onAssigneeChange && hasMobileSupplierManagement
                  ? "grid-cols-1 min-[380px]:grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {onAssigneeChange ? (
                <div className="min-w-0">
                  <MobileSectionTitle icon={UserRound} title={t("orders2b2.overview.assignee")} />
                  <div className="mt-1">
                    <Select
                      value={order.assignee_membership_id ?? "unassigned"}
                      onValueChange={(value) =>
                        onAssigneeChange(value === "unassigned" ? null : value)
                      }
                      disabled={assigneePending}
                    >
                      <SelectTrigger className="h-[38px] min-w-0 rounded-md px-2 text-base lg:h-8 lg:text-xs">
                        <SelectValue
                          placeholder={order.technician_name || t("orders2b2.mobile.unassigned")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          {t("orders2b2.mobile.unassigned")}
                        </SelectItem>
                        {assigneeOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {hasMobileSupplierManagement ? (
                <div className="min-w-0">
                  <MobileSectionTitle
                    icon={PackageSearch}
                    title={t("orders2b2.overview.externalSupplier")}
                  />
                  <div className="mt-1 min-w-0">
                    {onPartsSupplierChange ? (
                      <OrderSupplierPicker
                        supplier={partsSupplier}
                        suppliers={supplierOptions}
                        isUpdating={partsSupplierPending}
                        onChange={onPartsSupplierChange}
                        mode="sheet"
                        size="compact"
                      />
                    ) : partsSupplier ? (
                      <div className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary lg:text-xs lg:leading-4">
                        <PackageSearch className="size-3 shrink-0" />
                        <span className="truncate">
                          {partsSupplier.short_name || partsSupplier.name}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {hasMobileSupplierManagement ? (
            <p className="mt-1 truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
              {t("orders2b2.mobile.supplierScope")}
            </p>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        aria-expanded={timelineOpen}
        aria-controls="mobile-order-timeline"
        aria-haspopup="dialog"
        aria-label={t("orders2b2.mobile.historyCount", { count: events.length })}
        className={cn(
          mobileDetailCardClass,
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left transition-colors active:bg-[var(--surface-panel-muted)]",
        )}
        onClick={() => setTimelineOpen(true)}
      >
        <div className="min-w-0">
          <MobileSectionTitle icon={Clock3} title={t("orders2b2.mobile.history")} />
          <p className="mt-1 truncate text-[11px] font-medium leading-4 lg:text-xs lg:leading-4">
            {latestEvent
              ? localizeOrderDetailEvent(latestEvent, workflow, t, locale)
              : t("orders2b2.mobile.historyEmpty")}
          </p>
          <p className="truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {latestEvent
              ? `${formatDateTime(latestEvent.created_at, locale)} · ${latestEvent.operator_name || t("orders2b2.mobile.system")}`
              : t("orders2b2.mobile.historyHelp")}
          </p>
        </div>
        <span className="rounded-lg border border-[var(--border-panel)] px-2 py-1 text-[10px] font-medium text-primary lg:text-[11px] lg:leading-4">
          {t("orders2b2.mobile.historyAll")}
        </span>
      </button>

      <div className="grid min-w-0 grid-cols-1 gap-1.5 min-[390px]:grid-cols-2">
        <section className={mobileDetailCardClass}>
          <MobileSectionTitle icon={UserRound} title={t("orders2b2.overview.customerInfo")} />
          <div className="mt-1.5 grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-1.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
              {customerDisplayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold leading-4">{customerDisplayName}</p>
              <PhoneText
                value={phone}
                className="block truncate text-[11px] leading-4 lg:text-xs"
              />
            </div>
          </div>
          {customer?.preferred_channel ? (
            <div className="mt-1 flex min-w-0">
              <span className="truncate rounded bg-status-success px-1.5 py-0.5 text-[9px] font-medium leading-3 text-status-success-foreground lg:text-[11px] lg:leading-4">
                {customer.preferred_channel}
              </span>
            </div>
          ) : null}
          <div className="mt-1.5 grid min-w-0 grid-cols-1 gap-1">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 w-full min-w-0 gap-1 overflow-hidden rounded-lg px-1.5 text-[11px] font-semibold [&_svg]:size-3.5 lg:text-xs"
            >
              <a
                href={`tel:${phone}`}
                aria-label={t("orders2b2.mobile.phoneCall")}
                title={t("orders2b2.mobile.phoneCall")}
              >
                <Phone className="shrink-0" />
                <span className="min-w-0 truncate">{t("orders2b2.mobile.phone")}</span>
              </a>
            </Button>
            {onRequestKioskSignature ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2 h-9 w-full min-w-0 gap-1 overflow-hidden rounded-lg px-1.5 text-[11px] font-semibold [&_svg]:size-3.5 lg:text-xs"
                disabled={!kioskSignatureAvailable || kioskSignaturePending}
                onClick={onRequestKioskSignature}
              >
                <TabletSmartphone className="shrink-0" />
                <span className="min-w-0 truncate">
                  {kioskSignaturePending
                    ? t("orders2b2.overview.sending")
                    : kioskSignatureAvailable
                      ? t("orders2b2.overview.sendKiosk")
                      : t("orders2b2.overview.noKiosk")}
                </span>
              </Button>
            ) : null}
          </div>
        </section>

        <section className={mobileDetailCardClass}>
          <MobileSectionTitle
            icon={Smartphone}
            title={t("orders2b2.overview.deviceIssue")}
            action={
              data.capabilities?.canEditIntake || data.capabilities?.canEditRepair ? (
                <div className="flex shrink-0 items-center gap-1">
                  {data.capabilities?.canEditRepair ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 min-w-9 rounded-lg px-2 text-[11px] lg:text-xs"
                      onClick={() => setDeviceUnlockEditing(true)}
                    >
                      {t("orders2b2.unlock.entry")}
                    </Button>
                  ) : null}
                  {data.capabilities?.canEditIntake ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 min-w-9 rounded-lg px-2 text-[11px] lg:text-xs"
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
                [t("orders2b2.overview.warranty"), order.warranty_text || "-"],
                [
                  t("orders2b2.overview.custody"),
                  localizeDeviceCustody(custodyStatus, undefined, t),
                ],
                [t("orders2b2.overview.accessories"), accessoryNotes || "-"],
              ]}
            />
            <DeviceUnlockViewer order={order} compact className="mt-1.5" />
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
          title={t("orders2b2.overview.issue")}
          action={
            data.capabilities?.canEditIntake || data.capabilities?.canEditRepair ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-9 rounded-lg px-2 text-[11px] lg:text-xs"
                onClick={() => setFaultEditing(true)}
              >
                {t("orders2b2.hero.edit")}
              </Button>
            ) : undefined
          }
        />
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs font-medium leading-4 text-foreground">
          {order.issue_description || "-"}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
          {t("orders2b2.overview.diagnosis")}：
          {order.diagnosis_result || t("orders2b2.overview.notConfigured")}
        </p>
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
          <MobileSectionTitle icon={WalletCards} title={t("orders2b2.overview.quotePanel")} />
          <div className="mt-1.5 rounded-lg border border-dashed border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-center text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.overview.financeRestricted")}
          </div>
        </section>
      ) : (
        <div className="grid min-w-0 grid-cols-2 gap-1.5">
          <section
            id="mobile-order-quote"
            className={cn(mobileDetailCardClass, financeEditing && "col-span-2")}
          >
            <MobileSectionTitle
              icon={ReceiptText}
              title={t("orders2b2.overview.quoteItems")}
              action={
                canAdjustFinance ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-9 rounded-lg px-2 text-[11px] lg:text-xs lg:leading-4"
                    onClick={() => onFinanceEditingChange(!financeEditing)}
                  >
                    {financeEditing ? t("orders2b2.mobile.done") : t("orders2b2.hero.edit")}
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
                      className="flex min-w-0 items-center gap-1 text-[11px] leading-4 lg:text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {item.name || t("orders2b2.mobile.unnamedItem")}
                      </span>
                      <MoneyText amount={item.price} className="shrink-0 font-semibold" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[var(--border-panel)] px-1.5 py-2 text-center text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
                    {t("orders2b2.overview.noQuoteItems")}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className={mobileDetailCardClass}>
            <MobileSectionTitle icon={WalletCards} title={t("orders2b2.overview.amountSummary")} />
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

      <section className={mobileDetailCardClass} data-order-detail-content-end="true">
        <MobileSectionTitle icon={ImageIcon} title={t("orders2b2.overview.photos")} />
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {photoAttachments.slice(0, 2).map((attachment) => (
            <PhotoPreview
              key={attachment.id}
              attachment={attachment}
              onOpen={() => setPhotoPreviewId(attachment.id)}
            />
          ))}
          {photoAttachments.length === 0 ? null : photoAttachments.length === 1 ? (
            <PhotoPlaceholder label={t("orders2b2.overview.extraPhoto")} />
          ) : null}
          {data.capabilities?.canUploadPhoto === true && !isVoided ? (
            <button
              type="button"
              className={cn(
                "grid min-h-14 place-items-center rounded-lg border border-dashed border-primary/35 bg-primary/5 text-[10px] font-medium text-primary disabled:opacity-60 lg:text-xs lg:leading-4",
                photoAttachments.length === 0 && "col-span-3 min-h-20",
              )}
              disabled={attachmentUploadPending}
              onClick={(event) => {
                mobilePhotoTriggerRef.current = event.currentTarget;
                mobilePhotoOutsideDismissedRef.current = false;
                setPhotoCaptureOpen(true);
              }}
            >
              <span className="grid place-items-center gap-1">
                <Camera className="size-4" />
                {attachmentUploadPending
                  ? t("orders2b2.overview.uploading")
                  : t("orders2b2.overview.capture")}
              </span>
            </button>
          ) : null}
        </div>
        {photoAttachments.length ? (
          <p className="mt-1 text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("orders2b2.mobile.photoSaved", { count: photoAttachments.length })}
          </p>
        ) : null}
      </section>

      {data.capabilities?.canUploadPhoto === true && !isVoided ? (
        <CameraCaptureSheet
          open={photoCaptureOpen}
          onOpenChange={setPhotoCaptureOpen}
          attachmentKind="fault_photo"
          purpose="order-attachment"
          onOutsideDismiss={() => {
            mobilePhotoOutsideDismissedRef.current = true;
          }}
          onCloseAutoFocus={handleMobilePhotoCloseAutoFocus}
          onCapture={(draft) => {
            void uploadAttachmentDraft(draft, onAttachmentUpload).catch(() => undefined);
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

      {!isVoided && mobileDockActions.length ? (
        <div
          data-mobile-order-action-dock="true"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-panel)] bg-background/95 px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-1.5 shadow-[0_-10px_30px_color-mix(in_oklch,var(--foreground)_10%,transparent)] backdrop-blur-xl lg:!block"
        >
          <div className="mx-auto flex max-w-3xl gap-2">
            {mobileDockActions.map((action) =>
              renderMobileDockAction(action, action === mobilePrimaryAction),
            )}
          </div>
        </div>
      ) : null}

      <MobileStatusTransitionSheet
        open={statusSheetOpen}
        order={order}
        workflow={workflow}
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
  const { locale, t } = useLocale();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="mobile-order-timeline"
        side="bottom"
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4 text-primary" />
              {t("orders2b2.mobile.history")}
            </SheetTitle>
            <SheetDescription>{t("orders2b2.mobile.historyHelp")}</SheetDescription>
          </SheetHeader>
          <div className={cn(componentOverlay.body, "space-y-2 pt-3")}>
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-panel)] px-3 py-6 text-center text-xs text-muted-foreground">
                {t("orders2b2.mobile.historyEmpty")}
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel)] px-3 py-2"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-xs font-semibold leading-5">
                      {localizeOrderDetailEvent(event, workflow, t, locale)}
                    </p>
                    <span className="shrink-0 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4 lg:text-foreground/80">
                      {event.operator_name || t("orders2b2.mobile.system")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
                    {formatDateTime(event.created_at, locale)}
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
  const { t } = useLocale();
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
      const candidates = extractValidImeiCandidates(text, { source: "ocr" });
      setOcrText(candidates.length > 0 ? `已识别到 ${candidates.length} 个有效 IMEI。` : "");
      const candidate = getPreferredValidImeiCandidate(candidates);
      if (!candidate) {
        setError("未自动识别到有效 IMEI。请检查照片清晰度，SN 或 EID 请在对应字段手动输入。");
        return;
      }
      if (candidates.length > 1) {
        setOcrCandidates(candidates);
        setSelectedOcrCandidateId(candidate.id);
        setError(
          candidates.length > 1
            ? "找到多个可能的编号，请选择一个后保存。"
            : "请确认 IMEI 后再填入。",
        );
        return;
      }
      onChange(candidate.value);
      toast.success("已识别并填入 IMEI");
    } catch (error) {
      const message = getOrderDetailSafeErrorMessage(error, "ocr", t);
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
      const message = getOrderDetailSafeErrorMessage(error, "imei", t);
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
              扫描 IMEI
            </SheetTitle>
            <SheetDescription>
              扫码或 OCR 仅识别通过校验的 15 位 IMEI，不识别 SN 或 EID。
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
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
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
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
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
                <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
                  当前入口不显示粘贴按钮；无法识别时可直接手动输入。
                </p>
              </section>
            ) : null}

            {mode === "ocr" ? (
              <section className={cn(componentOverlay.flatSection, "space-y-2 p-2.5")}>
                <div className="grid gap-1">
                  <label className="text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
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
                  <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
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
                          <span className="truncate text-[10px] font-semibold lg:text-[11px] lg:leading-4">
                            {candidate.label}
                          </span>
                          <span className="shrink-0 text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
                            {candidate.confidence === "high" ? "高可信" : "需确认"}
                          </span>
                        </span>
                        <span className="mt-0.5 block break-all font-mono text-[10px] lg:text-[11px] lg:leading-4">
                          {candidate.value}
                        </span>
                        {candidate.reason ? (
                          <span className="mt-0.5 block text-[9px] leading-3 text-status-warn-foreground lg:text-[11px] lg:leading-4">
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
              <p className="rounded-lg bg-status-danger px-2.5 py-2 text-[10px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]">
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
  const { t } = useLocale();
  const [draft, setDraft] = useState<DeviceUnlockInput>(() => deviceUnlockInputFromOrder(order));
  const [error, setError] = useState("");
  const validationError = useMemo(() => {
    try {
      normalizeDeviceUnlockInput(draft);
      return "";
    } catch {
      return getOrderDetailSafeErrorMessage(undefined, "unlock", t);
    }
  }, [draft, t]);
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
      const message = getOrderDetailSafeErrorMessage(error, "unlock", t);
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
            <SheetTitle className="text-sm leading-5">{t("orders2b2.unlock.edit")}</SheetTitle>
            <SheetDescription className="text-[10px] leading-3 lg:text-[11px] lg:leading-4">
              {t("orders2b2.unlock.help", { publicNo: order.public_no })}
            </SheetDescription>
          </SheetHeader>
          <div
            className={cn(componentOverlay.body, "min-h-0 flex-1 space-y-2 overflow-y-auto p-3")}
          >
            <DeviceUnlockEditor value={draft} onChange={setDraft} />
            {helperError ? (
              <p className="rounded-lg bg-status-danger px-2 py-1.5 text-[10px] font-medium leading-3 text-status-danger-foreground lg:text-xs lg:leading-[18px]">
                {helperError}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-t border-[var(--border-panel)] p-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 lg:h-9"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 lg:h-9"
              disabled={pending || Boolean(validationError)}
              onClick={() => void save()}
            >
              {pending ? t("orders2b2.hero.saving") : t("orders2b2.hero.save")}
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
  const { t } = useLocale();
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
      setError(t("orders2b2.validation.issue"));
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
        setError(t("orders2b2.fault.noChanges"));
        return;
      }
      await onSave(changes);
      onOpenChange(false);
    } catch (error) {
      const message = getOrderDetailSafeErrorMessage(error, "diagnosis", t);
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
                  <span className="truncate">{t("orders2b2.fault.edit")}</span>
                </SheetTitle>
                <SheetDescription className="mt-0.5 truncate text-[10px] leading-3 lg:text-[11px] lg:leading-4">
                  {t("orders2b2.fault.projects", {
                    publicNo: order.public_no,
                    count: quoteItems.length,
                  })}
                </SheetDescription>
              </div>
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-primary/15 bg-primary/5 text-center">
                <div className="min-w-0 border-r border-primary/10 px-2 py-1">
                  <p className="text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                    {t("orders2b2.fault.missingIssue")}
                  </p>
                  <p className="font-mono text-xs font-semibold leading-4 text-primary">
                    {missingIssueCount}
                  </p>
                </div>
                <div className="min-w-0 px-2 py-1">
                  <p className="text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                    {t("orders2b2.fault.missingDiagnosis")}
                  </p>
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
                  <p className="text-[10px] font-medium leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                    {t("orders2b2.fault.source")}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] lg:text-[11px] lg:leading-4"
                      disabled={pending || !canEditIntake || missingIssueCount === 0}
                      onClick={() => appendItems("issue", quoteItems)}
                    >
                      {t("orders2b2.fault.allIssue")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] lg:text-[11px] lg:leading-4"
                      disabled={pending || !canEditRepair || missingDiagnosisCount === 0}
                      onClick={() => appendItems("diagnosis", quoteItems)}
                    >
                      {t("orders2b2.fault.allDiagnosis")}
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
                          <p className="truncate text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4">
                            {item.name}
                          </p>
                          <div className="flex min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                            <MoneyText amount={item.price} className="shrink-0" />
                            {item.note ? <span className="truncate">{item.note}</span> : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] lg:text-[11px] lg:leading-4"
                          disabled={pending || !canEditIntake || inIssue}
                          aria-label={t("orders2b2.fault.addIssue", { name: item.name })}
                          onClick={() => appendItems("issue", [item])}
                        >
                          {inIssue ? t("orders2b2.fault.issueAdded") : t("orders2b2.fault.issue")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] lg:text-[11px] lg:leading-4"
                          disabled={pending || !canEditRepair || inDiagnosis}
                          aria-label={t("orders2b2.fault.addDiagnosis", { name: item.name })}
                          onClick={() => appendItems("diagnosis", [item])}
                        >
                          {inDiagnosis
                            ? t("orders2b2.fault.diagnosisAdded")
                            : t("orders2b2.fault.diagnosis")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className={cn(componentOverlay.flatSection, "p-2")}>
                <p className="grid rounded-lg border border-dashed border-[var(--border-panel)] px-2 py-3 text-center text-[10px] leading-4 text-muted-foreground md:min-h-40 md:place-items-center lg:text-xs lg:leading-4">
                  {t("orders2b2.fault.empty")}
                </p>
              </section>
            )}

            <section className={cn(componentOverlay.flatSection, "space-y-2 p-2")}>
              <label className="grid gap-1 text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
                <span className="flex items-center justify-between gap-2">
                  <span>
                    {t("orders2b2.overview.issue")}
                    {canEditIntake ? "" : t("orders2b2.fault.readonly")}
                  </span>
                  <span className="font-mono text-[9px] font-normal text-muted-foreground lg:text-[11px] lg:leading-4">
                    {issue.trim().length}
                  </span>
                </span>
                <Textarea
                  value={issue}
                  onChange={(event) => setIssue(event.target.value)}
                  disabled={pending || !canEditIntake}
                  className="min-h-24 resize-none rounded-lg text-xs md:min-h-[230px]"
                  placeholder={t("orders2b2.fault.issuePlaceholder")}
                />
              </label>
              <label className="grid gap-1 text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
                <span className="flex items-center justify-between gap-2">
                  <span>
                    {t("orders2b2.overview.diagnosis")}
                    {canEditRepair ? "" : t("orders2b2.fault.readonly")}
                  </span>
                  <span className="font-mono text-[9px] font-normal text-muted-foreground lg:text-[11px] lg:leading-4">
                    {diagnosis.trim().length}
                  </span>
                </span>
                <Textarea
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  disabled={pending || !canEditRepair}
                  className="min-h-20 resize-none rounded-lg text-xs md:min-h-[180px]"
                  placeholder={t("orders2b2.fault.diagnosisPlaceholder")}
                />
              </label>
            </section>

            {error ? (
              <p className="rounded-lg bg-status-danger px-2.5 py-2 text-[10px] leading-4 text-status-danger-foreground md:col-span-2 lg:text-xs lg:leading-[18px]">
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
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 text-xs sm:h-8"
              disabled={pending}
              onClick={() => void save()}
            >
              {pending ? t("orders2b2.hero.saving") : t("orders2b2.hero.save")}
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
  const { t } = useLocale();
  const source = attachment.signed_url || attachment.public_url;
  const label = localizeOrderAttachmentKind(attachment.kind, t);

  if (!source) {
    return (
      <div className="relative h-14 overflow-hidden rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]">
        <div className="grid size-full place-items-center text-primary">
          <ImageIcon className="size-4" />
        </div>
        <span className="absolute inset-x-1 bottom-1 rounded bg-background/85 px-1 py-0.5 text-center text-[8px] font-medium leading-3 text-muted-foreground backdrop-blur lg:text-[11px] lg:leading-4">
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
      aria-label={t("orders2b2.overview.openPhoto", { file: attachment.file_name || label })}
    >
      <img src={source} alt={attachment.file_name || label} className="size-full object-cover" />
      <span className="absolute inset-0 hidden place-items-center bg-background/20 text-[9px] font-semibold text-foreground backdrop-blur-[1px] group-hover:grid group-focus-visible:grid lg:text-[11px] lg:leading-4">
        {t("orders2b2.overview.view")}
      </span>
      <span className="absolute inset-x-1 bottom-1 rounded bg-background/85 px-1 py-0.5 text-center text-[8px] font-medium leading-3 text-muted-foreground backdrop-blur lg:text-[11px] lg:leading-4">
        {label} · {formatAttachmentSize(attachment.file_size)}
      </span>
    </button>
  );
}

function DesktopStatusTransitionPanel({
  order,
  workflow,
  statusLabel,
  currentStage,
  actions,
  pending,
  onOpenChange,
  onTransition,
}: {
  order: OrderDetail["order"];
  workflow?: OrderWorkflow;
  statusLabel: string;
  currentStage: OrderTaskStage;
  actions: WorkflowTransitionAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  const { t } = useLocale();
  const stageLabel = localizeOrderFlowStage(currentStage, t).label;
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-card/95 p-2.5 shadow-sm">
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <Clock3 className="size-4 shrink-0 text-primary" />
            <span className="truncate">{t("orders2b2.transition.title")}</span>
          </h3>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.transition.currentHelp", { stage: stageLabel, status: statusLabel })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg"
          disabled={pending}
          onClick={() => onOpenChange(false)}
          aria-label={t("orders2b2.transition.collapse")}
        >
          <X className="size-4" />
        </Button>
      </header>
      <StatusTransitionPanelBody
        open
        order={order}
        workflow={workflow}
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
  workflow,
  statusLabel,
  currentStage,
  actions,
  pending,
  onOpenChange,
  onTransition,
}: {
  open: boolean;
  order: OrderDetail["order"];
  workflow?: OrderWorkflow;
  statusLabel: string;
  currentStage: OrderTaskStage;
  actions: WorkflowTransitionAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  const { t } = useLocale();
  const stageLabel = localizeOrderFlowStage(currentStage, t).label;
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
              <p className="text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                {t("orders2b2.transition.currentOrder")}
              </p>
              <p className="truncate font-mono text-xs font-semibold leading-4 text-primary">
                {order.public_no}
              </p>
            </div>
            <StatusBadge status={order.status} label={statusLabel} />
          </div>
          <div className="rounded-lg bg-[var(--surface-panel)] px-2 py-1.5">
            <p className="text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
              {t("orders2b2.transition.currentStage")}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold">{stageLabel}</p>
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
            {reasonAction
              ? reasonAction.to === "completed" &&
                deviceCustodyStatusFromOrder(order) === DEVICE_CUSTODY_WITH_CUSTOMER
                ? order.delivered_at
                  ? t("orders2b2.transition.adminDelivered")
                  : t("orders2b2.transition.adminCustomer")
                : t("orders2b2.transition.preparing", {
                    status: localizeWorkflowStatusLabel(workflow, reasonAction.to, t),
                  })
              : t("orders2b2.transition.help")}
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
                {t("orders2b2.custody.back")}
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
                {t("orders2b2.transition.confirm")}
              </Button>
            </div>
          </section>
        ) : (
          <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-1.5 lg:space-y-0 xl:grid-cols-3">
            {actions.length ? (
              actions.map((action, index) => {
                const hint = getStatusActionHint(action.to, order, t);
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
                          {statusLabel} → {localizeWorkflowStatusLabel(workflow, action.to, t)}
                        </span>
                        {action.isPrimary ? (
                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-primary lg:text-[11px] lg:leading-4">
                            {t("orders2b2.transition.recommended")}
                          </span>
                        ) : null}
                        {needsReason ? (
                          <span className="shrink-0 rounded bg-status-warn px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-status-warn-foreground lg:text-[11px] lg:leading-4">
                            {t("orders2b2.transition.reason")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                        {hint}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-4 text-center text-xs text-muted-foreground lg:col-span-2 xl:col-span-3">
                {t("orders2b2.transition.empty")}
              </div>
            )}
          </div>
        )}
      </div>

      {hasCommunicationStatus && !reasonAction ? (
        <p className="rounded-lg bg-status-warn px-2.5 py-2 text-[10px] leading-4 text-status-warn-foreground lg:text-xs lg:leading-[18px]">
          {t("orders2b2.transition.communication")}
        </p>
      ) : null}
    </div>
  );
}

function MobileStatusTransitionSheet({
  open,
  order,
  workflow,
  statusLabel,
  currentStage,
  actions,
  pending,
  onOpenChange,
  onTransition,
}: {
  open: boolean;
  order: OrderDetail["order"];
  workflow?: OrderWorkflow;
  statusLabel: string;
  currentStage: OrderTaskStage;
  actions: WorkflowTransitionAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  const { t } = useLocale();
  const stageLabel = localizeOrderFlowStage(currentStage, t).label;
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
              {t("orders2b2.transition.title")}
            </SheetTitle>
            <SheetDescription>
              {t("orders2b2.transition.currentHelp", { stage: stageLabel, status: statusLabel })}
            </SheetDescription>
          </SheetHeader>
          <StatusTransitionPanelBody
            open={open}
            order={order}
            workflow={workflow}
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
  printDisabled,
  printDisabledReason,
  onRevokeCustomerStatusLinks,
  customerStatusRevokePending,
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
  printDisabled: boolean;
  printDisabledReason?: string;
  onRevokeCustomerStatusLinks?: () => void;
  customerStatusRevokePending: boolean;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromOrdersList = searchParams.get("from") === "orders";
  const shellRef = useRef<HTMLDivElement | null>(null);
  const cancelled = isOrderCancelledState(order);
  const localizedCurrentStage = localizeOrderFlowStage(currentStage, t);
  const statusLabel = localizeWorkflowStatusLabel(
    workflow,
    cancelled ? "cancelled" : order.status,
    t,
  );
  const nextText = nextLabel
    ? `${t("orders2b2.hero.next")}：${nextLabel}`
    : localizedCurrentStage.nextAction;
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
      className={cn(repairOs.mobileFloatingHeaderShell, "lg:!block")}
    >
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button asChild variant="ghost" size="iconDense" className="size-9 rounded-lg">
            <Link
              href="/orders"
              aria-label={t("orders2b2.backOrdersAria")}
              onClick={(event) => {
                if (!openedFromOrdersList) return;
                event.preventDefault();
                router.replace("/orders");
              }}
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold leading-4">{t("orders2b2.title")}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              aria-label={
                printDisabled
                  ? (printDisabledReason ?? t("orders2b2.hero.printUnavailable"))
                  : t("orders2b2.hero.print")
              }
              title={
                printDisabled
                  ? (printDisabledReason ?? t("orders2b2.hero.printUnavailable"))
                  : t("orders2b2.hero.print")
              }
              disabled={printDisabled}
              onClick={onPrint}
            >
              <Printer className="size-[18px]" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg"
                  aria-label={t("orders2b2.hero.more")}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onRevokeCustomerStatusLinks ? (
                  <DropdownMenuItem
                    disabled={customerStatusRevokePending}
                    onClick={onRevokeCustomerStatusLinks}
                  >
                    <ScanLine className="mr-2 size-3.5" />
                    {t(
                      customerStatusRevokePending
                        ? "orders2b2.hero.resettingQr"
                        : "orders2b2.hero.resetQr",
                    )}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={!canCancel}
                  onClick={onCancel}
                >
                  {t(canCancel ? "orders2b2.hero.cancelOrder" : "orders2b2.hero.cancelUnavailable")}
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
              <p className="truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                {localizedCurrentStage.label} · {nextText}
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
                  label={localizeOrderDetailBadge(badge, t)}
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
    <div
      data-mobile-section-title="true"
      className="flex min-w-0 flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-1">
        <Icon className="mt-0.5 size-3 shrink-0 text-primary" />
        <h2
          data-mobile-section-title-text="true"
          className="min-w-0 whitespace-normal break-words text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4"
        >
          {title}
        </h2>
      </div>
      {action ? (
        <div
          data-mobile-section-title-action="true"
          className="flex shrink-0 self-end sm:self-auto"
        >
          {action}
        </div>
      ) : null}
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
      <div className="flex items-center gap-1 text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-[11px] font-medium leading-4 lg:text-xs lg:leading-4">
        {value}
      </p>
    </div>
  );
}

function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-1.5 grid min-w-0 gap-1 text-[11px] leading-4 lg:text-xs lg:leading-4">
      {rows.map(([label, value]) => (
        <div
          key={label}
          data-order-detail-row="true"
          className="grid min-w-0 grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-[minmax(96px,0.35fr)_minmax(0,1fr)]"
        >
          <dt
            data-order-detail-row-label="true"
            className="min-w-0 whitespace-normal break-words text-muted-foreground"
          >
            {label}
          </dt>
          <dd
            data-order-detail-row-value="true"
            className="min-w-0 whitespace-pre-wrap break-words font-medium"
          >
            {value}
          </dd>
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
  const { t } = useLocale();
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
            ...(item.line_id ? { line_id: item.line_id } : {}),
            ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
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
        <p className="mb-1 text-[10px] font-semibold leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
          {t("orders2b2.finance.select")}
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
            <div
              key={item.line_id ?? index}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_74px_24px] gap-1"
            >
              <MobileDenseFinanceInput
                value={item.name}
                onValueChange={(value) =>
                  patchFault(index, { name: value, catalog_key: undefined })
                }
                disabled={pending}
                placeholder={t("orders2b2.finance.item")}
              />
              <MobileDenseFinanceInput
                value={item.priceText}
                onValueChange={(value) => patchFault(index, { priceText: value })}
                disabled={pending}
                placeholder={t("orders2b2.finance.amount")}
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
                aria-label={t("orders2b2.overview.deleteItem")}
              >
                <Trash2 className="size-3 text-muted-foreground" />
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-[var(--border-panel)] px-2 py-2 text-center text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
            {t("orders2b2.overview.noQuoteItems")}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-full rounded-md text-[10px] lg:text-[11px] lg:leading-4"
        disabled={pending}
        onClick={() => {
          const faults = [...draft.faults, emptyFinanceFaultDraft()];
          onChange({ ...draft, faults });
        }}
      >
        <Plus className="mr-1 size-3" /> {t("orders2b2.finance.add")}
      </Button>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_86px] items-end gap-1.5">
        <div className="grid grid-cols-2 gap-1 text-[10px] lg:text-[11px] lg:leading-4">
          <div className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1">
            <span className="block text-muted-foreground">{t("orders2b2.finance.total")}</span>
            <MoneyText amount={normalized.quotation} className="font-semibold text-primary" />
          </div>
          <div className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1">
            <span className="block text-muted-foreground">{t("orders2b2.finance.balance")}</span>
            <MoneyText amount={normalized.balance} className="font-semibold" />
          </div>
        </div>
        <label className="grid min-w-0 gap-0.5 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
          <span>{t("orders2b2.finance.deposit")}</span>
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
        <p className="rounded-md bg-status-danger px-2 py-1 text-[10px] leading-3 text-status-danger-foreground lg:text-xs lg:leading-[18px]">
          {normalized.error ? t("orders2b2.validation.checkOrder") : saveError}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-md text-[10px] lg:text-[11px] lg:leading-4"
          onClick={onCancel}
          disabled={pending}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-md text-[10px] lg:text-[11px] lg:leading-4"
          onClick={() => void onSave().catch(() => undefined)}
          disabled={pending || !normalized.canSave}
        >
          <Save className="mr-1 size-3" /> {t("orders2b2.hero.save")}
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

function getStatusActionHint(
  status: RepairOrderStatus,
  order: OrderDetail["order"] | undefined,
  t: ReturnType<typeof useLocale>["t"],
) {
  if (status === "waiting_approval") return t("orders2b2.transition.hint.waiting");
  if (status === "notified") return t("orders2b2.transition.hint.notified");
  if (status === "mail_in_progress") return t("orders2b2.transition.hint.mail");
  if (status === "parts_ordered") return t("orders2b2.transition.hint.partsOrdered");
  if (status === "parts_arrived") return t("orders2b2.transition.hint.partsArrived");
  if (status === "unfixed_pickup") return t("orders2b2.transition.hint.unfixed");
  if (status === "rework") return t("orders2b2.transition.hint.rework");
  if (status === "cancelled") return t("orders2b2.transition.hint.cancelled");
  if (status === "completed") {
    return order && deviceCustodyStatusFromOrder(order) === DEVICE_CUSTODY_WITH_CUSTOMER
      ? order.delivered_at
        ? t("orders2b2.transition.adminDelivered")
        : t("orders2b2.transition.adminCustomer")
      : t("orders2b2.transition.hint.completed");
  }
  return t("orders2b2.transition.hint.default");
}

function mergeSelectedFaultsIntoFinanceDraft(
  draft: FinanceDraftState,
  selected: ReturnType<typeof normalizeFaultPrices>,
): FinanceDraftState {
  const existingByLineId = new Map(
    draft.faults.flatMap((item) => (item.line_id ? [[item.line_id, item] as const] : [])),
  );
  const existingByName = new Map(draft.faults.map((item) => [item.name, item]));
  return {
    ...draft,
    faults: toFaultPriceItems(selected).map((item) => {
      const existing =
        (item.line_id ? existingByLineId.get(item.line_id) : undefined) ??
        existingByName.get(item.name);
      const price = Number(item.price);
      return {
        ...(item.line_id ? { line_id: item.line_id } : {}),
        ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
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
  const { t } = useLocale();
  const hasBalance = balance > 0;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)} data-mobile-payment-summary="true">
      <div className="rounded-lg border border-primary/15 bg-primary/5 px-2 py-1.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="shrink-0 text-[10px] font-semibold leading-4 text-primary lg:text-[11px] lg:leading-4">
            {t("orders2b2.finance.total")}
          </span>
          <MoneyText
            amount={total}
            className="min-w-0 text-right font-mono text-lg font-bold leading-6 text-foreground"
          />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <MobilePaymentTile
          label={t("orders2b2.finance.depositPaid")}
          amount={deposit}
          valueClassName={deposit > 0 ? "text-status-success-foreground" : undefined}
        />
        <MobilePaymentTile
          label={cancelled ? t("orders2b2.finance.cancelBalance") : t("orders2b2.finance.due")}
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
        <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          {t("orders2b2.finance.cancelledHelp")}
        </p>
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
      <div className="truncate text-[10px] font-medium leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
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
  const { locale, t } = useLocale();
  const stageGridStyle = {
    gridTemplateColumns: `repeat(${orderTaskStages.length}, minmax(0, 1fr))`,
  };

  return (
    <div className={cn("grid min-w-0 gap-0.5", compact ? "mt-1" : "mt-4")} style={stageGridStyle}>
      {orderTaskStages.map((stage, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const displayStage = localizeOrderFlowStage(current ? (currentStage ?? stage) : stage, t);
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
                compact
                  ? "mt-0.5 text-[8px] leading-3 lg:text-[11px] lg:leading-4"
                  : "mt-1 text-[10px] lg:text-[11px] lg:leading-4",
                current ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {displayStage.label}
            </p>
            {!compact ? (
              <p className="truncate text-[9px] text-muted-foreground/70 lg:text-[11px] lg:leading-4 lg:text-muted-foreground">
                {index === 0
                  ? formatShortDate(createdAt, locale)
                  : current
                    ? t("orders2b2.hero.current")
                    : ""}
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
    <div className="grid h-14 place-items-center rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-center text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
      <span className="grid place-items-center gap-0.5">
        <ImageIcon className="size-3.5 opacity-70" />
        {label}
      </span>
    </div>
  );
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDateTime(value: string, locale: ReturnType<typeof useLocale>["locale"]) {
  return formatOrderDateTime(value, locale);
}

function formatShortDate(value: string, locale: ReturnType<typeof useLocale>["locale"]) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return formatOrderDateTime(value, locale);
  return date.toLocaleDateString(locale, {
    timeZone: "Europe/Rome",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatClockTime(value: string, locale: ReturnType<typeof useLocale>["locale"]) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return formatOrderDateTime(value, locale);
  return date.toLocaleTimeString(locale, {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEditValidationError(
  draft: UpdateOrderInput | null,
  {
    routineChanges,
    financeChanged,
    financeError,
    defaultWarrantyMonths = 6,
  }: {
    routineChanges: PatchOrderChanges;
    financeChanged: boolean;
    financeError?: string;
    defaultWarrantyMonths?: number;
  },
  t: ReturnType<typeof useLocale>["t"],
): string | undefined {
  if (!draft) return t("orders2b2.validation.missingDraft");
  if (routineChanges.customer_name !== undefined && !draft.customer_name.trim()) {
    return t("orders2b2.validation.customerName");
  }
  if (routineChanges.customer_phone !== undefined && !draft.customer_phone.trim()) {
    return t("orders2b2.validation.phone");
  }
  if (
    (routineChanges.device_brand !== undefined || routineChanges.device_model !== undefined) &&
    (!draft.device_brand.trim() || !draft.device_model.trim())
  ) {
    return t("orders2b2.validation.device");
  }
  if (routineChanges.issue_description !== undefined && !draft.issue_description.trim()) {
    return t("orders2b2.validation.issue");
  }
  if (
    (routineChanges.warranty_text !== undefined ||
      routineChanges.warranty_months !== undefined ||
      routineChanges.warranty_change_reason !== undefined) &&
    warrantyReasonRequired(draft.warranty_months ?? defaultWarrantyMonths, defaultWarrantyMonths) &&
    !draft.warranty_change_reason?.trim()
  ) {
    return t("orders2b2.validation.warrantyReason");
  }
  return financeChanged ? financeError : undefined;
}
