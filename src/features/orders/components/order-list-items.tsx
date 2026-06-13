"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  ReceiptText,
  Smartphone,
  UserRound,
  WalletCards,
} from "lucide-react";

import { MoneyText, OrderTypeBadge, StatusBadge } from "@/components/orders/badges";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { OrderWorkflowProgress } from "@/features/orders/components/order-workflow-progress";
import { getOrderTaskGuidance } from "@/features/orders/model/order-task-flow";
import type { OrderListItem } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export interface OrderMobileCardProps {
  order: OrderListItem;
}

export function OrderMobileCard({ order }: OrderMobileCardProps) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const exceptionStatus = order.exception_status;
  const hasOverdueException = Boolean(order.approval_overdue || order.pickup_overdue);
  const guidance = getOrderTaskGuidance(order);
  const progressTone = exceptionStatus ? orderExceptionMeta[exceptionStatus].tone : guidance.tone;
  const createdDate = new Date(order.created_at).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
  const normalizedCustomerName = normalizeComparable(order.customer_name);
  const normalizedPhone = normalizeComparable(order.customer_phone);
  const customerNameIsPhone =
    normalizedCustomerName.length > 0 && normalizedCustomerName === normalizedPhone;
  const customerLabel = order.customer_name?.trim() || order.customer_phone || "-";
  const showPhoneLine = Boolean(order.customer_phone && !customerNameIsPhone);
  const customerLine = showPhoneLine
    ? `${customerLabel} · ${formatPhoneHint(order.customer_phone)}`
    : customerLabel;
  const firstFaultPrice = order.fault_prices[0];
  const extraFaultCount = Math.max(0, order.fault_prices.length - 1);
  const primaryRepairLabel = firstFaultPrice?.name || "待确认维修项目";
  const deviceLine = order.issue_description
    ? `${order.device_label || "未知设备"} · ${order.issue_description}`
    : order.device_label || order.device_imei || "-";
  const paidAmount = Math.max(
    0,
    order.quotation_amount - order.deposit_amount - order.balance_amount,
  );
  const paymentLabel = order.is_paid ? "已结清" : order.deposit_amount > 0 ? "已付押金" : "未收款";
  const paymentStatusClass = order.is_paid
    ? "bg-status-success text-status-success-foreground"
    : order.deposit_amount > 0
      ? "bg-status-warn text-status-warn-foreground"
      : "bg-status-danger text-status-danger-foreground";
  const paymentBalanceClass =
    order.balance_amount > 0 ? "text-status-danger-foreground" : "text-muted-foreground";

  return (
    <Link
      href={`/orders/${order.id}`}
      className={cn(
        repairOs.mobileInfoCard,
        "group relative block space-y-2 px-3 py-2.5 transition-colors hover:bg-accent/15",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-mono text-sm font-semibold leading-5 text-primary">
              {order.public_no}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
              <Calendar className="size-3" />
              {createdDate}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
            <StatusBadge
              status={order.status}
              label={orderWorkflowMeta[workflowStatus].shortLabel}
              tone={orderWorkflowMeta[workflowStatus].tone}
              className="max-w-full px-1.5 py-0.5 text-[10px]"
            />
            <OrderTypeBadge
              type={order.order_type}
              className="max-w-full px-1.5 py-0.5 text-[10px]"
            />
            {exceptionStatus ? (
              <StatusBadge
                status={order.status}
                label={orderExceptionMeta[exceptionStatus].shortLabel}
                tone={orderExceptionMeta[exceptionStatus].tone}
                className="max-w-full px-1.5 py-0.5 text-[10px]"
              />
            ) : null}
            {hasOverdueException ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-status-danger/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-status-danger-foreground ring-1 ring-inset ring-status-danger-foreground/30">
                <AlertTriangle className="size-3 shrink-0" />
                超期
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] font-medium leading-3 text-muted-foreground">负责人</p>
          <p className="max-w-[84px] truncate text-[11px] font-semibold leading-4">
            {order.technician_name || "-"}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_124px] gap-2 border-t border-[var(--border-panel)] pt-2">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium leading-3 text-muted-foreground">
                客户信息
              </p>
              <p className="truncate text-xs font-semibold leading-4">{customerLine}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
              <Smartphone className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium leading-3 text-muted-foreground">
                设备与故障
              </p>
              <p className="line-clamp-1 text-[11px] font-medium leading-4 text-foreground">
                {deviceLine}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 border-l border-[var(--border-panel)] pl-2 text-right">
          <div className="flex items-center justify-end gap-1 text-[9px] font-medium leading-3 text-muted-foreground">
            <WalletCards className="size-3 text-muted-foreground" />
            支付信息
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <span
              className={cn(
                "max-w-full truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-3",
                paymentStatusClass,
              )}
            >
              {paymentLabel}
            </span>
          </div>
          <PaymentMiniLine
            label="总额"
            value={<MoneyText amount={order.quotation_amount} />}
            strong
          />
          <PaymentMiniLine
            label="尾款"
            value={formatCompactMoney(order.balance_amount)}
            className={paymentBalanceClass}
            strong={order.balance_amount > 0}
          />
          <PaymentMiniLine label="已付" value={formatCompactMoney(paidAmount)} />
        </div>
      </div>

      <div className="border-t border-[var(--border-panel)] pt-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-[10px] font-medium leading-3 text-muted-foreground">
              <ReceiptText className="size-3 shrink-0 text-primary" />
              维修项目与报价
              {extraFaultCount > 0 ? (
                <span className="rounded bg-primary/10 px-1 text-[9px] leading-3">
                  +{extraFaultCount}
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-1 truncate text-xs leading-4",
                firstFaultPrice
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground",
              )}
            >
              {primaryRepairLabel}
            </p>
            {order.accessory_notes ? (
              <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
                留存：{order.accessory_notes}
              </p>
            ) : null}
          </div>
          <p
            className={cn(
              "shrink-0 truncate text-[10px] font-medium leading-4",
              hasOverdueException ? "text-status-danger-foreground" : "text-primary",
            )}
          >
            下一步：{guidance.nextAction}
          </p>
        </div>
      </div>

      {hasOverdueException ? (
        <div className="rounded-md bg-status-danger/10 px-2 py-1 text-[10px] font-medium leading-3 text-status-danger-foreground">
          当前工单存在超期风险，请优先跟进客户确认或取机。
        </div>
      ) : null}

      <OrderWorkflowProgress
        workflowStatus={workflowStatus}
        tone={progressTone}
        compact
        className="-mt-1"
      />
    </Link>
  );
}

function PaymentMiniLine({
  label,
  value,
  strong = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className="mt-0.5 flex min-w-0 items-center justify-between gap-1 text-[10px] leading-3">
      <span className="truncate text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 font-mono tabular-nums text-muted-foreground",
          strong && "font-semibold text-foreground",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatCompactMoney(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(value) >= 1000) {
    return `€${Math.round(value).toLocaleString("en-US")}`;
  }
  return `€${value.toFixed(0)}`;
}

function formatPhoneHint(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `尾号 ${digits.slice(-4)}` : value;
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
