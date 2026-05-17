import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  MessageCircle,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Printer,
  Send,
  Signature,
  Wrench,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import {
  ApprovalBadge,
  MoneyText,
  OrderTypeBadge,
  PhoneText,
  StatusBadge,
} from "@/components/orders/badges";
import { getOrder, recordPayment, sendNotification, transitionOrder } from "@/lib/mock/api";
import { statusMeta, type RepairOrderStatus } from "@/lib/mock/enums";
import { getNextActions } from "@/lib/mock/workflow";
import { fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `工单 ${params.id} — RepairDesk` },
      { name: "description", content: "工单详情、报价、时间线与通知" },
    ],
  }),
  component: OrderDetailPage,
});

const tabs = [
  { key: "overview", label: "概览" },
  { key: "timeline", label: "时间线" },
  { key: "messages", label: "通知" },
  { key: "attachments", label: "附件" },
  { key: "inventory", label: "库存关联" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function OrderDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { scrollY } = useScroll();
  const heroPad = useTransform(scrollY, [0, 120], [24, 10]);
  const heroTitleScale = useTransform(scrollY, [0, 120], [1, 0.86]);
  const subtitleOpacity = useTransform(scrollY, [0, 80], [1, 0]);

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order-stats"] });
  };

  const transition = useMutation({
    mutationFn: (vars: { to: RepairOrderStatus; reason?: string }) =>
      transitionOrder(id, vars.to, { reason: vars.reason }),
    onSuccess: (_r, vars) => {
      toast.success(`已流转为「${statusMeta[vars.to].label}」`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 pb-12 pt-4 md:px-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }
  const { order, customer, device, supplier, events, messages } = data;
  const next = getNextActions(order.status);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-4 md:px-6">
      {/* Hero (sticky, scroll-collapse) */}
      <motion.div
        style={{ paddingTop: heroPad, paddingBottom: heroPad }}
        className="glass-card sticky top-[64px] z-20 mb-6 px-5 md:top-[64px]"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs">
            <Link to="/orders">
              <ArrowLeft className="size-3.5" /> 返回列表
            </Link>
          </Button>
          <span className="opacity-50">/</span>
          <span>工单详情</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <motion.div style={{ scale: heroTitleScale, originX: 0 }} className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl font-semibold tracking-tight gradient-text md:text-3xl">
                {order.public_no}
              </span>
              <StatusBadge status={order.status} />
              <OrderTypeBadge type={order.order_type} />
              {order.original_order_id && (
                <Link
                  to="/orders/$id"
                  params={{ id: order.original_order_id }}
                  className="inline-flex items-center gap-1 rounded border bg-status-warn px-1.5 py-0.5 text-xs text-status-warn-foreground hover:underline"
                >
                  <Wrench className="size-3" /> 返修来源
                </Link>
              )}
            </div>
            <motion.div
              style={{ opacity: subtitleOpacity }}
              className="mt-1 truncate text-sm text-muted-foreground"
            >
              {device?.brand} {device?.model} · {customer?.name} · 技师 {order.technician_name}
            </motion.div>
          </motion.div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                总报价
              </div>
              <MoneyText
                amount={order.quotation_amount}
                className="font-display text-xl font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Action chips (horizontal scroll on mobile) */}
        <div className="-mx-5 mt-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 whitespace-nowrap">
            {next.primary && (
              <Button
                size="sm"
                disabled={transition.isPending}
                onClick={() => transition.mutate({ to: next.primary!.to })}
                className="h-8 gap-1.5 border-0 text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                推进至「{next.primary.label}」
              </Button>
            )}
            {next.secondary.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5">
                    其他流转 <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>选择目标状态</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {next.secondary.map((a) => (
                    <DropdownMenuItem
                      key={a.to}
                      onClick={() => {
                        if (a.to === "cancelled") setCancelOpen(true);
                        else transition.mutate({ to: a.to });
                      }}
                    >
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setNotifyOpen(true)}
            >
              <Bell className="size-3.5" /> 通知客户
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              disabled={order.is_paid || order.balance_amount <= 0}
              onClick={() => setPayOpen(true)}
            >
              <CreditCard className="size-3.5" /> 收款
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" /> 打印
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5">
              <Package className="size-3.5" /> 转库存
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(window.location.href)
                      .then(() => toast.success("链接已复制"));
                  }}
                >
                  复制链接
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="mr-2 size-3.5" /> 取消工单
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      {/* Segmented Tabs */}
      <div className="mb-4 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-surface/60 p-1 backdrop-blur">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="order-tab-indicator"
                    className="absolute inset-0 -z-10 rounded-md"
                    style={{
                      background:
                        "linear-gradient(120deg, oklch(0.7 0.2 285 / 0.25), oklch(0.78 0.16 200 / 0.18))",
                      boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

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
            <>
              <motion.div variants={fadeUp}>
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">客户与设备</h3>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      <Pencil className="size-3" /> 编辑
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">客户</div>
                      <div className="mt-1 text-sm font-medium">{customer?.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3" />
                        <PhoneText value={customer?.phone_e164 ?? ""} />
                      </div>
                      {!!order.contact_phones.length && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {order.contact_phones.map((p) => (
                            <span
                              key={p}
                              className="rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px]"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">设备</div>
                      <div className="mt-1 text-sm font-medium">
                        {device?.brand} {device?.model}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        IMEI {device?.serial_or_imei}
                      </div>
                      {device?.device_notes && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          备注：{device.device_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Card className="p-5">
                  <h3 className="mb-3 text-sm font-semibold">故障与诊断</h3>
                  <div className="space-y-3 text-sm">
                    <Field label="故障描述">{order.issue_description}</Field>
                    <Field label="诊断结果">
                      {order.diagnosis_result ?? (
                        <span className="text-muted-foreground">尚未填写</span>
                      )}
                    </Field>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {order.internal_tag && (
                        <Field label="内部标签">
                          <span className="rounded bg-status-warn px-1.5 py-0.5 text-status-warn-foreground">
                            {order.internal_tag}
                          </span>
                        </Field>
                      )}
                      {order.warranty_text && <Field label="质保">{order.warranty_text}</Field>}
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">报价与财务</h3>
                    <ApprovalBadge status={order.approval_status} />
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border/40">
                        <th className="py-2 text-left font-medium">项目</th>
                        <th className="py-2 text-right font-medium">金额</th>
                        <th className="py-2 text-left font-medium">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.fault_prices.map((f, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="py-2">{f.name}</td>
                          <td className="py-2 text-right">
                            <MoneyText amount={f.price} />
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{f.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Separator className="my-3" />
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Field label="总报价">
                      <MoneyText amount={order.quotation_amount} className="font-semibold" />
                    </Field>
                    <Field label="押金">
                      <MoneyText amount={order.deposit_amount} />
                    </Field>
                    <Field label="尾款">
                      <MoneyText amount={order.balance_amount} />
                    </Field>
                    <Field label="结清状态">
                      {order.is_paid ? (
                        <span className="inline-flex items-center gap-1 text-status-success-foreground">
                          <CheckCircle2 className="size-3.5" /> 已结清
                        </span>
                      ) : (
                        <span className="text-muted-foreground">未结清</span>
                      )}
                    </Field>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Send className="size-3.5" /> 发送审批
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <CreditCard className="size-3.5" /> 收款
                    </Button>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">客户签名</h3>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      <Signature className="size-3" />
                      {order.customer_signature ? "重新签名" : "请客户签名"}
                    </Button>
                  </div>
                  <div
                    className={cn(
                      "flex h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
                      order.customer_signature && "bg-surface-muted",
                    )}
                  >
                    {order.customer_signature ? "签名已采集" : "尚未签名"}
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Card className="p-5">
                  <h3 className="mb-3 text-sm font-semibold">关键信息</h3>
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <Row
                      label="创建时间"
                      value={new Date(order.created_at).toLocaleString("zh-CN")}
                    />
                    <Row
                      label="完成时间"
                      value={
                        order.completed_at
                          ? new Date(order.completed_at).toLocaleString("zh-CN")
                          : "—"
                      }
                    />
                    <Row
                      label="交付时间"
                      value={
                        order.delivered_at
                          ? new Date(order.delivered_at).toLocaleString("zh-CN")
                          : "—"
                      }
                    />
                    <Row label="技师" value={order.technician_name} />
                    {supplier && (
                      <Row
                        label="外修供应商"
                        value={
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: supplier.color }}
                            />
                            {supplier.name}
                          </span>
                        }
                      />
                    )}
                    {order.cancel_reason && <Row label="取消原因" value={order.cancel_reason} />}
                  </dl>
                </Card>
              </motion.div>
            </>
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
                    onClick={() => toast.success("已生成 WhatsApp 通知草稿")}
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
        defaultBody={`您好 ${customer?.name ?? ""}，您的工单 ${order.public_no} 状态：${statusMeta[order.status].label}。如有疑问请联系门店。`}
        onSend={async (channel, body) => {
          await sendNotification(id, body, channel);
          toast.success("通知已发送");
          invalidate();
        }}
      />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        balance={order.balance_amount}
        onPay={async (amount) => {
          await recordPayment(id, amount);
          toast.success(`已收款 ¥${amount.toLocaleString("zh-CN")}`);
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
    </div>
  );
}

function NotifyDialog({
  open,
  onOpenChange,
  defaultBody,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBody: string;
  onSend: (channel: "whatsapp" | "sms", body: string) => Promise<void>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发送客户通知</DialogTitle>
          <DialogDescription>选择通道并编辑通知内容。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["whatsapp", "sms"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition-colors",
                  channel === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-surface hover:bg-accent",
                )}
              >
                {c === "whatsapp" ? "WhatsApp" : "短信"}
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs">通知内容</Label>
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !body.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onSend(channel, body.trim());
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  balance,
  onPay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  balance: number;
  onPay: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("微信");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setAmount(balance);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登记收款</DialogTitle>
          <DialogDescription>未结清尾款 ¥{balance.toLocaleString("zh-CN")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">收款金额</Label>
            <Input
              type="number"
              min={0}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">支付方式</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["微信", "支付宝", "现金", "银行卡"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    method === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-surface hover:bg-accent",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || amount <= 0 || amount > balance}
            onClick={async () => {
              setBusy(true);
              try {
                await onPay(amount);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <CreditCard className="mr-1.5 size-3.5" /> 确认收款（{method}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>取消工单</DialogTitle>
          <DialogDescription>请填写取消原因，便于事后追溯。</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          placeholder="例如：客户主动放弃维修 / 备件无货 / 报价过高"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            返回
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-muted/30 px-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
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
      return `提交报价 ¥${payload.amount}`;
    case "approval_result":
      return `客户审批${payload.result === "approved" ? "通过" : "拒绝"}`;
    case "payment":
      return `收款 ¥${payload.amount}（${payload.method}）`;
    case "message_sent":
      return "已发送通知";
    default:
      return type;
  }
}
