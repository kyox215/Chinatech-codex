"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOrder,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
  type PatchOrderFinanceInput,
  type PatchOrderInput,
} from "@/lib/repairdesk/api";
import { RepairOrderPrintSheet } from "@/features/orders/components/repair-order-print-sheet";
import { OrderDetailTabs } from "@/features/orders/components/order-detail-tabs";
import { OrderHero } from "@/features/orders/components/order-hero";
import {
  OrderKeyInfoCard,
  OrderOverviewTab,
} from "@/features/orders/components/order-overview-tab";
import { ApprovalRequestDialog } from "@/features/orders/forms/approval-request-dialog";
import { CancelDialog } from "@/features/orders/forms/cancel-dialog";
import { NotifyDialog } from "@/features/orders/forms/notify-dialog";
import { PaymentDialog } from "@/features/orders/forms/payment-dialog";
import { statusMeta, type RepairOrderStatus } from "@/lib/mock/enums";
import { formatMoney } from "@/lib/money";
import { getNextActions } from "@/lib/mock/workflow";
import { fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview", label: "概览" },
  { key: "records", label: "记录" },
  { key: "assets", label: "附件库存" },
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
  const latestUpdatedAtRef = useRef("");
  const patchQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

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

  useEffect(() => {
    if (data?.order.updated_at) latestUpdatedAtRef.current = data.order.updated_at;
  }, [data?.order.updated_at]);

  const transition = useMutation({
    mutationFn: (vars: { to: RepairOrderStatus; reason?: string }) =>
      transitionOrder(id, vars.to, { reason: vars.reason }),
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${statusMeta[vars.to].label}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: (input: PatchOrderInput) => patchOrder(id, input),
    onError: (e: Error) => toast.error(e.message),
  });

  const financePatch = useMutation({
    mutationFn: (input: PatchOrderFinanceInput) => patchOrderFinance(id, input),
    onSuccess: () => {
      toast.success("财务已更新");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchFields = useCallback(
    (changes: PatchOrderInput["changes"]) => {
      const run = async () => {
        const result = await patch.mutateAsync({
          expected_updated_at: latestUpdatedAtRef.current,
          changes,
        });
        latestUpdatedAtRef.current = result.updated_at;
        invalidate();
        return result;
      };
      const next = patchQueueRef.current.then(run, run);
      patchQueueRef.current = next.catch(() => undefined);
      return next;
    },
    [patch, invalidate],
  );

  const patchFinance = useCallback(
    async (input: Omit<PatchOrderFinanceInput, "expected_updated_at">) => {
      const result = await financePatch.mutateAsync({
        ...input,
        expected_updated_at: latestUpdatedAtRef.current,
      });
      latestUpdatedAtRef.current = result.updated_at;
      return result;
    },
    [financePatch],
  );

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
          "min-w-0 max-w-full space-y-3 overflow-x-hidden",
          surface === "page"
            ? "mx-auto w-full max-w-5xl px-2.5 pb-10 pt-3 sm:px-4 sm:pb-12 sm:pt-4 md:px-6"
            : "w-full px-2 py-2 sm:px-4 sm:py-3",
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
        "min-w-0 max-w-full overflow-x-hidden",
        surface === "page"
          ? "mx-auto w-full max-w-5xl px-2.5 pb-10 pt-3 sm:px-4 sm:pb-12 sm:pt-4 md:px-6"
          : "w-full px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3 md:px-5",
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
          className="min-w-0 space-y-2 sm:space-y-3"
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
              onPatch={patchFields}
              onFinanceSave={patchFinance}
              financeBusy={financePatch.isPending}
              onApproval={() => setApprovalOpen(true)}
              onPay={() => setPayOpen(true)}
              onNotify={() => setNotifyOpen(true)}
              onPrint={() => window.print()}
            />
          )}

          {tab === "records" && (
            <motion.div variants={fadeUp} className="min-w-0 space-y-2 sm:space-y-3">
              <OrderKeyInfoCard order={order} supplier={supplier} />

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
                      <motion.li key={e.id} variants={fadeUp} className="group relative min-w-0">
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
                          {renderEvent(e.event_type, e.payload)}
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                )}
              </Card>
            </motion.div>
          )}

          {tab === "assets" && (
            <motion.div variants={fadeUp}>
              <Card className="min-w-0 overflow-hidden p-3 sm:p-4">
                <h3 className="mb-3 text-sm font-semibold">附件库存</h3>
                <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
                  <section className="min-w-0 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground sm:p-6">
                    <div className="font-medium text-foreground">附件</div>
                    <p className="mt-1">附件功能即将上线。</p>
                  </section>
                  <section className="min-w-0 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground sm:p-6">
                    <div className="font-medium text-foreground">库存关联</div>
                    <p className="mt-1">暂无与该工单关联的库存记录。</p>
                  </section>
                </div>
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
      if (payload.action === "order_updated") return "工单信息已更新";
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
