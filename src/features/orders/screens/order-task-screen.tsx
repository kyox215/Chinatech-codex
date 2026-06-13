"use client";

import Link from "next/link";
import type * as React from "react";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Phone,
  Printer,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderWorkflowProgress } from "@/features/orders/components/order-workflow-progress";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { getWorkflowNextActions } from "@/features/orders/model/order-workflow";
import { getOrderTaskGuidance } from "@/features/orders/model/order-task-flow";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { getOrder, listOrderWorkflow, transitionOrder } from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { cn } from "@/lib/utils";

export function OrderTaskScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();

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
    () => (order ? getWorkflowNextActions(workflow, order.status) : { primary: undefined }),
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
    mutationFn: (to: RepairOrderStatus) => transitionOrder(id, to),
    onSuccess: () => {
      toast.success("任务阶段已更新");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !order || !guidance) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-md flex-col gap-3 px-3 py-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-md flex-col justify-center px-3 py-3">
        <div className="rounded-2xl border border-status-danger-foreground/25 bg-status-danger/10 p-4 text-center">
          <h1 className="text-lg font-semibold">任务加载失败</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "请稍后重试。"}
          </p>
          <Button asChild variant="outline" className="mt-3 h-9">
            <Link href="/orders">返回订单</Link>
          </Button>
        </div>
      </main>
    );
  }

  const primaryAction = next.primary;

  return (
    <main className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-md flex-col gap-3 overflow-x-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
      <header className="flex min-w-0 items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon" className="size-10 rounded-full">
          <Link href="/orders">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 text-center">
          <div className="truncate font-mono text-sm font-semibold text-primary">
            {order.public_no}
          </div>
          <div className="text-[11px] text-muted-foreground">扫码任务模式</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
        </Button>
      </header>

      <section className="rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">当前阶段</div>
            <h1 className="mt-0.5 truncate text-2xl font-semibold">{guidance.stage.label}</h1>
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
          className="mt-3"
        />
      </section>

      <section
        className={cn(
          "rounded-2xl border p-3 shadow-[var(--shadow-card)]",
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
            <h2 className="text-sm font-semibold">现在需要做什么</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{guidance.task}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="size-4 text-primary" />
          任务信息
        </h2>
        <TaskLine label="客户" value={order.customer_name || "-"} />
        <TaskLine
          label="主电话"
          value={<PhoneText value={order.customer_phone} className="text-sm" />}
        />
        <TaskLine label="设备" value={order.device_label || "-"} />
        <TaskLine label="IMEI" value={order.device_imei || "-"} mono />
        <TaskLine label="故障" value={order.issue_description || "-"} />
        <TaskLine label="留存" value={order.accessory_notes || "-"} />
      </section>

      <section className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
        <Metric label="总价" value={<MoneyText amount={order.quotation_amount} />} />
        <Metric label="定金" value={<MoneyText amount={order.deposit_amount} />} />
        <Metric label="待付" value={<MoneyText amount={order.balance_amount} />} />
      </section>

      <div className="mt-auto grid gap-2">
        <Button
          type="button"
          size="lg"
          className="h-12 gap-2 rounded-2xl"
          disabled={!primaryAction || transition.isPending}
          onClick={() => primaryAction && transition.mutate(primaryAction.to)}
        >
          <CheckCircle2 className="size-5" />
          {primaryAction ? `推进至「${primaryAction.label}」` : "暂无下一步"}
          <ArrowRight className="size-4" />
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button asChild variant="outline" className="h-10 rounded-xl gap-1">
            <a href={`tel:${order.customer_phone}`}>
              <Phone className="size-4" />
              电话
            </a>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-xl gap-1">
            <a href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`} target="_blank">
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-xl gap-1">
            <Link href={`/orders/${order.id}`}>
              <Bell className="size-4" />
              详情
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function TaskLine({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[68px_minmax(0,1fr)] gap-2 text-sm">
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
