"use client";

import Link from "next/link";
import { AlertTriangle, ReceiptText, Smartphone, UserRound } from "lucide-react";

import { MoneyText, PhoneText, StatusBadge } from "@/components/orders/badges";
import { DeviceUnlockListBadge } from "@/features/orders/components/device-unlock-fields";
import {
  orderExceptionMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import {
  getOrderTaskGuidance,
  getWorkflowProgressValue,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";
import type { OrderListItem } from "@/lib/repairdesk/api";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
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
  const normalizedCustomerName = normalizeComparable(order.customer_name);
  const normalizedPhone = normalizeComparable(order.customer_phone);
  const customerNameIsPhone =
    normalizedCustomerName.length > 0 && normalizedCustomerName === normalizedPhone;
  const customerLabel = order.customer_name?.trim() || order.customer_phone || "-";
  const showPhoneLine = Boolean(order.customer_phone && !customerNameIsPhone);
  const firstFaultPrice = order.fault_prices[0];
  const extraFaultCount = Math.max(0, order.fault_prices.length - 1);
  const primaryRepairLabel = firstFaultPrice?.name || "待确认维修项目";
  const deviceLabel = order.device_label || order.device_imei || "未知设备";
  const issueLabel = order.issue_description || "待补充故障描述";
  const paymentLabel = order.is_paid ? "已结清" : order.deposit_amount > 0 ? "已付押金" : "未收款";
  const primaryMoneyLabel = order.balance_amount > 0 ? "尾款" : "总额";
  const primaryMoneyAmount =
    order.balance_amount > 0 ? (
      formatCompactMoney(order.balance_amount)
    ) : (
      <MoneyText amount={order.quotation_amount} />
    );
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
        "group relative block space-y-1.5 px-2.5 py-2 transition-colors hover:bg-accent/15",
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="flex min-w-0 items-start gap-1.5 self-start">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UserRound className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <p className="truncate text-[13px] font-semibold leading-4">{customerLabel}</p>
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
            {showPhoneLine ? (
              <PhoneText
                value={order.customer_phone}
                className="block max-w-full truncate text-[10px] leading-3"
              />
            ) : null}
          </div>
        </div>

        <div className="min-w-[76px] self-end rounded-lg bg-surface-muted/45 px-2 py-1 text-right">
          <span
            className={cn(
              "inline-flex max-w-[64px] justify-center truncate rounded px-1.5 py-0.5 text-[9px] font-semibold leading-3",
              paymentStatusClass,
            )}
          >
            {paymentLabel}
          </span>
          <p
            className={cn(
              "mt-0.5 flex items-baseline justify-end gap-1 text-[10px] leading-4",
              paymentBalanceClass,
            )}
          >
            <span className="text-muted-foreground">{primaryMoneyLabel}</span>
            <span className="font-mono text-[13px] font-bold tabular-nums">
              {primaryMoneyAmount}
            </span>
          </p>
          {order.balance_amount > 0 ? (
            <p className="text-[9px] leading-3 text-muted-foreground">
              总额 <MoneyText amount={order.quotation_amount} />
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 rounded-lg bg-surface-muted/70 px-2 py-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Smartphone className="size-3 shrink-0 text-muted-foreground" />
            <p className="truncate text-[11px] font-semibold leading-4 text-foreground">
              {deviceLabel}
            </p>
            {extraFaultCount > 0 ? (
              <span className="shrink-0 rounded bg-primary/10 px-1 text-[9px] leading-3 text-primary">
                +{extraFaultCount}
              </span>
            ) : null}
          </div>
          <p className="max-w-[72px] shrink-0 truncate text-right text-[10px] font-semibold leading-3 text-muted-foreground">
            {order.technician_name || "未分配"}
          </p>
        </div>

        <p className="truncate text-[10px] leading-3 text-muted-foreground">{issueLabel}</p>

        <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden text-[9px] leading-3">
          <span className="inline-flex min-w-0 items-center gap-1 rounded bg-card/80 px-1.5 py-0.5 font-semibold text-foreground">
            <ReceiptText className="size-2.5 shrink-0 text-primary" />
            <span className="truncate">{primaryRepairLabel}</span>
          </span>
          <DeviceUnlockListBadge
            method={order.device_unlock_method}
            className="max-w-[82px] shrink-0 px-1 py-0.5 text-[9px] leading-3"
          />
          {order.accessory_notes ? (
            <span className="min-w-0 truncate text-muted-foreground">
              留存：{order.accessory_notes}
            </span>
          ) : null}
        </div>
      </div>

      <MobileWorkflowStrip
        workflowStatus={workflowStatus}
        nextAction={guidance.nextAction}
        danger={hasOverdueException}
      />

      {hasOverdueException ? (
        <div className="rounded-md bg-status-danger/10 px-2 py-1 text-[10px] font-medium leading-3 text-status-danger-foreground">
          当前工单存在超期风险，请优先跟进客户确认或取机。
        </div>
      ) : null}
    </Link>
  );
}

function MobileWorkflowStrip({
  workflowStatus,
  nextAction,
  danger,
}: {
  workflowStatus: OrderWorkflowStatusCode;
  nextAction: string;
  danger: boolean;
}) {
  const currentIndex = getWorkflowProgressValue(workflowStatus);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-[var(--border-panel)] pt-1.5">
      <div
        className="grid min-w-0 grid-cols-5 gap-1"
        aria-label={`当前流程：${orderTaskStages[currentIndex]?.label ?? workflowStatus}`}
      >
        {orderTaskStages.map((stage, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;

          return (
            <span
              key={stage.key}
              title={stage.label}
              className={cn(
                "flex h-5 min-w-0 items-center justify-center rounded-md border text-[9px] font-semibold leading-none",
                current
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : done
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border/70 bg-card text-muted-foreground/80",
              )}
            >
              {stage.shortLabel}
            </span>
          );
        })}
      </div>
      <span
        className={cn(
          "max-w-[76px] shrink-0 truncate rounded-md px-1.5 py-1 text-right text-[10px] font-semibold leading-none",
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

function formatCompactMoney(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(value) >= 1000) {
    return `€${Math.round(value).toLocaleString("en-US")}`;
  }
  return `€${value.toFixed(0)}`;
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
