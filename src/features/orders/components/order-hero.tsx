"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
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
import type { OrderDetail } from "@/lib/repairdesk/api";
import {
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import {
  getOrderTaskGuidance,
  orderTaskStages,
  type OrderTaskStage,
} from "@/features/orders/model/order-task-flow";
import { getOrderSideStatusBadges } from "@/features/orders/model/order-side-statuses";
import { detailWorkspace } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function OrderHero({
  order,
  customerName,
  deviceLabel,
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
  currentStage,
  currentStageIndex = 0,
  nextActionLabel,
  taskHint,
  approvalDecisionAvailable = false,
}: {
  order: OrderDetail["order"];
  customerName?: string;
  deviceLabel: string;
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
  currentStage?: OrderTaskStage;
  currentStageIndex?: number;
  nextActionLabel?: string;
  taskHint?: string;
  approvalDecisionAvailable?: boolean;
}) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const sideBadges = getOrderSideStatusBadges(order);
  const guidance = getOrderTaskGuidance(order);
  const activeStage = currentStage ?? guidance.stage;
  const safeCurrentStageIndex = Math.max(
    0,
    Math.min(currentStageIndex, orderTaskStages.length - 1),
  );
  const primaryActionLabel =
    nextActionLabel ?? (approvalDecisionAvailable ? "处理客户审批" : guidance.nextAction);
  const readiness = [
    { label: "客户电话", done: Boolean(order.customer_phone?.trim()) },
    { label: "设备型号", done: Boolean(order.device_label?.trim()) },
    { label: "维修报价", done: order.fault_prices.length > 0 || order.quotation_amount > 0 },
    {
      label: "尾款",
      done: order.is_paid || order.balance_amount <= 0 || activeStage.key !== "pickup",
    },
  ];
  const missingCount = readiness.filter((item) => !item.done).length;
  const heroActions = (
    <div className="flex min-w-0 justify-end gap-1.5">
      <Button size="icon" variant="outline" className="size-8" onClick={onPrint} aria-label="打印">
        <Printer className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" className="size-8" aria-label="更多工单操作">
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
            disabled={!canCancel}
            onClick={onCancel}
          >
            <XCircle className="mr-2 size-3.5" />
            {canCancel ? "取消工单" : "当前状态不可取消"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div
      data-order-hero="true"
      data-order-desktop-status-card="true"
      className={cn(
        "sticky z-20 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]/95 shadow-[var(--shadow-workspace)] backdrop-blur-xl",
        surface === "dialog"
          ? cn(detailWorkspace.flatHero, "top-0 mb-2 p-2")
          : "top-12 mb-2 p-2 sm:top-14",
      )}
    >
      <div
        className={cn(
          "grid min-w-0 gap-3 lg:items-start",
          surface === "dialog"
            ? "pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)]"
            : "pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.36fr)]",
        )}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {showBackLink ? (
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="返回列表"
                >
                  <Link href="/orders">
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
              ) : null}
              <span
                className="min-w-0 max-w-full truncate font-display text-lg font-semibold leading-tight tracking-tight gradient-text"
                title={order.public_no}
              >
                {order.public_no}
              </span>
              <StatusBadge
                status={order.status}
                label={orderWorkflowMeta[workflowStatus].label}
                tone={orderWorkflowMeta[workflowStatus].tone}
              />
              {sideBadges.map((badge) => (
                <StatusBadge
                  key={badge.key}
                  status={order.status}
                  label={badge.label}
                  tone={badge.tone}
                  className="max-w-[9rem] truncate"
                />
              ))}
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
            {heroActions}
          </div>
          <div className="mt-1 min-w-0 truncate text-xs text-muted-foreground">
            {deviceLabel} · {customerName ?? order.customer_name} · 技师 {order.technician_name}
          </div>

          <div
            data-order-stage-rail="true"
            className="relative mt-2 min-w-0 rounded-lg border border-[var(--border-panel)] bg-card/80 px-2 py-1.5"
          >
            <div className="absolute left-8 right-8 top-[17px] h-0.5 rounded-full bg-[var(--surface-panel-muted)]" />
            <div
              className="absolute left-8 top-[17px] h-0.5 max-w-[calc(100%-4rem)] rounded-full bg-primary transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (safeCurrentStageIndex / Math.max(1, orderTaskStages.length - 1)) * 100,
                  ),
                )}%`,
              }}
            />
            <div className="relative grid grid-cols-7 gap-1">
              {orderTaskStages.map((stage, index) => {
                const completed = index < safeCurrentStageIndex;
                const active = index === safeCurrentStageIndex;
                return (
                  <div key={stage.key} className="min-w-0 text-center">
                    <span
                      className={cn(
                        "mx-auto grid place-items-center rounded-full border bg-card text-[10px] font-semibold shadow-sm",
                        "size-6",
                        completed && "border-primary bg-primary text-primary-foreground",
                        active &&
                          "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                        !completed &&
                          !active &&
                          "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground",
                      )}
                    >
                      {completed ? <Check className="size-3.5" /> : stage.shortLabel}
                    </span>
                    <p
                      className={cn(
                        "truncate leading-3 text-muted-foreground",
                        "mt-0.5 text-[9px]",
                        active && "font-semibold text-primary",
                      )}
                    >
                      {stage.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
            "px-2.5 py-2",
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold leading-3 text-muted-foreground">下一步</p>
              <p className="mt-1 truncate text-sm font-semibold">{primaryActionLabel}</p>
            </div>
            {missingCount ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-warn px-1.5 py-0.5 text-[10px] font-semibold leading-none text-status-warn-foreground">
                <AlertTriangle className="size-3" /> 缺 {missingCount}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-status-success px-1.5 py-0.5 text-[10px] font-semibold leading-none text-status-success-foreground">
                就绪
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {taskHint ?? guidance.task}
          </p>
          <div data-order-readiness="true" className="mt-2 grid grid-cols-2 gap-1">
            {readiness.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "truncate rounded-md px-1.5 py-1 text-[10px] leading-3",
                  item.done
                    ? "bg-status-success text-status-success-foreground"
                    : "bg-status-warn text-status-warn-foreground",
                )}
              >
                {item.done ? "已" : "缺"} {item.label}
              </span>
            ))}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap justify-end gap-1.5">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  disabled={editPending || editSaveDisabled}
                  onClick={onSaveEdit}
                  className="h-7 gap-1 border-0 px-2 text-xs text-primary-foreground"
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
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onEdit}
              >
                <Pencil className="size-3.5" /> 编辑
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
