"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  MoreHorizontal,
  Pencil,
  Printer,
  Save,
  Store,
  UserRound,
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
  onPrint,
  onCancel,
  canCancel = false,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  storeName = "ChinaTech",
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
  onPrint: () => void;
  onCancel: () => void;
  canCancel?: boolean;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  storeName?: string;
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
  const progressPercent = Math.max(
    0,
    Math.min(100, (safeCurrentStageIndex / Math.max(1, orderTaskStages.length - 1)) * 100),
  );
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
  const missingItems = readiness.filter((item) => !item.done);
  const heroActions = (
    <div className="flex min-w-0 shrink-0 items-center justify-end gap-1">
      <Button size="icon" variant="outline" className="size-7" onClick={onPrint} aria-label="打印">
        <Printer className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" className="size-7" aria-label="更多工单操作">
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
      {isEditing ? (
        <>
          <Button
            size="sm"
            disabled={editPending || editSaveDisabled}
            onClick={onSaveEdit}
            className="h-7 gap-1 border-0 px-2 text-[11px] text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Save className="size-3.5" />
            {editPending ? "保存中" : "保存"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={editPending}
            onClick={onCancelEdit}
          >
            <X className="size-3.5" /> 取消
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={onEdit}>
          <Pencil className="size-3.5" /> 编辑
        </Button>
      )}
    </div>
  );

  return (
    <div
      data-order-hero="true"
      data-order-desktop-status-card="true"
      className={cn(
        "sticky z-20 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]/95 shadow-[var(--shadow-workspace)] backdrop-blur-xl",
        surface === "dialog"
          ? cn(detailWorkspace.flatHero, "top-0 mb-2 p-1.5 pr-9 sm:mb-2 sm:p-1.5 sm:pr-9")
          : "top-12 mb-2 p-1.5 sm:top-14 sm:p-2",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            {showBackLink ? (
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-7 shrink-0"
                aria-label="返回列表"
              >
                <Link href="/orders">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            ) : null}
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  className="min-w-0 truncate font-display text-base font-semibold leading-tight tracking-tight gradient-text sm:text-lg"
                  title={order.public_no}
                >
                  {order.public_no}
                </span>
                <StatusBadge
                  status={order.status}
                  label={orderWorkflowMeta[workflowStatus].label}
                  tone={orderWorkflowMeta[workflowStatus].tone}
                  className="text-[10px]"
                />
                {sideBadges.map((badge) => (
                  <StatusBadge
                    key={badge.key}
                    status={order.status}
                    label={badge.label}
                    tone={badge.tone}
                    className="max-w-[7rem] truncate text-[10px]"
                  />
                ))}
                <OrderTypeBadge type={order.order_type} className="text-[10px]" />
                {order.original_order_id && (
                  <Link
                    href={`/orders/${order.original_order_id}`}
                    className="inline-flex items-center gap-1 rounded border bg-status-warn px-1.5 py-0.5 text-[10px] leading-none text-status-warn-foreground hover:underline"
                  >
                    <Wrench className="size-3" /> 返修来源
                  </Link>
                )}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] leading-3 text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Clock3 className="size-3 shrink-0" />
                  <span className="truncate">创建 {formatHeroDate(order.created_at)}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <UserRound className="size-3 shrink-0" />
                  <span className="truncate">负责人 {order.technician_name || "-"}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Store className="size-3 shrink-0" />
                  <span className="truncate">{storeName}</span>
                </span>
              </div>
            </div>
          </div>
          {heroActions}
        </div>

        <section className="min-w-0">
          <div className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-medium text-muted-foreground">当前流程</span>
              <span className="ml-1.5 text-xs font-semibold text-primary">{activeStage.label}</span>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1.5 text-right leading-4">
              <span className="hidden text-[10px] text-muted-foreground sm:inline">下一步</span>
              <span
                className="max-w-[10rem] truncate text-xs font-semibold"
                title={taskHint ?? guidance.task}
              >
                {primaryActionLabel}
              </span>
              {missingCount ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-warn px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-warn-foreground">
                  <AlertTriangle className="size-3" /> 缺 {missingCount}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-status-success px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-success-foreground">
                  就绪
                </span>
              )}
            </div>
          </div>
          <div
            data-order-stage-rail="true"
            className="relative min-w-0 overflow-hidden px-1 py-0.5"
          >
            <div className="absolute left-6 right-6 top-[11px] h-0.5 rounded-full bg-border/70" />
            <div
              className="absolute left-6 top-[11px] h-0.5 max-w-[calc(100%-3rem)] rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            <div className="relative grid grid-cols-7 gap-1">
              {orderTaskStages.map((stage, index) => {
                const completed = index < safeCurrentStageIndex;
                const active = index === safeCurrentStageIndex;
                return (
                  <div key={stage.key} className="min-w-0 text-center">
                    <span
                      className={cn(
                        "mx-auto grid place-items-center rounded-full border bg-card text-[8px] font-semibold shadow-sm",
                        "size-4",
                        completed && "border-primary bg-primary text-primary-foreground",
                        active &&
                          "border-primary bg-primary/10 text-primary ring-1 ring-primary/25",
                        !completed &&
                          !active &&
                          "border-[var(--border-panel)] bg-[var(--surface-panel-muted)] text-muted-foreground",
                      )}
                    >
                      {completed ? <Check className="size-3" /> : index + 1}
                    </span>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-[8px] leading-[9px] text-muted-foreground",
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
          {missingItems.length ? (
            <div data-order-readiness="true" className="mt-1 flex min-w-0 flex-wrap gap-1">
              {missingItems.map((item) => (
                <span
                  key={item.label}
                  className="truncate rounded-full bg-status-warn px-1.5 py-0.5 text-[9px] font-medium leading-3 text-status-warn-foreground"
                >
                  缺 {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function formatHeroDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
