"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOrder,
  getStoreSettings,
  listOrderWorkflow,
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
  normalizeFinanceDraft,
  type FinanceDraftState,
} from "@/features/orders/model/order-finance-draft";
import { warrantyReasonRequired } from "@/features/orders/model/order-warranty";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { formatMoney } from "@/lib/money";
import { ordersKeys } from "@/features/orders/api/query-keys";
import {
  getWorkflowNextActions,
  getWorkflowStatusLabel,
} from "@/features/orders/model/order-workflow";
import { fadeUp, stagger } from "@/lib/motion";
import { detailWorkspace } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview", label: "概览" },
  { key: "records", label: "记录" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

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
  const [orderUrl, setOrderUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<UpdateOrderInput | null>(null);
  const [activeEditField, setActiveEditField] = useState<OrderEditableField | null>(null);
  const [financeDraft, setFinanceDraft] = useState<FinanceDraftState>(() =>
    createFinanceDraftState([], 0),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
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
    queryClient.invalidateQueries({ queryKey: ["order", id] });
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
      const draft = buildEditForm(data, defaultWarrantyMonths);
      return updateOrder(id, { ...draft, device_imei: imei });
    },
    onSuccess: () => {
      toast.success("IMEI / 序列号已保存");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approval = useMutation({
    mutationFn: (body: string) => sendApprovalRequest(id, body),
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
    }) => sendWhatsappNotification(id, input.body, input.templateKind, input.transitionTo),
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

  const editValidationError = useMemo(
    () => getEditValidationError(editDraft, editFinance?.error, defaultWarrantyMonths),
    [defaultWarrantyMonths, editDraft, editFinance?.error],
  );
  const editCanSave = Boolean(editDraft && editFinance?.canSave && !editValidationError);

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
      <div
        className={cn(
          surface === "dialog" && "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-4",
        )}
      >
        <div
          className={cn(
            surface === "page" && "max-md:h-[130px]",
            surface === "page" && isEditing && "max-md:h-[164px]",
          )}
        >
          <OrderHero
            order={order}
            customerName={customer?.name}
            deviceLabel={deviceLabel}
            next={next}
            workflow={workflow}
            transitionPending={transition.isPending}
            onTransition={(to) => transition.mutate({ to })}
            onNotify={() => setNotifyOpen(true)}
            onPrint={() => window.print()}
            onCancel={() => setCancelOpen(true)}
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

                  <Card className="min-w-0 overflow-hidden p-3 sm:p-4">
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
                      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground sm:p-6">
                        暂无通知记录
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {messages.map((m) => (
                          <li
                            key={m.id}
                            className="min-w-0 rounded-md border bg-surface-muted/40 p-2.5 text-xs sm:p-3"
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
                  </Card>

                  <Card className="min-w-0 overflow-hidden p-3 sm:p-4">
                    <h3 className="mb-2 text-sm font-semibold sm:mb-3">时间线</h3>
                    {events.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground sm:p-6">
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
                              className="absolute -left-[26px] top-1 grid size-4 place-items-center rounded-full ring-4 ring-background transition-shadow group-hover:shadow-[0_0_0_6px_oklch(0.7_0.2_285_/_0.18)]"
                              style={{
                                background:
                                  idx === 0 ? "var(--gradient-brand)" : "oklch(0.7 0.2 285 / 0.6)",
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
                  </Card>
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

        <NotifyDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          data={data}
          workflow={workflow}
          orderUrl={orderUrl}
          busy={whatsappNotification.isPending}
          onConfirm={(input) => whatsappNotification.mutateAsync(input)}
        />
        <ApprovalRequestDialog
          open={approvalOpen}
          onOpenChange={setApprovalOpen}
          data={data}
          orderUrl={orderUrl}
          busy={approval.isPending}
          onConfirm={(body) => approval.mutateAsync(body)}
        />
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          balance={order.balance_amount}
          onPay={async (amount, method) => {
            await recordPayment(id, amount, method);
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
        <RepairOrderPrintSheet data={data} orderUrl={orderUrl} />
      </div>
    </div>
  );
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
    case "status_changed":
      return `状态变更：${label(payload.from)} → ${label(payload.to)}`;
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
