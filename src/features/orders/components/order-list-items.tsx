"use client";

import Link from "next/link";
import { useEffect, useRef, type FocusEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle, PackageSearch, Smartphone, UserRound } from "lucide-react";

import { DeviceCustodyBadge, MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { orderMobileFluidDensity } from "@/features/orders/components/order-list-layout";
import { OrderQueueStageBadge } from "@/features/orders/components/order-queue-stage-badge";
import {
  deriveOrderFinancialState,
  isOrderCancelledForPayment,
} from "@/features/orders/model/order-payment-state";
import { orderExceptionMeta } from "@/features/orders/model/canonical-order-status";
import {
  getOrderTaskGuidance,
  getOrderWorkflowStatus,
  getWorkflowProgressValue,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";
import type { OrderListItem } from "@/lib/repairdesk/api";
import type { OrderWorkflowStatusCode, Supplier } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { ORDER_DETAIL_HOVER_DELAY_MS } from "@/features/preload/model/order-detail-preload";
import { formatOrderListDate, formatOrderRelativeDate } from "@/features/orders/model/order-date";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  localizeDeviceCustody,
  localizeOrderException,
  localizeOrderFlowStage,
  localizeOrderTaskGuidance,
} from "@/features/orders/model/order-i18n";
import { localizeOrderFinancialLabel } from "@/features/orders/model/order-i18n";
import { OrderMiniProgress } from "@/features/orders/components/order-mini-progress";

export interface OrderMobileCardProps {
  order: OrderListItem;
  detailHref?: string;
  suppliers?: Supplier[];
  onPrefetch?: () => void;
  onCancelPrefetch?: () => void;
  onOpenIntent?: () => void;
}

export function OrderMobileCard({
  order,
  detailHref = `/orders/${order.id}`,
  suppliers = [],
  onPrefetch,
  onCancelPrefetch,
  onOpenIntent,
}: OrderMobileCardProps) {
  const { locale, t } = useLocale();
  const hoverTimerRef = useRef<number | null>(null);
  const cancelled = isOrderCancelledForPayment(order);
  const financialState = deriveOrderFinancialState(order);
  const workflowStatus = getOrderWorkflowStatus(order);
  const exceptionStatus = order.exception_status;
  const hasOverdueException = !cancelled && Boolean(order.approval_overdue || order.pickup_overdue);
  const guidance = localizeOrderTaskGuidance(getOrderTaskGuidance(order), t);
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
    ? t("orders.quoteRestrictedMobile")
    : firstFaultPrice?.name || t("orders.repairPending");
  const deviceLabel = order.device_label || order.device_imei || t("orders.unknownDevice");
  const issueLabel = order.issue_description || t("orders.issuePending");
  const createdDate = formatOrderListDate(order.created_at, locale);
  const relativeCreatedDate = formatOrderRelativeDate(order.created_at, Date.now(), locale);
  const paymentLabel = localizeOrderFinancialLabel(financialState, t);
  const paymentStatusClass =
    financialState.settlement === "settled" || financialState.settlement === "zero_charge"
      ? "bg-status-success text-status-success-foreground"
      : financialState.settlement === "partial"
        ? "bg-status-warn text-status-warn-foreground"
        : financialState.settlement === "unpaid"
          ? "bg-status-danger text-status-danger-foreground"
          : "bg-muted text-muted-foreground";
  const detailAccessibleName = t("orders.mobileDetailsAria", {
    id: order.public_no,
    customer: customerLabel,
    device: deviceLabel,
    stage: currentStageLabel,
    payment: paymentLabel,
  });
  const hasOutstandingBalance = !cancelled && order.balance_amount > 0;
  const paymentAmount = hasOutstandingBalance ? order.balance_amount : order.quotation_amount;
  const paymentAmountLabel = cancelled
    ? t("orders.recordAmount")
    : hasOutstandingBalance
      ? t("orders.amountDue")
      : t("orders.amountTotal");
  const paymentAmountClass = hasOutstandingBalance
    ? "text-status-danger-foreground"
    : "text-foreground";
  const showCustodyBadge = order.device_custody_status !== "with_shop";
  const partsSupplier = suppliers.find((supplier) => supplier.id === order.parts_supplier_id);
  const supplierControl = partsSupplier ? (
    <span className="inline-flex h-[18px] max-w-[82px] shrink-0 items-center gap-1 rounded bg-primary/10 px-1 text-[length:var(--order-mobile-meta)] font-semibold leading-none text-primary">
      <PackageSearch className="size-2.5 shrink-0" aria-hidden="true" />
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
    onOpenIntent?.();
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
      data-order-id={order.id}
      data-order-mobile-card="true"
      data-order-mobile-card-risk={
        hasOverdueException || Boolean(exceptionStatus) ? "true" : "false"
      }
      className={cn(
        repairOs.mobileInfoCard,
        orderMobileFluidDensity,
        "group relative touch-manipulation select-none overflow-hidden rounded-[var(--order-mobile-radius)] p-0",
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
      <Link
        href={detailHref}
        className="absolute inset-0 z-10 rounded-[var(--order-mobile-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        aria-label={detailAccessibleName}
        onClick={onOpenIntent}
      />
      <div className="grid gap-[var(--order-mobile-inline)] p-[var(--order-mobile-pad)] transition-colors group-hover:bg-accent/10 group-active:bg-accent/20">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[var(--order-mobile-gap)]">
          <div className="flex min-w-0 items-center gap-[var(--order-mobile-gap)]">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <UserRound className="size-[var(--order-mobile-icon)]" aria-hidden="true" />
            </span>
            <p className="min-w-0 truncate text-[length:var(--order-mobile-title)] font-semibold leading-4 text-foreground">
              {customerLabel}
            </p>
            {showPhoneLine ? (
              <PhoneText
                value={order.customer_phone}
                className="hidden min-w-0 truncate text-[length:var(--order-mobile-meta)] leading-3 min-[375px]:block"
              />
            ) : null}
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-[var(--order-mobile-gap)]">
            <p className="max-w-[96px] truncate font-mono text-[length:var(--order-mobile-meta)] font-semibold leading-3 text-primary">
              {order.public_no}
            </p>
            <OrderQueueStageBadge
              order={order}
              className="h-[18px] max-w-[88px] px-1 text-[length:var(--order-mobile-meta)]"
            />
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-[var(--order-mobile-gap)] rounded-[calc(var(--order-mobile-radius)-0.125rem)] bg-surface-muted/70 px-[var(--order-mobile-pad)] py-0.5">
          <Smartphone
            className="size-[var(--order-mobile-icon)] shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 truncate text-[length:var(--order-mobile-copy)] font-semibold leading-4 text-foreground">
            {deviceLabel}
          </p>
          {showCustodyBadge ? (
            <DeviceCustodyBadge
              status={order.device_custody_status}
              deliveredAt={order.delivered_at}
              label={localizeDeviceCustody(order.device_custody_status, order.delivered_at, t)}
              className="max-w-[86px] px-1 py-0.5 text-[length:var(--order-mobile-meta)]"
            />
          ) : null}
          {extraFaultCount > 0 ? (
            <span className="shrink-0 rounded bg-primary/10 px-1 text-[length:var(--order-mobile-meta)] leading-3 text-primary">
              +{extraFaultCount}
            </span>
          ) : null}
          {supplierControl}
          <p
            className="max-w-[112px] shrink-0 truncate text-right text-[length:var(--order-mobile-meta)] leading-3 text-muted-foreground"
            title={t("orders.technicianTimeTitle", {
              technician: order.technician_name || t("orders.unassigned"),
              date: createdDate,
              relative: relativeCreatedDate,
            })}
          >
            {order.technician_name || t("orders.unassigned")} · {createdDate}
          </p>
        </div>

        <p className="min-w-0 truncate px-0.5 text-[length:var(--order-mobile-meta)] leading-3 text-muted-foreground">
          <span className="font-semibold text-foreground">{primaryRepairLabel}</span>
          <span aria-hidden="true"> · </span>
          {issueLabel}
        </p>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-[var(--order-mobile-cluster)] border-t border-[var(--border-panel)] pt-[var(--order-mobile-inline)]">
          <MobileWorkflowStrip
            workflowStatus={workflowStatus}
            currentLabel={currentStageLabel}
            nextAction={guidance.nextAction}
            danger={hasOverdueException}
          />

          <div
            data-order-mobile-card-payment="true"
            className="flex min-w-0 items-end gap-[var(--order-mobile-gap)] rounded-[calc(var(--order-mobile-radius)-0.125rem)] bg-surface-muted/55 px-[var(--order-mobile-pad)] py-1 text-right"
          >
            <span
              className={cn(
                "inline-flex max-w-[76px] justify-center truncate rounded px-1 py-0.5 text-[length:var(--order-mobile-meta)] font-semibold leading-3",
                paymentStatusClass,
              )}
            >
              {paymentLabel}
            </span>
            {order.finance_redacted ? null : (
              <p
                className={cn(
                  "flex items-baseline justify-end gap-1 whitespace-nowrap text-[length:var(--order-mobile-meta)] leading-3",
                  paymentAmountClass,
                )}
              >
                <span className="text-muted-foreground">{paymentAmountLabel}</span>
                <MoneyText
                  amount={paymentAmount}
                  className="text-[length:var(--order-mobile-title)] font-bold"
                />
              </p>
            )}
          </div>
        </div>

        {exceptionStatus || hasOverdueException ? (
          <div className="flex min-w-0 items-center gap-[var(--order-mobile-gap)] rounded-md bg-status-danger/10 px-[var(--order-mobile-pad)] py-1 text-[length:var(--order-mobile-meta)] font-medium leading-3 text-status-danger-foreground">
            <AlertTriangle
              className="size-[var(--order-mobile-icon)] shrink-0"
              aria-hidden="true"
            />
            {exceptionStatus ? (
              <StatusBadge
                status={order.status}
                label={localizeOrderException(exceptionStatus, t).shortLabel}
                tone={orderExceptionMeta[exceptionStatus].tone}
                className="px-1 py-0.5 text-[length:var(--order-mobile-meta)]"
              />
            ) : null}
            <span className="min-w-0 truncate">
              {hasOverdueException ? t("orders.overdueHint") : t("orders.exceptionHint")}
            </span>
          </div>
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
  const { t } = useLocale();
  const currentIndex = getWorkflowProgressValue(workflowStatus);
  const currentStage = orderTaskStages[currentIndex];
  const localizedCurrentStage = currentStage ? localizeOrderFlowStage(currentStage, t) : undefined;

  return (
    <div
      className="min-w-0"
      aria-label={t("orders.workflowAria", {
        current: localizedCurrentStage?.label ?? currentLabel ?? workflowStatus,
        next: nextAction,
      })}
    >
      <div className="flex min-w-0 items-center justify-between gap-[var(--order-mobile-gap)]">
        <span
          className={cn(
            "inline-flex h-[18px] min-w-0 max-w-[150px] items-center gap-1 truncate rounded-md px-1 text-[length:var(--order-mobile-meta)] font-semibold leading-none",
            danger
              ? "bg-status-danger/10 text-status-danger-foreground"
              : "bg-primary/10 text-primary",
          )}
          title={`${currentLabel} · ${nextAction}`}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-current" />
          <span className="truncate">{nextAction}</span>
        </span>
        <span className="shrink-0 font-mono text-[length:var(--order-mobile-meta)] leading-none text-muted-foreground tabular-nums">
          {Math.min(currentIndex + 1, orderTaskStages.length)}/{orderTaskStages.length}
        </span>
      </div>
      <OrderMiniProgress
        workflowStatus={workflowStatus}
        currentLabel={currentLabel}
        nextAction={nextAction}
        danger={danger}
        className="mt-1"
      />
    </div>
  );
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
