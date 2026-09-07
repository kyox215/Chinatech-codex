"use client";

import Link from "next/link";
import { useEffect, useRef, type FocusEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle, ChevronRight, LockKeyhole, PackageSearch, Wrench } from "lucide-react";

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
} from "@/features/orders/model/order-task-flow";
import type { OrderListItem } from "@/lib/repairdesk/api";
import type { Supplier } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { ORDER_DETAIL_HOVER_DELAY_MS } from "@/features/preload/model/order-detail-preload";
import { formatOrderListDate, formatOrderRelativeDate } from "@/features/orders/model/order-date";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  localizeDeviceCustody,
  localizeOrderException,
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
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 px-2.5 pb-2 pt-2.5 transition-colors group-hover:bg-accent/10 group-active:bg-accent/20">
        <div className="grid min-w-0 content-start gap-1">
          <div className="flex min-w-0 items-center gap-1.5" data-order-mobile-identity="true">
            {order.customer_phone ? (
              <PhoneText
                value={order.customer_phone}
                className="min-w-0 truncate text-xs font-semibold leading-4 tracking-tight text-primary"
              />
            ) : (
              <span className="truncate text-xs font-semibold">{customerLabel}</span>
            )}
            {order.customer_name?.trim() && !customerNameIsPhone && order.customer_phone ? (
              <span
                className="max-w-[76px] truncate text-[10px] leading-4 text-muted-foreground"
                title={order.customer_name}
              >
                {order.customer_name}
              </span>
            ) : null}
          </div>
          <p
            className="truncate text-[13px] font-semibold leading-[18px] tracking-tight"
            title={deviceLabel}
          >
            {deviceLabel}
          </p>
          <p
            className="flex min-w-0 items-center gap-1 text-[10px] leading-4 text-muted-foreground"
            title={
              order.finance_redacted ? primaryRepairLabel : `${primaryRepairLabel} · ${issueLabel}`
            }
          >
            {order.finance_redacted ? (
              <LockKeyhole className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Wrench className="size-3 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">
              {primaryRepairLabel}
              {!order.finance_redacted && extraFaultCount > 0 ? ` +${extraFaultCount}` : ""}
              {!order.finance_redacted ? ` · ${issueLabel}` : ""}
            </span>
          </p>
        </div>
        <div
          className="flex min-w-0 max-w-[130px] flex-col items-end gap-1 text-right"
          data-order-mobile-card-payment="true"
        >
          <OrderQueueStageBadge
            order={order}
            className="max-w-full whitespace-normal px-1.5 py-0.5 text-[9px] leading-3 text-right"
          />
          {order.finance_redacted ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] leading-4 text-muted-foreground"
              data-order-financial-label="true"
            >
              <LockKeyhole className="size-3" aria-hidden="true" />
              {t("orders.amountRestricted")}
            </span>
          ) : (
            <>
              <p
                className={cn(
                  "flex flex-wrap items-baseline justify-end gap-x-1 text-[9px] leading-4",
                  paymentAmountClass,
                )}
              >
                <span className="text-muted-foreground">{paymentAmountLabel}</span>
                <MoneyText
                  amount={paymentAmount}
                  className="whitespace-nowrap text-xs font-semibold"
                />
              </p>
              <p className="flex max-w-full flex-wrap items-center justify-end gap-x-1 gap-y-0.5 text-[9px] leading-3 text-muted-foreground">
                {hasOutstandingBalance ? (
                  <span className="whitespace-nowrap">
                    <span>{t("orders.amountTotal")} </span>
                    <MoneyText amount={order.quotation_amount} className="whitespace-nowrap" />
                  </span>
                ) : null}
                <span className="max-w-full break-words" data-order-financial-label="true">
                  {paymentLabel}
                </span>
              </p>
            </>
          )}
        </div>
      </div>
      {showCustodyBadge || supplierControl ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1 px-2.5 pb-1.5">
          {showCustodyBadge ? (
            <DeviceCustodyBadge
              status={order.device_custody_status}
              deliveredAt={order.delivered_at}
              label={localizeDeviceCustody(order.device_custody_status, order.delivered_at, t)}
              className="max-w-full px-1 py-0.5 text-[9px]"
            />
          ) : null}
          {supplierControl}
        </div>
      ) : null}
      <OrderMiniProgress
        workflowStatus={workflowStatus}
        currentLabel={currentStageLabel}
        nextAction={guidance.nextAction}
        danger={hasOverdueException || Boolean(exceptionStatus)}
        isTerminal={workflowStatus === "closed"}
        className="mx-2.5 mb-1.5"
      />
      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-[var(--border-panel)] px-2.5 py-1.5 text-[9px] leading-3">
        <span
          className={cn(
            "flex min-w-0 items-center gap-0.5 text-muted-foreground",
            hasOverdueException && "text-status-danger-foreground",
          )}
          title={`${currentStageLabel} · ${guidance.nextAction}`}
        >
          <span className="truncate">{guidance.nextAction}</span>
          <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
        </span>
        <span
          className="flex min-w-0 max-w-[58%] shrink-0 items-center gap-2 text-muted-foreground"
          title={t("orders.technicianTimeTitle", {
            technician: order.technician_name || t("orders.unassigned"),
            date: createdDate,
            relative: relativeCreatedDate,
          })}
        >
          <span className="truncate font-mono font-medium">{order.public_no}</span>
          <span className="shrink-0">{createdDate}</span>
        </span>
      </div>
      {exceptionStatus || hasOverdueException ? (
        <div className="flex min-w-0 items-center gap-1.5 border-t border-[var(--border-panel)] bg-status-danger/10 px-2.5 py-1 text-[9px] leading-3 text-status-danger-foreground">
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          {exceptionStatus ? (
            <StatusBadge
              status={order.status}
              label={localizeOrderException(exceptionStatus, t).shortLabel}
              tone={orderExceptionMeta[exceptionStatus].tone}
              className="px-1 py-0.5 text-[9px]"
            />
          ) : null}
          <span className="min-w-0 truncate">
            {hasOverdueException ? t("orders.overdueHint") : t("orders.exceptionHint")}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
