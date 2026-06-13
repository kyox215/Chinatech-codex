"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Check,
  Clock3,
  MoreHorizontal,
  Pencil,
  Printer,
  Save,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { OrderTypeBadge, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderDetail, OrderWorkflow } from "@/lib/repairdesk/api";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  orderWorkflowStatuses,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import { detailWorkspace } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

type NextAction = {
  primary?: { to: RepairOrderStatus; label: string };
  secondary: { to: RepairOrderStatus; label: string }[];
};

export function OrderHero({
  order,
  customerName,
  deviceLabel,
  next,
  workflow,
  transitionPending,
  onTransition,
  onOpenTransitionSheet,
  onNotify,
  onPrint,
  onCancel,
  canCancel = false,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  isEditing = false,
  editPending = false,
  editSaveDisabled = false,
  showBackLink = true,
  surface = "page",
}: {
  order: OrderDetail["order"];
  customerName?: string;
  deviceLabel: string;
  next: NextAction;
  workflow?: OrderWorkflow;
  transitionPending: boolean;
  onTransition: (to: RepairOrderStatus) => void;
  onOpenTransitionSheet?: () => void;
  onNotify: () => void;
  onPrint: () => void;
  onCancel: () => void;
  canCancel?: boolean;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isEditing?: boolean;
  editPending?: boolean;
  editSaveDisabled?: boolean;
  showBackLink?: boolean;
  surface?: "page" | "dialog";
}) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const exceptionStatus = order.exception_status;

  return (
    <div
      data-order-hero="true"
      className={cn(
        "sticky z-20 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]/95 shadow-[var(--shadow-workspace)] backdrop-blur-xl",
        surface === "dialog"
          ? cn(detailWorkspace.flatHero, "top-0 mb-3 py-1.5")
          : "top-12 mb-3 px-1.5 py-1 sm:top-14 sm:mb-3 sm:px-2.5 sm:py-1.5",
      )}
    >
      <div className="hidden min-w-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
        {showBackLink && (
          <>
            <Button asChild variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
              <Link href="/orders">
                <ArrowLeft className="size-3.5" /> 返回列表
              </Link>
            </Button>
            <span className="opacity-50">/</span>
          </>
        )}
        <span>工单详情</span>
      </div>

      <div className="grid min-w-0 gap-1.5 sm:mt-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className="min-w-0 max-w-full truncate font-display text-base font-semibold leading-tight tracking-tight gradient-text"
              title={order.public_no}
            >
              {order.public_no}
            </span>
            <StatusBadge
              status={order.status}
              label={orderWorkflowMeta[workflowStatus].label}
              tone={orderWorkflowMeta[workflowStatus].tone}
            />
            {exceptionStatus && (
              <StatusBadge
                status={order.status}
                label={orderExceptionMeta[exceptionStatus].shortLabel}
                tone={orderExceptionMeta[exceptionStatus].tone}
              />
            )}
            <OrderTypeBadge type={order.order_type} />
            {order.original_order_id && (
              <Link
                href={`/orders/${order.original_order_id}`}
                className="inline-flex items-center gap-1 rounded border bg-status-warn px-1.5 py-0.5 text-xs text-status-warn-foreground hover:underline"
              >
                <Wrench className="size-3" /> 返修来源
              </Link>
            )}
          </div>
          <div className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
            {deviceLabel} · {customerName ?? order.customer_name} · 技师 {order.technician_name}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:justify-end sm:gap-1.5">
          {isEditing ? (
            <>
              <Button
                size="sm"
                disabled={editPending || editSaveDisabled}
                onClick={onSaveEdit}
                className="col-span-2 h-7 gap-1 border-0 px-2 text-xs text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Save className="size-3.5" />
                {editPending ? "保存中…" : "保存"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                disabled={editPending}
                onClick={onCancelEdit}
              >
                <X className="size-3.5" /> 取消
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onEdit}>
              <Pencil className="size-3.5" /> 编辑
            </Button>
          )}

          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onNotify}>
            <Bell className="size-3.5" />
            通知
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            disabled={transitionPending || (!next.primary && next.secondary.length === 0)}
            onClick={() => onOpenTransitionSheet?.()}
          >
            <Clock3 className="size-3.5" />
            流转
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onPrint}>
            <Printer className="size-3.5" />
            打印
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                aria-label="更多工单操作"
              >
                <MoreHorizontal className="size-4" />
                更多
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
                disabled={!canCancel}
                onClick={onCancel}
              >
                <XCircle className="mr-2 size-3.5" />
                {canCancel ? "取消工单" : "当前状态不可取消"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <OrderStatusFlow
        current={workflowStatus}
        workflow={workflow}
        next={next}
        pending={transitionPending}
        onTransition={onTransition}
      />
    </div>
  );
}

function OrderStatusFlow({
  current,
  workflow,
  next,
  pending,
  onTransition,
}: {
  current: OrderWorkflowStatusCode;
  workflow?: OrderWorkflow;
  next: NextAction;
  pending: boolean;
  onTransition: (to: RepairOrderStatus) => void;
}) {
  void workflow;
  void next;
  void pending;
  void onTransition;
  const flowStatuses = orderWorkflowStatuses;
  const currentIndex = flowStatuses.findIndex((status) => status === current);

  const progressRatio = currentIndex <= 0 ? 0 : currentIndex / Math.max(1, flowStatuses.length - 1);
  const trackInset = `calc(100% / ${Math.max(1, flowStatuses.length * 2)})`;
  const trackWidth = `calc(100% - (100% / ${Math.max(1, flowStatuses.length)}))`;

  return (
    <div className="mt-1.5 min-w-0 px-1 pb-0.5 pt-1">
      <div className="relative min-w-0">
        <div
          data-status-flow-track="true"
          className="absolute top-2 h-1 rounded-full bg-surface-muted"
          style={{ left: trackInset, right: trackInset }}
        />
        <div
          className="absolute top-2 h-1 rounded-full bg-primary transition-all"
          style={{ left: trackInset, width: `calc(${trackWidth} * ${progressRatio})` }}
        />

        <div
          className="relative grid min-w-0"
          style={{ gridTemplateColumns: `repeat(${flowStatuses.length}, minmax(0, 1fr))` }}
        >
          {flowStatuses.map((status, index) => {
            const meta = orderWorkflowMeta[status];
            const isCurrent = index === currentIndex;
            const isPast = currentIndex >= 0 && index < currentIndex;
            const content = (
              <>
                <span
                  data-status-flow-dot="true"
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border bg-background text-[9px] shadow-sm",
                    isPast && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    !isPast && !isCurrent && "border-border bg-surface-muted text-muted-foreground",
                  )}
                >
                  {isPast ? <Check className="size-2.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "mt-1 min-w-0 truncate text-[10px] leading-none text-muted-foreground",
                    (isPast || isCurrent) && "text-foreground",
                  )}
                >
                  {meta.shortLabel}
                </span>
              </>
            );

            return (
              <div
                key={status}
                className={cn(
                  "flex min-w-0 flex-col items-center px-0.5 text-center font-medium",
                  !isPast && !isCurrent && "text-muted-foreground",
                )}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
