"use client";

import Link from "next/link";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MessageCircle,
  Phone,
  Printer,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderWorkflowProgress } from "@/features/orders/components/order-workflow-progress";
import { OrderTransitionReasonSelector } from "@/features/orders/components/order-transition-reason-selector";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import {
  getWorkflowNextActions,
  getWorkflowStatusLabel,
} from "@/features/orders/model/order-workflow";
import { getOrderTaskGuidance } from "@/features/orders/model/order-task-flow";
import {
  getDefaultOrderTransitionReason,
  getOrderTransitionReasonConfig,
} from "@/features/orders/model/order-transition-reasons";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { getOrder, listOrderWorkflow, transitionOrder } from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { cn } from "@/lib/utils";

type WorkflowNextAction = NonNullable<ReturnType<typeof getWorkflowNextActions>["primary"]>;

const orderTaskPageShell =
  "mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-md flex-col gap-3 overflow-x-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 md:max-w-7xl md:gap-2 md:px-5 md:pb-6 md:pt-2 lg:px-6";

export function OrderTaskScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [transitionAction, setTransitionAction] = useState<WorkflowNextAction | null>(null);
  const [transitionReason, setTransitionReason] = useState("");

  useEffect(() => {
    document.body.dataset.orderDetailActive = "true";
    return () => {
      delete document.body.dataset.orderDetailActive;
    };
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ordersKeys.detail(id),
    queryFn: () => getOrder(id),
  });
  const { data: workflow } = useQuery({
    queryKey: ordersKeys.workflow(),
    queryFn: listOrderWorkflow,
    staleTime: 60_000,
  });

  const order = data?.order;
  const workflowStatus = order
    ? (order.workflow_status ?? workflowStatusFromLegacyStatus(order.status))
    : "intake";
  const guidance = order ? getOrderTaskGuidance(order) : null;
  const next = useMemo(
    () =>
      order
        ? getWorkflowNextActions(workflow, order.status)
        : { primary: undefined, secondary: [] },
    [order, workflow],
  );
  const exceptionStatus = order?.exception_status;
  const progressTone = exceptionStatus
    ? orderExceptionMeta[exceptionStatus].tone
    : (guidance?.tone ?? orderWorkflowMeta[workflowStatus].tone);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ordersKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const transition = useMutation({
    mutationFn: (input: { to: RepairOrderStatus; reason?: string }) =>
      transitionOrder(id, input.to, { reason: input.reason }),
    onSuccess: () => {
      toast.success("任务阶段已更新");
      setTransitionAction(null);
      setTransitionReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !order || !guidance) {
    return (
      <main data-order-task-root="true" className={orderTaskPageShell}>
        <Skeleton className="h-14 w-full rounded-2xl md:h-11 md:rounded-[var(--radius-lg)]" />
        <Skeleton className="h-40 w-full rounded-2xl md:h-36 md:rounded-[var(--radius-lg)]" />
        <div
          data-order-task-workspace="true"
          className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(300px,0.36fr)] md:gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.34fr)]"
        >
          <Skeleton className="h-44 w-full rounded-2xl md:h-48 md:rounded-[var(--radius-lg)]" />
          <div className="grid min-w-0 gap-3 md:gap-2">
            <Skeleton className="h-24 w-full rounded-2xl md:rounded-[var(--radius-lg)]" />
            <Skeleton className="h-36 w-full rounded-2xl md:rounded-[var(--radius-lg)]" />
          </div>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main data-order-task-root="true" className={orderTaskPageShell}>
        <div className="grid min-h-[52vh] min-w-0 place-items-center rounded-2xl border border-status-danger-foreground/25 bg-status-danger/10 p-4 text-center md:rounded-[var(--radius-lg)]">
          <div className="mx-auto max-w-md">
            <h1 className="text-lg font-semibold">任务加载失败</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "请稍后重试。"}
            </p>
            <Button asChild variant="outline" className="mt-3 h-9">
              <Link href="/orders">返回订单</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const primaryAction = next.primary;
  const taskActions = [next.primary, ...next.secondary].filter(
    (action): action is WorkflowNextAction => Boolean(action),
  );
  const currentStatusLabel = getWorkflowStatusLabel(workflow, order.status);
  const approvalDecisionRequired = isTaskApprovalDecisionRequired(order);

  const openTransitionAction = (action: WorkflowNextAction) => {
    setTransitionAction(action);
    setTransitionReason(getDefaultOrderTransitionReason(action.to));
  };

  return (
    <main data-order-task-root="true" className={orderTaskPageShell}>
      <header
        data-order-task-header="true"
        className="flex min-w-0 items-center justify-between gap-2 md:min-h-11 md:rounded-[var(--radius-lg)] md:border md:border-[var(--border-panel)] md:bg-[var(--surface-panel)] md:px-2.5 md:py-1.5 md:shadow-[var(--shadow-workspace)]"
      >
        <Button
          asChild
          variant="outline"
          size="icon"
          className="size-10 rounded-full md:size-8 md:rounded-lg"
        >
          <Link href="/orders">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 text-center">
          <div className="truncate font-mono text-sm font-semibold text-primary">
            {order.public_no}
          </div>
          <div className="text-[11px] text-muted-foreground md:hidden">扫码任务模式</div>
          <div className="hidden text-[11px] text-muted-foreground md:block">任务工作台</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full md:size-8 md:rounded-lg"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
        </Button>
      </header>

      <section
        data-order-task-hero="true"
        className="grid min-w-0 gap-3 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_minmax(260px,0.36fr)] md:gap-2 md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:p-2.5 md:shadow-[var(--shadow-workspace)]"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">当前阶段</div>
              <h1 className="mt-0.5 truncate text-2xl font-semibold md:text-lg">
                {guidance.stage.label}
              </h1>
              <p className="mt-1 hidden truncate text-xs text-muted-foreground md:block">
                {order.device_label || "-"} · {order.customer_name || "-"} · 技师{" "}
                {order.technician_name || "-"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge
                status={order.status}
                label={guidance.label}
                tone={progressTone}
                className="text-[10px]"
              />
              <OrderTypeBadge type={order.order_type} className="text-[10px]" />
            </div>
          </div>
          <OrderWorkflowProgress
            workflowStatus={workflowStatus}
            tone={progressTone}
            showLabels
            className="mt-3 md:mt-2"
          />
        </div>
        <div
          data-order-task-guidance="true"
          className={cn(
            "rounded-xl border p-3 md:p-2.5",
            order.approval_overdue || order.pickup_overdue
              ? "border-status-danger-foreground/25 bg-status-danger/10"
              : "border-primary/20 bg-primary/5",
          )}
        >
          <div className="flex items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardList className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold md:text-xs">现在需要做什么</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground md:text-xs md:leading-4">
                {guidance.task}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div
        data-order-task-workspace="true"
        className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(300px,0.36fr)] md:gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.34fr)]"
      >
        <section
          data-order-task-info="true"
          className="grid gap-2 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] md:content-start md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:p-2.5 md:shadow-none"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="size-4 text-primary" />
            任务信息
          </h2>
          <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
            <TaskLine label="客户" value={order.customer_name || "-"} />
            <TaskLine
              label="主电话"
              value={<PhoneText value={order.customer_phone} className="text-sm" />}
            />
            <TaskLine label="设备" value={order.device_label || "-"} />
            <TaskLine label="IMEI" value={order.device_imei || "-"} mono />
            <TaskLine label="故障" value={order.issue_description || "-"} wide />
            <TaskLine label="留存" value={order.accessory_notes || "-"} wide />
          </div>
        </section>

        <div className="grid min-w-0 gap-3 md:sticky md:top-16 md:self-start md:gap-2">
          <section
            data-order-task-finance="true"
            className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:p-2.5 md:shadow-none"
          >
            <Metric label="总价" value={<MoneyText amount={order.quotation_amount} />} />
            <Metric label="定金" value={<MoneyText amount={order.deposit_amount} />} />
            <Metric label="待付" value={<MoneyText amount={order.balance_amount} />} />
          </section>

          <section
            data-order-task-actions="true"
            className="mt-auto grid gap-2 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] md:rounded-[var(--radius-lg)] md:bg-[var(--surface-panel)] md:p-2.5 md:shadow-none"
          >
            <TaskTransitionPanel
              statusLabel={currentStatusLabel}
              actions={taskActions}
              primaryAction={primaryAction}
              approvalDecisionRequired={approvalDecisionRequired}
              orderId={order.id}
              pending={transition.isPending}
              onPick={openTransitionAction}
            />
            <div className="grid grid-cols-3 gap-2">
              <Button
                asChild
                variant="outline"
                className="h-10 gap-1 rounded-xl md:h-9 md:rounded-lg"
              >
                <a href={`tel:${order.customer_phone}`}>
                  <Phone className="size-4" />
                  电话
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 gap-1 rounded-xl md:h-9 md:rounded-lg"
              >
                <a
                  href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                  target="_blank"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 gap-1 rounded-xl md:h-9 md:rounded-lg"
              >
                <Link href={`/orders/${order.id}`}>
                  <Bell className="size-4" />
                  详情
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>

      <TaskTransitionDialog
        open={Boolean(transitionAction)}
        order={order}
        statusLabel={currentStatusLabel}
        action={transitionAction}
        reason={transitionReason}
        pending={transition.isPending}
        onReasonChange={setTransitionReason}
        onOpenChange={(open) => {
          if (open) return;
          setTransitionAction(null);
          setTransitionReason("");
        }}
        onConfirm={() => {
          if (!transitionAction) return;
          const config = getOrderTransitionReasonConfig(transitionAction.to);
          const reason = transitionReason.trim();
          if (config?.required && !reason) {
            toast.error("请先填写处理原因。");
            return;
          }
          transition.mutate({ to: transitionAction.to, reason: reason || undefined });
        }}
      />
    </main>
  );
}

