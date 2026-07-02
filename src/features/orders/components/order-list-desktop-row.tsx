"use client";

import type { SyntheticEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, MoreHorizontal, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { DeviceUnlockListBadge } from "@/features/orders/components/device-unlock-fields";
import { fadeUp } from "@/lib/motion";
import { brandGradientStyle } from "@/lib/ui-patterns";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/api";
import { getWorkflowNextActions } from "@/features/orders/model/order-workflow";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { cn } from "@/lib/utils";

export const orderQueueDesktopGrid =
  "grid min-w-0 grid-cols-[30px_minmax(126px,0.82fr)_minmax(164px,1.08fr)_minmax(158px,1.02fr)_minmax(88px,0.5fr)_minmax(90px,0.52fr)_32px] items-center xl:grid-cols-[32px_minmax(146px,0.82fr)_minmax(220px,1.12fr)_minmax(214px,1.08fr)_minmax(102px,0.5fr)_minmax(110px,0.54fr)_34px]";

export function DesktopOrderQueueRow({
  order,
  workflow,
  checked,
  onOpen,
  onCheckedChange,
  onPrint,
  onStopInteraction,
}: {
  order: OrderListItem;
  workflow?: OrderWorkflow;
  checked: boolean;
  onOpen: () => void;
  onCheckedChange: (checked: boolean) => void;
  onPrint: () => void;
  onStopInteraction: (event: SyntheticEvent) => void;
}) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const exceptionStatus = order.exception_status;
  const next = getWorkflowNextActions(workflow, order.status);
  const hasOverdueException = Boolean(order.approval_overdue || order.pickup_overdue);
  const createdDate = new Date(order.created_at).toLocaleDateString("zh-CN");
  const paymentLabel = order.is_paid ? "已结清" : order.deposit_amount > 0 ? "已付押金" : "未收款";
  const paymentClass = order.is_paid
    ? "text-status-success-foreground"
    : order.deposit_amount > 0
      ? "text-status-warn-foreground"
      : "text-status-danger-foreground";
  const primaryRepair = order.fault_prices[0];
  const extraRepairCount = Math.max(0, order.fault_prices.length - 1);
  const allNextActions = [next.primary, ...next.secondary].filter(
    (action): action is NonNullable<typeof next.primary> => Boolean(action),
  );
  const nextLabel = allNextActions[0]?.label ?? "暂无下一步";
  const nextText = allNextActions.length ? `下一步：${nextLabel}` : nextLabel;

  return (
    <motion.div
      data-order-row="true"
      variants={fadeUp}
      role="button"
      aria-label={`查看工单详情 ${order.public_no}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        orderQueueDesktopGrid,
        "group relative min-h-[58px] cursor-pointer overflow-hidden rounded-md border border-border/45 bg-card/80 text-xs shadow-[0_1px_1px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/25 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked && "border-primary/35 bg-primary/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-0 w-[3px] rounded-r-full opacity-0 transition-opacity",
          checked && "opacity-100",
        )}
        style={brandGradientStyle}
      />

      <div className="px-1.5 py-1.5 pl-2.5" onClick={onStopInteraction}>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(Boolean(value))}
          aria-label={`选择工单 ${order.public_no}`}
        />
      </div>

      <div className="min-w-0 px-1.5 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <StatusBadge
            status={order.status}
            label={orderWorkflowMeta[workflowStatus].shortLabel}
            tone={orderWorkflowMeta[workflowStatus].tone}
            className="max-w-full text-[10px]"
          />
          {exceptionStatus ? (
            <StatusBadge
              status={order.status}
              label={orderExceptionMeta[exceptionStatus].shortLabel}
              tone={orderExceptionMeta[exceptionStatus].tone}
              className="max-w-full text-[10px]"
            />
          ) : null}
          {hasOverdueException ? (
            <span className="inline-flex max-w-full shrink-0 items-center gap-1 truncate whitespace-nowrap rounded bg-status-danger/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-status-danger-foreground ring-1 ring-inset ring-status-danger-foreground/30">
              <AlertTriangle className="size-2.5 shrink-0" />
              {order.approval_overdue ? "报价超期" : "取件超期"}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground" title={nextText}>
          {nextText}
        </p>
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="shrink-0 truncate font-mono text-[11px] font-semibold leading-4 text-primary"
            title={order.public_no}
          >
            {order.public_no}
          </span>
          <span className="min-w-0 truncate font-semibold leading-4" title={order.customer_name}>
            {order.customer_name || "-"}
          </span>
        </div>
        <PhoneText value={order.customer_phone} className="block truncate text-[11px] leading-4" />
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span
            className="min-w-0 truncate text-[10px] leading-4 text-muted-foreground"
            title={order.accessory_notes || "无留存备注"}
          >
            {order.accessory_notes ? `留存：${order.accessory_notes}` : "无留存"}
          </span>
          <DeviceUnlockListBadge method={order.device_unlock_method} className="shrink-0" />
        </div>
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <div className="truncate font-medium leading-4" title={order.device_label}>
          {order.device_label || "-"}
        </div>
        <div
          className="truncate text-[11px] leading-4 text-muted-foreground"
          title={order.issue_description}
        >
          {order.issue_description || "-"}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[10px] leading-3 text-muted-foreground">
            {primaryRepair?.name || "待报价"}
            {extraRepairCount ? ` +${extraRepairCount}` : ""}
          </span>
          {primaryRepair ? (
            <MoneyText
              amount={primaryRepair.price}
              className="shrink-0 text-[10px] font-semibold leading-3 text-foreground"
            />
          ) : null}
        </div>
        {order.device_imei ? (
          <div
            className="hidden truncate font-mono text-[10px] leading-4 text-muted-foreground xl:block"
            title={order.device_imei}
          >
            IMEI {order.device_imei.slice(-10)}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 px-2 py-1.5 text-right">
        <MoneyText
          amount={order.quotation_amount}
          className="whitespace-nowrap text-sm font-semibold"
        />
        <div className={cn("whitespace-nowrap text-[10px] leading-4", paymentClass)}>
          {paymentLabel}
        </div>
        <div
          className={cn(
            "whitespace-nowrap text-[10px] leading-3",
            order.balance_amount > 0 ? "text-status-danger-foreground" : "text-muted-foreground",
          )}
        >
          {order.balance_amount > 0 ? (
            <>
              尾款 <MoneyText amount={order.balance_amount} />
            </>
          ) : (
            "尾款清"
          )}
        </div>
      </div>

      <div className="min-w-0 px-2 py-1.5 text-[11px] text-muted-foreground">
        <div
          className="truncate font-semibold leading-4 text-foreground"
          title={order.technician_name}
        >
          {order.technician_name || "-"}
        </div>
        <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
          <Clock className="size-3 shrink-0" />
          {createdDate}
        </div>
        <div className="mt-0.5">
          <OrderTypeBadge type={order.order_type} className="max-w-full text-[10px]" />
        </div>
      </div>

      <div className="px-1.5 py-1.5" onClick={onStopInteraction}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="更多工单操作">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/orders/${order.id}`}>在新页打开</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrint}>
              <Printer className="mr-2 size-3.5" /> 打印
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
