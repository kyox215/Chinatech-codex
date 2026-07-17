"use client";

import Link from "next/link";
import { useEffect, useRef, type FocusEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  PackageSearch,
  ReceiptText,
  Smartphone,
  UserRound,
} from "lucide-react";

import { DeviceCustodyBadge, MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { DeviceUnlockListBadge } from "@/features/orders/components/device-unlock-fields";
import { OrderQueueStageBadge } from "@/features/orders/components/order-queue-stage-badge";
import { isOrderCancelledForPayment } from "@/features/orders/model/order-payment-state";
import { orderExceptionMeta } from "@/features/orders/model/canonical-order-status";
import {
  getOrderTaskGuidance,
  getOrderWorkflowStatus,
  getWorkflowProgressValue,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";
import { OrderSupplierPicker } from "@/features/suppliers/components/order-supplier-picker";
import type { OrderListItem } from "@/lib/repairdesk/api";
import type { OrderWorkflowStatusCode, Supplier } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { ORDER_DETAIL_HOVER_DELAY_MS } from "@/features/preload/model/order-detail-preload";
import { formatOrderListDate, formatOrderRelativeDate } from "@/features/orders/model/order-date";

export interface OrderMobileCardProps {
  order: OrderListItem;
  suppliers?: Supplier[];
  isPartsSupplierUpdating?: boolean;
  onPartsSupplierChange?: (supplierId: string | null) => void;
  onPrefetch?: () => void;
  onCancelPrefetch?: () => void;
}

export function OrderMobileCard({
  order,
  suppliers = [],
  isPartsSupplierUpdating = false,
  onPartsSupplierChange,
  onPrefetch,
  onCancelPrefetch,
}: OrderMobileCardProps) {
  const hoverTimerRef = useRef<number | null>(null);
  const detailHref = `/orders/${order.id}`;
  const cancelled = isOrderCancelledForPayment(order);
  const workflowStatus = getOrderWorkflowStatus(order);
  const exceptionStatus = order.exception_status;
  const hasOverdueException = !cancelled && Boolean(order.approval_overdue || order.pickup_overdue);
  const guidance = getOrderTaskGuidance(order);
  const currentStageLabel = guidance.label || guidance.stage.label;
  const normalizedCustomerName = normalizeComparable(order.customer_name);
  const normalizedPhone = normalizeComparable(order.customer_phone);
  const customerNameIsPhone =
    normalizedCustomerName.length > 0 && normalizedCustomerName === normalizedPhone;
  const customerLabel = order.customer_name?.trim() || order.customer_phone || "-";
  const showPhoneLine = Boolean(order.customer_phone && !customerNameIsPhone);
  const firstFaultPrice = order.fault_prices[0];
  const extraFaultCount = Math.max(0, order.fault_prices.length - 1);
  const primaryRepairLabel = order.finance_redacted
    ? "报价信息受限"
    : firstFaultPrice?.name || "待确认维修项目";
  const deviceLabel = order.device_label || order.device_imei || "未知设备";
  const issueLabel = order.issue_description || "待补充故障描述";
  const createdDate = formatOrderListDate(order.created_at);
  const relativeCreatedDate = formatOrderRelativeDate(order.created_at);
  const paymentLabel = order.finance_redacted
    ? "金额受限"
    : cancelled
      ? "已取消"
      : order.is_paid
        ? "已结清"
        : order.deposit_amount > 0
          ? "已付押金"
          : "未收款";
  const paymentStatusClass = order.finance_redacted
    ? "bg-muted text-muted-foreground"
    : cancelled
      ? "bg-muted text-muted-foreground"
      : order.is_paid
        ? "bg-status-success text-status-success-foreground"
        : order.deposit_amount > 0
          ? "bg-status-warn text-status-warn-foreground"
          : "bg-status-danger text-status-danger-foreground";
  const paymentTotalClass =
    !cancelled && order.balance_amount > 0 ? "text-status-danger-foreground" : "text-foreground";
  const paymentBalanceClass =
    !cancelled && order.balance_amount > 0
      ? "text-status-danger-foreground"
      : "text-muted-foreground";
  const partsSupplier = suppliers.find((supplier) => supplier.id === order.parts_supplier_id);
  const supplierControl = onPartsSupplierChange ? (
    <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
      <OrderSupplierPicker
        supplier={partsSupplier}
        suppliers={suppliers}
        isUpdating={isPartsSupplierUpdating}
        onChange={onPartsSupplierChange}
        mode="sheet"
        size="micro"
        label="供"
        className="max-w-[96px]"
      />
    </div>
  ) : partsSupplier ? (
    <span className="inline-flex h-5 max-w-[90px] shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 text-[9px] font-semibold leading-none text-primary">
      <PackageSearch className="size-2.5 shrink-0" />
      <span className="truncate">{partsSupplier.short_name || partsSupplier.name}</span>
    </span>
  ) : null;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current === null) return;
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };
  const isOrderDetailLink = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return target.closest("a")?.getAttribute("href") === detailHref;
  };
  const handlePointerEnter = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || !onPrefetch) return;
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      onPrefetch();
    }, ORDER_DETAIL_HOVER_DELAY_MS);
  };
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !isOrderDetailLink(event.target)) return;
    clearHoverTimer();
    onPrefetch?.();
  };
  const handleFocusCapture = (event: FocusEvent<HTMLElement>) => {
    if (isOrderDetailLink(event.target)) onPrefetch?.();
  };
  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return;
    clearHoverTimer();
    onCancelPrefetch?.();
  };

  useEffect(() => clearHoverTimer, []);

  return (
    <article
      className={cn(
        repairOs.mobileInfoCard,
        "group relative touch-manipulation select-none overflow-hidden",
      )}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => {
        clearHoverTimer();
        onCancelPrefetch?.();
      }}
      onPointerDownCapture={handlePointerDownCapture}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <div className="space-y-1 px-2.5 py-1.5 transition-colors group-hover:bg-accent/10 group-active:bg-accent/20">
        <Link href={detailHref} className="block">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="flex min-w-0 items-start gap-1.5 rounded-md px-0.5 text-[10px] leading-3 text-muted-foreground">
              <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                <UserRound className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-4 text-foreground">
                  {customerLabel}
                </p>
                {showPhoneLine ? (
                  <PhoneText
                    value={order.customer_phone}
                    className="block max-w-full truncate text-[10px] leading-3"
                  />
                ) : null}
              </div>
            </div>

            <div className="flex min-w-[88px] shrink-0 flex-col items-end gap-1">
              <OrderQueueStageBadge order={order} className="max-w-[108px]" />
              <p className="max-w-[72px] truncate text-right text-[10px] font-semibold leading-3 text-muted-foreground">
                {order.technician_name || "未分配"}
              </p>
              <p
                className="flex max-w-[128px] items-center justify-end gap-0.5 whitespace-nowrap text-[9px] leading-3 text-muted-foreground"
                title={`送修时间 ${createdDate}，${relativeCreatedDate}`}
              >
                <CalendarDays className="size-2.5 shrink-0" />
                <span>{createdDate}</span>
                <span>· {relativeCreatedDate}</span>
              </p>
              {exceptionStatus ? (
                <StatusBadge
                  status={order.status}
                  label={orderExceptionMeta[exceptionStatus].shortLabel}
                  tone={orderExceptionMeta[exceptionStatus].tone}
                  className="px-1.5 py-0.5 text-[9px]"
                />
              ) : null}
              {hasOverdueException ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-status-danger/15 px-1 py-0.5 text-[9px] font-medium leading-none text-status-danger-foreground ring-1 ring-inset ring-status-danger-foreground/30">
                  <AlertTriangle className="size-2.5 shrink-0" />
                  超期
                </span>
              ) : null}
            </div>
          </div>
        </Link>

        <div className="min-w-0 rounded-lg bg-surface-muted/70 px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href={detailHref} className="flex min-w-0 flex-1 items-center gap-1.5">
              <Smartphone className="size-3 shrink-0 text-muted-foreground" />
              <p className="truncate text-[12px] font-semibold leading-4 text-foreground">
                {deviceLabel}
              </p>
              <DeviceCustodyBadge
                status={order.device_custody_status}
                deliveredAt={order.delivered_at}
                className="max-w-[98px] px-1 py-0.5 text-[9px]"
              />
              {extraFaultCount > 0 ? (
                <span className="shrink-0 rounded bg-primary/10 px-1 text-[9px] leading-3 text-primary">
                  +{extraFaultCount}
                </span>
              ) : null}
            </Link>
            {supplierControl}
          </div>

          <Link href={detailHref} className="block">
            <p className="truncate text-[10px] leading-3 text-muted-foreground">{issueLabel}</p>

            <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden text-[9px] leading-3">
              <span className="inline-flex min-w-0 items-center gap-1 rounded bg-card/80 px-1.5 py-0.5 font-semibold text-foreground">
                <ReceiptText className="size-2.5 shrink-0 text-primary" />
                <span className="truncate">{primaryRepairLabel}</span>
              </span>
              {order.device_unlock_method ? (
                <DeviceUnlockListBadge
                  method={order.device_unlock_method}
                  className="max-w-[82px] shrink-0 px-1 py-0.5 text-[9px] leading-3"
                />
              ) : null}
              {order.accessory_notes ? (
                <span className="min-w-0 truncate text-muted-foreground">
                  随附：{order.accessory_notes}
                </span>
              ) : null}
            </div>
          </Link>
        </div>

        <Link href={detailHref} className="block">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-[var(--border-panel)] pt-1">
            <MobileWorkflowStrip
              workflowStatus={workflowStatus}
              currentLabel={currentStageLabel}
              nextAction={guidance.nextAction}
              danger={hasOverdueException}
            />

            <div className="grid min-w-[92px] gap-0.5 rounded-lg bg-surface-muted/55 px-1.5 py-1 text-right">
              <span
                className={cn(
                  "ml-auto inline-flex max-w-[74px] justify-center truncate rounded px-1.5 py-0.5 text-[9px] font-semibold leading-3",
                  paymentStatusClass,
                )}
              >
                {paymentLabel}
              </span>
              {order.finance_redacted ? (
                <span className="text-[10px] text-muted-foreground">金额受限</span>
              ) : (
                <>
                  <p
                    className={cn(
                      "flex items-baseline justify-end gap-1 text-[10px] leading-4",
                      paymentTotalClass,
                    )}
                  >
                    <span className="text-muted-foreground">总额</span>
                    <span className="font-mono text-[13px] font-bold tabular-nums">
                      <MoneyText amount={order.quotation_amount} />
                    </span>
                  </p>
                  <div className="grid min-w-0 gap-0.5 text-[9px] leading-3 text-muted-foreground">
                    <div className="flex min-w-0 justify-end gap-1">
                      <span className="shrink-0">定金</span>
                      <MoneyText amount={order.deposit_amount} className="min-w-0 truncate" />
                    </div>
                    <div className={cn("flex min-w-0 justify-end gap-1", paymentBalanceClass)}>
                      <span className="shrink-0 text-muted-foreground">
                        {cancelled ? "取消时余额" : "尾款"}
                      </span>
                      <MoneyText amount={order.balance_amount} className="min-w-0 truncate" />
                    </div>
                    {cancelled ? <span className="text-right">不计入待收</span> : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </Link>

        {hasOverdueException ? (
          <Link
            href={`/orders/${order.id}`}
            className="block rounded-md bg-status-danger/10 px-2 py-1 text-[10px] font-medium leading-3 text-status-danger-foreground"
          >
            当前工单存在超期风险，请优先跟进客户确认或取机。
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function MobileWorkflowStrip({
  workflowStatus,
  currentLabel,
  nextAction,
  danger,
}: {
  workflowStatus: OrderWorkflowStatusCode;
  currentLabel: string;
  nextAction: string;
  danger: boolean;
}) {
  const currentIndex = getWorkflowProgressValue(workflowStatus);
  const currentStage = orderTaskStages[currentIndex];

  return (
    <div className="min-w-0">
      <div className="min-w-0" aria-label={`当前流程：${currentStage?.label ?? workflowStatus}`}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex h-5 min-w-0 max-w-[150px] items-center gap-1 truncate rounded-md px-1.5 text-[9px] font-semibold leading-none",
              danger
                ? "bg-status-danger/10 text-status-danger-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            <span className="truncate">{currentLabel}</span>
          </span>
          <span className="shrink-0 font-mono text-[9px] leading-none text-muted-foreground tabular-nums">
            {Math.min(currentIndex + 1, orderTaskStages.length)}/{orderTaskStages.length}
          </span>
        </div>
        <div className="mt-1 grid min-w-0 grid-cols-5 gap-0.5">
          {orderTaskStages.map((stage, index) => {
            const active = index <= currentIndex;
            const current = index === currentIndex;

            return (
              <span
                key={stage.key}
                title={stage.label}
                className={cn(
                  "h-1.5 min-w-0 rounded-full",
                  current
                    ? danger
                      ? "bg-status-danger-foreground"
                      : "bg-primary"
                    : active
                      ? "bg-primary/45"
                      : "bg-border",
                )}
              />
            );
          })}
        </div>
      </div>
      <span
        className={cn(
          "mt-1 inline-flex h-5 max-w-full items-center truncate rounded-md px-1.5 text-[9px] font-semibold leading-none",
          danger
            ? "bg-status-danger/10 text-status-danger-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        {nextAction}
      </span>
    </div>
  );
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
