"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  Phone,
  Plus,
  ReceiptText,
  Save,
  ScanLine,
  Send,
  Smartphone,
  Store,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";

import { ImeiScannerField } from "@/components/imei-scanner-field";
import { MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import {
  FaultDiagnosisPicker,
  normalizeFaultPrices,
  toFaultPriceItems,
} from "@/components/orders/fault-diagnosis-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOrder,
  getStoreSettings,
  listOrderWorkflow,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
  updateOrder,
  type UpdateOrderInput,
} from "@/lib/repairdesk/api";
import { RepairOrderPrintSheet } from "@/features/orders/components/repair-order-print-sheet";
import { OrderDetailTabs } from "@/features/orders/components/order-detail-tabs";
import { OrderHero } from "@/features/orders/components/order-hero";
import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import {
  OrderFinanceDock,
  OrderKeyInfoCard,
  OrderOverviewTab,
  type OrderEditableField,
} from "@/features/orders/components/order-overview-tab";
import { ApprovalRequestDialog } from "@/features/orders/forms/approval-request-dialog";
import { CancelDialog } from "@/features/orders/forms/cancel-dialog";
import { NotifyDialog } from "@/features/orders/forms/notify-dialog";
import { PaymentDialog } from "@/features/orders/forms/payment-dialog";
import { buildEditForm, inferOrderPaidAmount } from "@/features/orders/model/edit-order-form";
import {
  createFinanceDraftState,
  emptyFinanceFaultDraft,
  normalizeFinanceDraft,
  type FinanceDraftState,
} from "@/features/orders/model/order-finance-draft";
import {
  getDefaultOrderTransitionReason,
  getOrderTransitionReasonConfig,
} from "@/features/orders/model/order-transition-reasons";
import { warrantyReasonRequired } from "@/features/orders/model/order-warranty";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { componentOverlay } from "@/lib/component-patterns";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { formatMoney } from "@/lib/money";
import { ordersKeys } from "@/features/orders/api/query-keys";
import {
  getWorkflowNextActions,
  getWorkflowStatusLabel,
} from "@/features/orders/model/order-workflow";
import {
  getOrderWorkflowStatus,
  getWorkflowProgressValue,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";
import { fadeUp, stagger } from "@/lib/motion";
import { detailWorkspace, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import type { OrderDetail, OrderWorkflow, StoreSettings } from "@/lib/repairdesk/types";

const tabs = [
  { key: "overview", label: "概览" },
  { key: "records", label: "记录" },
] as const;

type TabKey = (typeof tabs)[number]["key"];
type WorkflowNextAction = NonNullable<ReturnType<typeof getWorkflowNextActions>["primary"]>;

export function OrderDetailScreen({
  id,
  surface = "page",
}: {
  id: string;
  surface?: "page" | "dialog";
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [desktopTransitionOpen, setDesktopTransitionOpen] = useState(false);
  const [orderUrl, setOrderUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<UpdateOrderInput | null>(null);
  const [activeEditField, setActiveEditField] = useState<OrderEditableField | null>(null);
  const [mobileFinanceEditing, setMobileFinanceEditing] = useState(false);
  const [mobileFinanceSaveError, setMobileFinanceSaveError] = useState("");
  const [financeDraft, setFinanceDraft] = useState<FinanceDraftState>(() =>
    createFinanceDraftState([], 0),
  );

  useEffect(() => {
    document.body.dataset.orderDetailActive = "true";
    document.body.dataset.mobileWorkspaceActive = "true";
    return () => {
      delete document.body.dataset.orderDetailActive;
      delete document.body.dataset.mobileWorkspaceActive;
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ordersKeys.detail(id),
    queryFn: () => getOrder(id),
  });
  const { data: storeSettings } = useQuery({
    queryKey: messageSettingsKeys.store,
    queryFn: getStoreSettings,
    staleTime: 30_000,
  });
  const { data: workflow } = useQuery({
    queryKey: ordersKeys.workflow(),
    queryFn: () => listOrderWorkflow(),
    staleTime: 60_000,
  });
  const defaultWarrantyMonths = storeSettings?.default_order_warranty_months ?? 6;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ordersKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order-stats"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customer-detail"] });
  }, [id, queryClient]);

  useEffect(() => {
    setOrderUrl(window.location.href);
  }, [id]);

  const transition = useMutation({
    mutationFn: (vars: { to: RepairOrderStatus; reason?: string }) =>
      transitionOrder(id, vars.to, { reason: vars.reason }),
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${getWorkflowStatusLabel(workflow, vars.to)}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orderUpdate = useMutation({
    mutationFn: (input: UpdateOrderInput) => updateOrder(id, input),
    onSuccess: () => {
      toast.success("工单信息已保存");
      setIsEditing(false);
      setEditDraft(null);
      setActiveEditField(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickImeiUpdate = useMutation({
    mutationFn: (imei: string) => {
      if (!data) throw new Error("工单未加载");
      return patchOrder(id, {
        expected_updated_at: data.order.updated_at,
        changes: { device_imei: imei },
      });
    },
    onSuccess: () => {
      toast.success("IMEI / 序列号已保存");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
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
      setApprovalOpen(false);
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

  const editFinance = useMemo(() => {
    if (!data || !editDraft) return null;
    return normalizeFinanceDraft(financeDraft, inferOrderPaidAmount(data.order));
  }, [data, editDraft, financeDraft]);
  const mobileFinance = useMemo(() => {
    if (!data) return null;
    return normalizeFinanceDraft(financeDraft, inferOrderPaidAmount(data.order));
  }, [data, financeDraft]);

  const editValidationError = useMemo(
    () => getEditValidationError(editDraft, editFinance?.error, defaultWarrantyMonths),
    [defaultWarrantyMonths, editDraft, editFinance?.error],
  );
  const editCanSave = Boolean(editDraft && editFinance?.canSave && !editValidationError);

  useEffect(() => {
    if (!data || isEditing || mobileFinanceEditing) return;
    setFinanceDraft(createFinanceDraftState(data.order.fault_prices, data.order.deposit_amount));
  }, [data, isEditing, mobileFinanceEditing]);

  const startEditing = useCallback(() => {
    if (!data) return;
    const draft = buildEditForm(data, defaultWarrantyMonths);
    setEditDraft(draft);
    setFinanceDraft(createFinanceDraftState(draft.fault_prices, draft.deposit_amount ?? 0));
    setIsEditing(true);
    setActiveEditField(null);
    setTab("overview");
  }, [data, defaultWarrantyMonths]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditDraft(null);
    setActiveEditField(null);
    if (data) {
      const draft = buildEditForm(data, defaultWarrantyMonths);
      setFinanceDraft(createFinanceDraftState(draft.fault_prices, draft.deposit_amount ?? 0));
    }
  }, [data, defaultWarrantyMonths]);

  const saveEditing = useCallback(async () => {
    if (!editDraft || !editFinance) return;
    const validationError = getEditValidationError(
      editDraft,
      editFinance.error,
      defaultWarrantyMonths,
    );
    if (validationError || !editFinance.canSave) {
      toast.error(validationError ?? editFinance.error ?? "请检查工单信息。");
      return;
    }
    await orderUpdate.mutateAsync({
      ...editDraft,
      fault_prices: editFinance.faultPrices,
      deposit_amount: editFinance.deposit,
    });
  }, [defaultWarrantyMonths, editDraft, editFinance, orderUpdate]);

  if (isLoading || !data) {
    return (
      <div
        className={cn(
          "min-w-0 max-w-full space-y-3 overflow-x-clip",
          surface === "page"
            ? "mx-auto w-full max-w-5xl px-2.5 pb-28 pt-0 sm:px-4 sm:pb-32 md:px-6"
            : cn(detailWorkspace.root, "flex h-full flex-col p-2 sm:p-3"),
        )}
      >
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }
  const { order, customer, device, supplier, events, messages } = data;
  const next = getWorkflowNextActions(workflow, order.status);
  const desktopWorkflowStatus = getOrderWorkflowStatus(order);
  const desktopStageIndex = getWorkflowProgressValue(desktopWorkflowStatus);
  const desktopCurrentStage =
    orderTaskStages[Math.min(desktopStageIndex, orderTaskStages.length - 1)] ?? orderTaskStages[0];
  const desktopStatusActions = [next.primary, ...next.secondary].filter(
    (action): action is NonNullable<typeof next.primary> => Boolean(action),
  );
  const canCancelOrder = desktopStatusActions.some((action) => action.to === "cancelled");
  const deviceBrand = order.device_snapshot?.brand || device?.brand || "";
  const deviceModel = order.device_snapshot?.model || device?.model || "";
  const deviceLabel = `${deviceBrand} ${deviceModel}`.trim() || order.device_label;
  const deviceImei =
    order.device_snapshot?.serial_or_imei || order.device_imei || device?.serial_or_imei || "";
  const deviceNotes = order.device_snapshot?.device_notes || device?.device_notes;
  const accessoryNotes = order.accessory_notes;

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-x-clip",
        surface === "page"
          ? "mx-auto w-full max-w-5xl px-2.5 pb-28 pt-0 sm:px-4 sm:pb-32 md:px-6"
          : cn(detailWorkspace.root, "flex h-full flex-col"),
      )}
    >
      {surface === "page" ? (
        <MobileOrderDetailView
          data={data}
          deviceLabel={deviceLabel}
          deviceImei={deviceImei}
          deviceNotes={deviceNotes}
          accessoryNotes={accessoryNotes}
          storeSettings={storeSettings}
          workflow={workflow}
          transitionPending={transition.isPending}
          onTransition={(to, reason) => transition.mutate({ to, reason })}
          onImeiSave={async (imei) => {
            await quickImeiUpdate.mutateAsync(imei);
          }}
          imeiPending={quickImeiUpdate.isPending}
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
          onNotify={() => setNotifyOpen(true)}
          whatsappDisabled={mobileFinanceEditing || financeUpdate.isPending}
          onPay={() => setPayOpen(true)}
          onEdit={startEditing}
          onPrint={() => window.print()}
          onCancel={() => setCancelOpen(true)}
          canCancel={canCancelOrder}
          className="md:hidden"
        />
      ) : null}
      <div
        className={cn(
          surface === "page" && "hidden md:block",
          surface === "dialog" && "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-4",
        )}
      >
        <div className="relative z-20">
          <OrderHero
            order={order}
            customerName={customer?.name}
            deviceLabel={deviceLabel}
            next={next}
            workflow={workflow}
            transitionPending={transition.isPending}
            onTransition={(to) => transition.mutate({ to })}
            onOpenTransitionSheet={() => setDesktopTransitionOpen(true)}
            onNotify={() => setNotifyOpen(true)}
            onPrint={() => window.print()}
            onCancel={() => setCancelOpen(true)}
            canCancel={canCancelOrder}
            onEdit={startEditing}
            onSaveEdit={() => void saveEditing()}
            onCancelEdit={cancelEditing}
            isEditing={isEditing}
            editPending={orderUpdate.isPending}
            editSaveDisabled={!editCanSave}
            showBackLink={surface === "page"}
            surface={surface}
          />
        </div>

        <OrderDetailTabs tabs={tabs} activeTab={tab} onChange={setTab} />

        <div className={cn("min-w-0", surface === "dialog" && "min-h-0 flex-1 overflow-y-auto")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              variants={stagger(0.05)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -4 }}
              className={cn("min-w-0 space-y-2 sm:space-y-3", surface === "dialog" && "min-h-full")}
            >
              {tab === "overview" && (
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
                  activeEditField={activeEditField}
                  onActiveEditFieldChange={setActiveEditField}
                  defaultWarrantyMonths={defaultWarrantyMonths}
                  onQuickImeiSave={async (imei) => {
                    await quickImeiUpdate.mutateAsync(imei);
                  }}
                  quickImeiPending={quickImeiUpdate.isPending}
                  surface={surface}
                />
              )}

              {tab === "records" && (
                <motion.div variants={fadeUp} className="min-w-0 space-y-2 sm:space-y-3">
                  <OrderKeyInfoCard order={order} supplier={supplier} surface={surface} />

                  <section className={detailWorkspace.flatPanel}>
                    <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:mb-3">
                      <h3 className="text-sm font-semibold">通知历史</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setNotifyOpen(true)}
                      >
                        <MessageCircle className="size-3" /> 发送通知
                      </Button>
                    </div>
                    {messages.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--border-panel)] p-4 text-center text-xs text-muted-foreground">
                        暂无通知记录
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {messages.map((m) => (
                          <li
                            key={m.id}
                            className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5 text-xs"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <span className="font-medium">
                                {m.channel === "whatsapp" ? "WhatsApp" : "短信"}
                              </span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px]",
                                  m.status === "read"
                                    ? "bg-status-success text-status-success-foreground"
                                    : "bg-status-info text-status-info-foreground",
                                )}
                              >
                                {m.status === "read" ? "已读" : m.status}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                              {m.message_body}
                            </p>
                            <p className="mt-2 text-[10px] text-muted-foreground/70">
                              {new Date(m.sent_at).toLocaleString("zh-CN")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className={detailWorkspace.flatPanel}>
                    <h3 className="mb-2 text-sm font-semibold sm:mb-3">时间线</h3>
                    {events.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--border-panel)] p-4 text-center text-xs text-muted-foreground">
                        暂无时间线记录
                      </div>
                    ) : (
                      <ol className="relative min-w-0 space-y-3 border-l border-border/60 pl-4 sm:space-y-4 sm:pl-5">
                        {events.map((e, idx) => (
                          <motion.li
                            key={e.id}
                            variants={fadeUp}
                            className="group relative min-w-0"
                          >
                            <span
                              className="absolute -left-[26px] top-1 grid size-4 place-items-center rounded-full ring-4 ring-background transition-shadow group-hover:shadow-[0_0_0_6px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
                              style={{
                                background:
                                  idx === 0 ? "var(--gradient-brand)" : "var(--brand-marker-muted)",
                              }}
                            />
                            <div className="break-words text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleString("zh-CN")} · {e.operator_name}
                            </div>
                            <div className="break-words text-sm">
                              {renderEvent(e.event_type, e.payload, workflow)}
                            </div>
                          </motion.li>
                        ))}
                      </ol>
                    )}
                  </section>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <OrderFinanceDock
          order={order}
          isEditing={isEditing}
          financeDraft={financeDraft}
          onFinanceDraftChange={setFinanceDraft}
          editError={editValidationError}
          onApproval={() => setApprovalOpen(true)}
          onPay={() => setPayOpen(true)}
          onNotify={() => setNotifyOpen(true)}
          onPrint={() => window.print()}
          surface={surface}
        />
      </div>

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
      <ApprovalRequestDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        data={data}
        orderUrl={orderUrl}
        busy={approval.isPending}
        onConfirm={(input) => approval.mutateAsync(input)}
      />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        balance={order.balance_amount}
        onPay={async (amount, method) => {
          await recordPayment(id, amount, method, order.updated_at);
          toast.success(`已收款 ${formatMoney(amount)}`);
          invalidate();
        }}
      />
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={async (reason) => {
          await transition.mutateAsync({ to: "cancelled", reason });
        }}
      />
      <MobileStatusTransitionSheet
        open={desktopTransitionOpen}
        order={order}
        statusLabel={getWorkflowStatusLabel(workflow, order.status)}
        currentStage={desktopCurrentStage}
        actions={desktopStatusActions}
        pending={transition.isPending}
        onOpenChange={setDesktopTransitionOpen}
        onTransition={(to, reason) => transition.mutate({ to, reason })}
      />
      <RepairOrderPrintSheet data={data} orderUrl={orderUrl} />
    </div>
  );
}

function MobileOrderDetailView({
  data,
  deviceLabel,
  deviceImei,
  deviceNotes,
  accessoryNotes,
  storeSettings,
  workflow,
  transitionPending,
  onTransition,
  onImeiSave,
  imeiPending,
  financeDraft,
  financeEditing,
  financeSaveError,
  onFinanceEditingChange,
  onFinanceDraftChange,
  onFinanceSave,
  financePending,
  onNotify,
  whatsappDisabled,
  onPay,
  onEdit,
  onPrint,
  onCancel,
  canCancel,
  className,
}: {
  data: OrderDetail;
  deviceLabel: string;
  deviceImei: string;
  deviceNotes?: string;
  accessoryNotes?: string;
  storeSettings?: StoreSettings;
  workflow?: OrderWorkflow;
  transitionPending: boolean;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
  onImeiSave: (imei: string) => Promise<void>;
  imeiPending: boolean;
  financeDraft: FinanceDraftState;
  financeEditing: boolean;
  financeSaveError: string;
  onFinanceEditingChange: (editing: boolean) => void;
  onFinanceDraftChange: (draft: FinanceDraftState) => void;
  onFinanceSave: () => Promise<boolean>;
  financePending: boolean;
  onNotify: () => void;
  whatsappDisabled: boolean;
  onPay: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onCancel: () => void;
  canCancel: boolean;
  className?: string;
}) {
  const { order, customer, events } = data;
  const workflowStatus = getOrderWorkflowStatus(order);
  const currentStageIndex = getWorkflowProgressValue(workflowStatus);
  const next = getWorkflowNextActions(workflow, order.status);
  const phone = customer?.phone_e164 || order.customer_phone;
  const rawCustomerName = (customer?.name || order.customer_name || "").trim();
  const customerDisplayName =
    rawCustomerName && normalizePhoneDigits(rawCustomerName) !== normalizePhoneDigits(phone)
      ? rawCustomerName
      : "未命名客户";
  const whatsappHref = getWhatsappHref(phone);
  const paidAmount = inferOrderPaidAmount(order);
  const latestEvent = events[0];
  const currentStage =
    orderTaskStages[Math.min(currentStageIndex, orderTaskStages.length - 1)] ?? orderTaskStages[0];
  const [imeiEditing, setImeiEditing] = useState(false);
  const [imeiDraft, setImeiDraft] = useState(deviceImei);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const normalizedFinance = useMemo(
    () => normalizeFinanceDraft(financeDraft, paidAmount),
    [financeDraft, paidAmount],
  );
  const statusActions = [next.primary, ...next.secondary].filter(
    (action): action is NonNullable<typeof next.primary> => Boolean(action),
  );

  useEffect(() => {
    if (!imeiEditing) setImeiDraft(deviceImei);
  }, [deviceImei, imeiEditing]);

  return (
    <div className={cn(repairOs.mobileFloatingPage, className)}>
      <MobileStickyWorkflowHeader
        order={order}
        workflow={workflow}
        currentStageIndex={currentStageIndex}
        currentStage={currentStage}
        nextLabel={next.primary?.label}
        onEdit={onEdit}
        onNotify={onNotify}
        onPrint={onPrint}
        onCancel={onCancel}
        canCancel={canCancel}
      />

      <section className={mobileDetailCardClass}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-[9px] leading-3 text-muted-foreground">订单号</p>
            <p className="truncate font-mono text-sm font-semibold leading-5 text-primary">
              {order.public_no}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[9px] leading-3 text-muted-foreground">总额</p>
            <MoneyText
              amount={order.quotation_amount}
              className="block text-sm font-semibold leading-5"
            />
            <p className="text-[9px] leading-3 text-muted-foreground">
              {order.is_paid ? "已结清" : `尾款 ${formatMoney(order.balance_amount)}`}
            </p>
          </div>
        </div>
        <div className="mt-1.5 grid min-w-0 grid-cols-3 gap-1 border-t border-[var(--border-panel)] pt-1.5">
          <MobileMeta icon={Calendar} label="创建时间" value={formatDateTime(order.created_at)} />
          <MobileMeta icon={UserRound} label="负责人" value={order.technician_name || "-"} />
          <MobileMeta icon={Store} label="门店" value={storeSettings?.store_name || "ChinaTech"} />
        </div>
      </section>

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
          </div>
        </section>

        <section className={mobileDetailCardClass}>
          <MobileSectionTitle
            icon={Smartphone}
            title="设备信息"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-3 text-[11px]"
                onClick={() => {
                  setImeiDraft(deviceImei);
                  setImeiEditing(true);
                }}
              >
                <ScanLine className="mr-1 size-4" />
                扫码
              </Button>
            }
          />
          <div className="mt-1.5 min-w-0">
            <p className="truncate text-xs font-semibold leading-4">{deviceLabel}</p>
            <DetailRows
              rows={[
                ["IMEI", deviceImei || "-"],
                ["质保", order.warranty_text || "-"],
                ["留存", accessoryNotes || "-"],
              ]}
            />
          </div>
          {deviceNotes ? (
            <p className="mt-1 line-clamp-1 rounded-md bg-[var(--surface-panel-muted)] px-1.5 py-0.5 text-[10px] leading-3 text-muted-foreground">
              {deviceNotes}
            </p>
          ) : null}
        </section>
      </div>

      <Sheet
        open={imeiEditing}
        onOpenChange={(open) => {
          setImeiEditing(open);
          if (open) setImeiDraft(deviceImei);
        }}
      >
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
                扫码、粘贴或手动输入，保存后会写入当前工单设备信息。
              </SheetDescription>
            </SheetHeader>
            <div className={cn(componentOverlay.body, "space-y-3 pt-3")}>
              <div
                className={cn(
                  componentOverlay.flatSection,
                  imeiPending && "pointer-events-none opacity-60",
                )}
              >
                <ImeiScannerField
                  value={imeiDraft}
                  onChange={setImeiDraft}
                  placeholder="扫描或输入 IMEI"
                  density="compact"
                />
              </div>
              <SheetFooter className={componentOverlay.footer}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={imeiPending}
                  onClick={() => {
                    setImeiDraft(deviceImei);
                    setImeiEditing(false);
                  }}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={imeiPending}
                  onClick={async () => {
                    try {
                      await onImeiSave(imeiDraft);
                      setImeiEditing(false);
                    } catch {
                      // Mutation error toast is handled by the parent mutation.
                    }
                  }}
                >
                  保存
                </Button>
              </SheetFooter>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <section className={mobileDetailCardClass}>
        <MobileSectionTitle icon={FileText} title="故障描述" />
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs font-medium leading-4 text-foreground">
          {order.issue_description || "-"}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
          诊断结果：{order.diagnosis_result || "尚未填写"}
        </p>
      </section>

      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <section className={cn(mobileDetailCardClass, financeEditing && "col-span-2")}>
          <MobileSectionTitle
            icon={ReceiptText}
            title="维修项目与报价"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 rounded-md px-1.5 text-[10px]"
                onClick={() => onFinanceEditingChange(!financeEditing)}
              >
                {financeEditing ? "收起" : "编辑"}
              </Button>
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
            <>
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
              <div className="mt-1.5 border-t border-[var(--border-panel)] pt-1.5">
                <div className="flex items-center justify-between gap-1.5 text-[11px]">
                  <span className="font-semibold">应收总额</span>
                  <MoneyText
                    amount={order.quotation_amount}
                    className="shrink-0 text-sm font-semibold text-primary"
                  />
                </div>
              </div>
            </>
          )}
        </section>

        <section className={mobileDetailCardClass}>
          <MobileSectionTitle icon={WalletCards} title="支付信息" />
          <div className="mt-1.5 space-y-1">
            <PaymentLine
              label="付款状态"
              value={order.is_paid ? "已结清" : order.deposit_amount > 0 ? "已付押金" : "未收款"}
              strong
            />
            <PaymentLine label="已付金额" value={formatMoney(paidAmount)} />
            <PaymentLine label="押金" value={formatMoney(order.deposit_amount)} />
            <PaymentLine
              label="尾款金额"
              value={formatMoney(order.balance_amount)}
              danger={order.balance_amount > 0}
            />
            <PaymentLine
              label="最近记录"
              value={latestEvent ? formatDateTime(latestEvent.created_at) : "-"}
            />
          </div>
        </section>
      </div>

      <section className={mobileDetailCardClass}>
        <MobileSectionTitle icon={ImageIcon} title="设备照片" />
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <PhotoPlaceholder label="正面" />
          <PhotoPlaceholder label="背面" />
          <button
            type="button"
            className="grid h-14 place-items-center rounded-lg border border-dashed border-primary/35 bg-primary/5 text-[10px] font-medium text-primary"
            onClick={onEdit}
          >
            <span className="grid place-items-center gap-1">
              <Camera className="size-4" />
              添加备注
            </span>
          </button>
        </div>
      </section>

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
            disabled={statusActions.length === 0 || transitionPending}
            onClick={() => setStatusSheetOpen(true)}
          >
            <Clock3 className="mr-1 size-3.5" /> 流转
          </Button>
          <Button variant="outline" className="h-9 rounded-xl text-xs" onClick={onPay}>
            <CreditCard className="mr-1 size-3.5" /> 收款
          </Button>
        </div>
      </div>

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
  currentStage: (typeof orderTaskStages)[number];
  actions: WorkflowNextAction[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTransition: (to: RepairOrderStatus, reason?: string) => void;
}) {
  const hasCommunicationStatus = actions.some((action) => isCommunicationStatus(action.to));
  const [reasonAction, setReasonAction] = useState<WorkflowNextAction | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const reasonConfig = reasonAction ? getOrderTransitionReasonConfig(reasonAction.to) : undefined;
  const canConfirmReason = !reasonConfig?.required || Boolean(reasonDraft.trim());

  useEffect(() => {
    if (!open) {
      setReasonAction(null);
      setReasonDraft("");
    }
  }, [open]);

  const chooseAction = (action: WorkflowNextAction) => {
    const config = getOrderTransitionReasonConfig(action.to);
    if (config) {
      setReasonAction(action);
      setReasonDraft(getDefaultOrderTransitionReason(action.to));
      return;
    }
    onOpenChange(false);
    onTransition(action.to);
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
              <Clock3 className="size-4 text-primary" />
              状态流转
            </SheetTitle>
            <SheetDescription>
              当前：{currentStage.label} · {statusLabel}。选择下一步后会写入时间线。
            </SheetDescription>
          </SheetHeader>
          <div className={cn(componentOverlay.body, "space-y-2 pt-3")}>
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
              <p className="text-[10px] leading-4 text-muted-foreground">
                {reasonAction
                  ? `准备流转为「${reasonAction.label}」，确认后会写入状态时间线。`
                  : "状态流转只改变工单进度；需要给客户发送报价或取机通知时，请使用底部 WhatsApp 通知入口。"}
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
              <div className="space-y-1.5">
                {actions.length ? (
                  actions.map((action, index) => {
                    const hint = getStatusActionHint(action.to);
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
                  <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-4 text-center text-xs text-muted-foreground">
                    当前状态暂无可用流转。
                  </div>
                )}
              </div>
            )}

            {hasCommunicationStatus && !reasonAction ? (
              <p className="rounded-lg bg-status-warn px-2.5 py-2 text-[10px] leading-4 text-status-warn-foreground">
                提醒：选择“待审批”或“已通知”只会改状态，不会自动发送
                WhatsApp。需要发送给客户时请走通知入口。
              </p>
            ) : null}
          </div>
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
  onEdit,
  onNotify,
  onPrint,
  onCancel,
  canCancel,
}: {
  order: OrderDetail["order"];
  workflow?: OrderWorkflow;
  currentStageIndex: number;
  currentStage: (typeof orderTaskStages)[number];
  nextLabel?: string;
  onEdit: () => void;
  onNotify: () => void;
  onPrint: () => void;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const statusLabel = getWorkflowStatusLabel(workflow, order.status);
  const nextText = nextLabel ? `下一步：${nextLabel}` : currentStage.nextAction;

  return (
    <div className={repairOs.mobileFloatingHeaderShell}>
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <Button asChild variant="ghost" size="icon" className="size-7 rounded-lg">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg"
                aria-label="更多操作"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>编辑工单</DropdownMenuItem>
              <DropdownMenuItem onClick={onPrint}>打印工单</DropdownMenuItem>
              <DropdownMenuItem onClick={onNotify}>通知客户</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={!canCancel}
                onClick={onCancel}
              >
                {canCancel ? "取消工单" : "当前状态不可取消"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <StatusBadge status={order.status} label={statusLabel} className="mt-0.5 scale-90" />
          </div>
          <div className="mt-1 border-t border-[var(--border-panel)] pt-1">
            <MobileWorkflowTimeline
              compact
              currentIndex={currentStageIndex}
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
        />
      </div>

      <div className="space-y-1">
        {draft.faults.length ? (
          draft.faults.map((item, index) => (
            <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px_24px] gap-1">
              <Input
                value={item.name}
                onChange={(event) => patchFault(index, { name: event.target.value })}
                disabled={pending}
                className="h-7 min-w-0 rounded-md px-2 text-[11px]"
                placeholder="项目"
              />
              <Input
                type="text"
                inputMode="decimal"
                value={item.priceText}
                onChange={(event) => patchFault(index, { priceText: event.target.value })}
                disabled={pending}
                className="h-7 min-w-0 rounded-md px-2 text-right font-mono text-[11px]"
                placeholder="金额"
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
        onClick={() => onChange({ ...draft, faults: [...draft.faults, emptyFinanceFaultDraft()] })}
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
        <label className="min-w-0 text-[10px] text-muted-foreground">
          押金
          <Input
            type="text"
            inputMode="decimal"
            value={draft.depositText}
            onChange={(event) => onChange({ ...draft, depositText: event.target.value })}
            disabled={pending}
            className="mt-0.5 h-7 min-w-0 rounded-md px-2 text-right font-mono text-[11px]"
            placeholder="0"
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
          disabled={pending}
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

function isCommunicationStatus(status: RepairOrderStatus) {
  return status === "waiting_approval" || status === "notified";
}

function getStatusActionHint(status: RepairOrderStatus) {
  if (status === "waiting_approval") return "进入客户审批阶段；不会自动发送报价消息。";
  if (status === "notified") return "标记客户已通知；不会自动发送取机消息。";
  if (status === "parts_ordered") return "记录为已订配件，后续可流转到配件到货。";
  if (status === "parts_arrived") return "记录为配件已到，下一步通常进入维修。";
  if (status === "unfixed_pickup") return "用于无法维修但客户取回设备的情况。";
  if (status === "rework") return "从结案或未修取机回到返修流程。";
  if (status === "cancelled") return "需要填写取消原因后才能完成取消。";
  if (status === "completed") return "完成交付并归档当前工单。";
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

function PaymentLine({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1 text-[11px] leading-4">
      <span className="truncate text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 font-mono tabular-nums",
          strong &&
            "rounded bg-status-warn px-1 py-0.5 text-[10px] font-semibold leading-3 text-status-warn-foreground",
          danger && "font-semibold text-status-danger-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MobileWorkflowTimeline({
  currentIndex,
  createdAt,
  compact = false,
}: {
  currentIndex: number;
  createdAt: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-7 gap-0.5", compact ? "mt-1" : "mt-4")}>
      {orderTaskStages.map((stage, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
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
              {done ? <Check className={compact ? "size-2.5" : "size-3.5"} /> : stage.shortLabel}
            </span>
            <p
              className={cn(
                "truncate",
                compact ? "mt-0.5 text-[8px] leading-3" : "mt-1 text-[10px]",
                current ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {stage.label}
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
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
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
    case "approval_result":
      return `客户审批${payload.result === "approved" ? "通过" : "拒绝"}`;
    case "payment":
      return `收款 ${formatMoney(Number(payload.amount ?? 0))}（${payload.method}）`;
    case "message_sent":
      return payload.status_changed
        ? `已发送 WhatsApp 通知并流转：${label(payload.from)} → ${label(payload.to)}`
        : "已发送 WhatsApp 通知";
    case "note":
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
      return "备注";
    default:
      return type;
  }
}

function getEditValidationError(
  draft: UpdateOrderInput | null,
  financeError?: string,
  defaultWarrantyMonths = 6,
): string | undefined {
  if (!draft) return "缺少工单草稿。";
  if (!draft.customer_name.trim()) return "客户姓名不能为空。";
  if (!draft.customer_phone.trim()) return "手机号不能为空。";
  if (!draft.device_brand.trim()) return "设备品牌不能为空。";
  if (!draft.device_model.trim()) return "设备型号不能为空。";
  if (!draft.issue_description.trim()) return "故障描述不能为空。";
  if (
    warrantyReasonRequired(draft.warranty_months ?? defaultWarrantyMonths, defaultWarrantyMonths) &&
    !draft.warranty_change_reason?.trim()
  ) {
    return "非默认质保需要填写原因。";
  }
  return financeError;
}
