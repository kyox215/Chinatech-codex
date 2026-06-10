"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOrder,
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
import { OrderOverviewTab } from "@/features/orders/components/order-overview-tab";
import { ApprovalRequestDialog } from "@/features/orders/forms/approval-request-dialog";
import { CancelDialog } from "@/features/orders/forms/cancel-dialog";
import { EditOrderDialog } from "@/features/orders/forms/edit-order-dialog";
import { NotifyDialog } from "@/features/orders/forms/notify-dialog";
import { PaymentDialog } from "@/features/orders/forms/payment-dialog";
import { statusMeta, type RepairOrderStatus } from "@/lib/mock/enums";
import { formatMoney } from "@/lib/money";
import { getNextActions } from "@/lib/mock/workflow";
import { fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview", label: "概览" },
  { key: "timeline", label: "时间线" },
  { key: "messages", label: "通知" },
  { key: "attachments", label: "附件" },
  { key: "inventory", label: "库存关联" },
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
  const [editOpen, setEditOpen] = useState(false);
  const [orderUrl, setOrderUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order-stats"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customer-detail"] });
  };

  useEffect(() => {
    setOrderUrl(window.location.href);
  }, [id]);

  const transition = useMutation({
    mutationFn: (vars: { to: RepairOrderStatus; reason?: string }) =>
      transitionOrder(id, vars.to, { reason: vars.reason }),
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${statusMeta[vars.to].label}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: UpdateOrderInput) => updateOrder(id, input),
    onSuccess: () => {
      toast.success("工单已更新");
      setEditOpen(false);
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
          ? `WhatsApp 已记录，并已流转为「${statusMeta[result.to].label}」`
          : "WhatsApp 通知已记录",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div
        className={cn(
          "space-y-3",
          surface === "page" ? "mx-auto max-w-4xl px-4 pb-12 pt-4 md:px-6" : "p-4",
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
  const next = getNextActions(order.status);
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
        surface === "page" ? "mx-auto max-w-4xl px-4 pb-12 pt-4 md:px-6" : "px-4 pb-4 pt-3 md:px-5",
      )}
    >
      <OrderHero
        order={order}
        customerName={customer?.name}
        deviceLabel={deviceLabel}
        next={next}
        transitionPending={transition.isPending}
        onTransition={(to) => transition.mutate({ to })}
        onNotify={() => setNotifyOpen(true)}
        onPay={() => setPayOpen(true)}
        onPrint={() => window.print()}
        onCancel={() => setCancelOpen(true)}
        showBackLink={surface === "page"}
      />

      <OrderDetailTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          variants={stagger(0.05)}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: -4 }}
          className="space-y-4"
        >
          {tab === "overview" && (
            <OrderOverviewTab
              order={order}
              customer={customer}
              supplier={supplier}
              deviceLabel={deviceLabel}
              deviceImei={deviceImei}
              deviceNotes={deviceNotes}
              accessoryNotes={accessoryNotes}
              onEdit={() => setEditOpen(true)}
              onApproval={() => setApprovalOpen(true)}
              onPay={() => setPayOpen(true)}
            />
          )}

          {tab === "timeline" && (
            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold">时间线</h3>
                <ol className="relative space-y-5 border-l border-border/60 pl-5">
                  {events.map((e, idx) => (
                    <motion.li key={e.id} variants={fadeUp} className="group relative">
                      <span
                        className="absolute -left-[26px] top-1 grid size-4 place-items-center rounded-full ring-4 ring-background transition-shadow group-hover:shadow-[0_0_0_6px_oklch(0.7_0.2_285_/_0.18)]"
                        style={{
                          background:
                            idx === 0 ? "var(--gradient-brand)" : "oklch(0.7 0.2 285 / 0.6)",
                        }}
                      />
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("zh-CN")} · {e.operator_name}
                      </div>
                      <div className="text-sm">{renderEvent(e.event_type, e.payload)}</div>
                    </motion.li>
                  ))}
                </ol>
              </Card>
            </motion.div>
          )}

          {tab === "messages" && (
            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
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
                  <div className="rounded-md border border-dashed p-8 text-center text-xs text-muted-foreground">
                    暂无通知记录
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((m) => (
                      <li key={m.id} className="rounded-md border bg-surface-muted/40 p-3 text-xs">
                        <div className="flex items-center justify-between">
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
                        <p className="mt-1 text-muted-foreground">{m.message_body}</p>
                        <p className="mt-2 text-[10px] text-muted-foreground/70">
                          {new Date(m.sent_at).toLocaleString("zh-CN")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </motion.div>
          )}

          {tab === "attachments" && (
            <motion.div variants={fadeUp}>
              <Card className="p-8 text-center text-sm text-muted-foreground">
                附件功能即将上线。
              </Card>
            </motion.div>
          )}

          {tab === "inventory" && (
            <motion.div variants={fadeUp}>
              <Card className="p-8 text-center text-sm text-muted-foreground">
                暂无与该工单关联的库存记录。
              </Card>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <NotifyDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        data={data}
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
      <EditOrderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        data={data}
        busy={update.isPending}
        onSave={(input) => update.mutateAsync(input)}
      />
      <RepairOrderPrintSheet data={data} orderUrl={orderUrl} />
    </div>
  );
}

function renderEvent(type: string, payload: Record<string, unknown>) {
  switch (type) {
    case "created":
      return "工单创建";
    case "status_changed":
      return `状态变更：${statusMeta[payload.from as keyof typeof statusMeta]?.label ?? payload.from} → ${statusMeta[payload.to as keyof typeof statusMeta]?.label ?? payload.to}`;
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
        ? `已发送 WhatsApp 通知并流转：${statusMeta[payload.from as keyof typeof statusMeta]?.label ?? payload.from} → ${statusMeta[payload.to as keyof typeof statusMeta]?.label ?? payload.to}`
        : "已发送 WhatsApp 通知";
    case "note":
      return payload.action === "order_updated" ? "工单信息已更新" : "备注";
    default:
      return type;
  }
}