function TaskTransitionPanel({
  statusLabel,
  actions,
  primaryAction,
  approvalDecisionRequired,
  orderId,
  pending,
  onPick,
}: {
  statusLabel: string;
  actions: WorkflowNextAction[];
  primaryAction?: WorkflowNextAction;
  approvalDecisionRequired: boolean;
  orderId: string;
  pending: boolean;
  onPick: (action: WorkflowNextAction) => void;
}) {
  const hasReasonAction = actions.some((action) =>
    Boolean(getOrderTransitionReasonConfig(action.to)),
  );

  if (approvalDecisionRequired) {
    return (
      <div data-order-task-transition-panel="true" className="grid min-w-0 gap-2">
        <div className="grid min-w-0 gap-2 rounded-xl border border-status-warn-foreground/25 bg-status-warn/40 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warn-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-status-warn-foreground">
                需要先处理客户审批
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-status-warn-foreground/80">
                当前处于报价确认阶段，必须记录客户同意或拒绝后再进入维修、订件、寄修或取消。
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-9 justify-center rounded-lg">
            <Link href={`/orders/${orderId}`}>打开审批处理</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-order-task-transition-panel="true" className="grid min-w-0 gap-2">
      <Button
        type="button"
        size="lg"
        className="h-12 gap-2 rounded-2xl md:h-11 md:rounded-xl"
        disabled={!primaryAction || pending}
        onClick={() => primaryAction && onPick(primaryAction)}
      >
        <CheckCircle2 className="size-5" />
        {primaryAction ? `推进至「${primaryAction.label}」` : "暂无下一步"}
        <ArrowRight className="size-4" />
      </Button>

      {actions.length > 1 ? (
        <div className="grid min-w-0 gap-1.5 md:grid-cols-2">
          {actions.map((action) => {
            const needsReason = Boolean(getOrderTransitionReasonConfig(action.to));
            return (
              <button
                key={action.to}
                type="button"
                disabled={pending}
                className={cn(
                  "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  action.isPrimary
                    ? "border-primary/35 bg-primary/5"
                    : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
                  action.to === "cancelled" &&
                    "border-status-danger-foreground/25 bg-status-danger/45 text-status-danger-foreground",
                  pending && "pointer-events-none opacity-60",
                )}
                onClick={() => onPick(action)}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-lg",
                    action.isPrimary
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground",
                    action.to === "cancelled" && "bg-status-danger text-status-danger-foreground",
                  )}
                >
                  {action.isPrimary ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Clock3 className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    {statusLabel} → {action.label}
                  </span>
                  <span className="block truncate text-[10px] leading-3 text-muted-foreground">
                    {getTaskStatusActionHint(action.to)}
                  </span>
                </span>
                {needsReason ? (
                  <span className="rounded bg-status-warn px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-status-warn-foreground">
                    原因
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {hasReasonAction ? (
        <p className="flex min-w-0 items-start gap-1.5 rounded-lg bg-status-warn px-2 py-1.5 text-[10px] leading-4 text-status-warn-foreground">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          取消、未修取机和返修等结束/异常分支会要求记录原因，便于后续追溯。
        </p>
      ) : null}
    </div>
  );
}

function TaskTransitionDialog({
  open,
  order,
  statusLabel,
  action,
  reason,
  pending,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  order: {
    public_no: string;
    status: RepairOrderStatus;
    device_label?: string;
    customer_name?: string;
  };
  statusLabel: string;
  action: WorkflowNextAction | null;
  reason: string;
  pending: boolean;
  onReasonChange: (reason: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const config = action ? getOrderTransitionReasonConfig(action.to) : undefined;
  const canConfirm = Boolean(action) && (!config?.required || Boolean(reason.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-order-task-transition-dialog="true"
        className="grid max-h-[calc(100svh-24px)] w-[min(760px,calc(100vw-24px))] max-w-[calc(100vw-24px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 pr-12 text-left">
          <DialogTitle className="flex min-w-0 items-center gap-2 text-base">
            <Clock3 className="size-4 text-primary" />
            任务状态推进
          </DialogTitle>
          <DialogDescription className="truncate">
            {order.public_no} · {order.device_label || "-"} · {order.customer_name || "-"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 min-w-0 gap-3 overflow-y-auto p-4 md:grid-cols-[minmax(220px,0.58fr)_minmax(0,1fr)]">
          <section className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
            <p className="text-[10px] leading-3 text-muted-foreground">当前状态</p>
            <p className="mt-1 truncate text-sm font-semibold">{statusLabel}</p>
            <div className="my-3 h-px bg-[var(--border-panel)]" />
            <p className="text-[10px] leading-3 text-muted-foreground">准备推进</p>
            <p className="mt-1 truncate text-sm font-semibold text-primary">
              {action?.label ?? "未选择"}
            </p>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              确认后会写入工单时间线；客户通知、收款和附件仍通过各自入口记录。
            </p>
          </section>

          <section className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
            {action ? (
              <OrderTransitionReasonSelector
                target={action.to}
                value={reason}
                onChange={onReasonChange}
                disabled={pending}
                compact
              />
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-6 text-center text-xs text-muted-foreground">
                请选择一个下一步状态。
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={pending || !canConfirm} onClick={onConfirm}>
            {pending ? "推进中..." : "确认推进"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getTaskStatusActionHint(status: RepairOrderStatus) {
  if (status === "waiting_approval") return "只改为待审批，不自动发消息";
  if (status === "notified") return "只标记已通知，不自动发消息";
  if (status === "mail_in_progress") return "转外修处理，需要寄修说明";
  if (status === "parts_ordered") return "配件已订，等待到货";
  if (status === "parts_arrived") return "配件到货，可开始维修";
  if (status === "unfixed_pickup") return "未维修交还，需要原因";
  if (status === "cancelled") return "终止工单，需要原因";
  if (status === "completed") return "完成交付并归档";
  return "更新状态并写入时间线";
}

function isTaskApprovalDecisionRequired(order: {
  status: RepairOrderStatus;
  approval_status?: string;
  approval_flow_status?: string;
}) {
  return (
    order.approval_flow_status === "waiting_customer" ||
    (order.status === "waiting_approval" && order.approval_status === "pending") ||
    (order.status === "quoted" && order.approval_status === "pending")
  );
}

function TaskLine({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[68px_minmax(0,1fr)] gap-2 text-sm md:grid-cols-[76px_minmax(0,1fr)]",
        wide && "md:col-span-2 xl:col-span-2",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words font-medium", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
