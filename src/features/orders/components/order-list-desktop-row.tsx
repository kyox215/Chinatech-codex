"use client";

import type { SyntheticEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Clock, MoreHorizontal, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { DeviceUnlockListBadge } from "@/features/orders/components/device-unlock-fields";
import { fadeUp } from "@/lib/motion";
import { brandGradientStyle } from "@/lib/ui-patterns";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import {
  getWorkflowNextActions,
  getWorkflowStatusLabel,
} from "@/features/orders/model/order-workflow";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import {
  orderExceptionMeta,
  orderWorkflowMeta,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import { cn } from "@/lib/utils";

export const orderQueueDesktopGrid =
  "grid min-w-0 grid-cols-[32px_minmax(188px,1.22fr)_minmax(150px,0.92fr)_minmax(142px,0.9fr)_minmax(82px,0.48fr)_minmax(84px,0.48fr)_34px] items-center xl:grid-cols-[34px_minmax(220px,1.25fr)_minmax(180px,0.98fr)_minmax(168px,0.92fr)_minmax(96px,0.52fr)_minmax(108px,0.56fr)_34px]";

export function DesktopOrderQueueRow({
  order,
  workflow,
  checked,
  onOpen,
  onCheckedChange,
  onTransition,
  onPrint,
  onStopInteraction,
  transitionPending = false,
}: {
  order: OrderListItem;
  workflow?: OrderWorkflow;
  checked: boolean;
  onOpen: () => void;
  onCheckedChange: (checked: boolean) => void;
  onTransition: (to: RepairOrderStatus) => void;
  onPrint: () => void;
  onStopInteraction: (event: SyntheticEvent) => void;
  transitionPending?: boolean;
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
  const quickActions = allNextActions.filter((action) => !orderTransitionRequiresReason(action.to));
  const reasonRequiredCount = allNextActions.length - quickActions.length;
  const nextLabel = allNextActions[0]?.label ?? "暂无推荐流转";
  const primaryQuickAction = quickActions[0];

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
        "group relative min-h-12 cursor-pointer overflow-hidden rounded-lg border border-border/55 bg-surface/80 text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/25 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked && "border-primary/35 bg-primary/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] transition-opacity",
          checked && "opacity-100",
        )}
        style={brandGradientStyle}
      />

      <div className="px-2 py-1.5 pl-3" onClick={onStopInteraction}>
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(Boolean(value))}
          aria-label={`选择工单 ${order.public_no}`}
        />
      </div>

      <div className="min-w-0 px-2 py-1.5">
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
        <div className="mt-1 flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-muted-foreground">
            {reasonRequiredCount ? `详情处理：${nextLabel}` : `下一步：${nextLabel}`}
          </span>
          {primaryQuickAction ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 shrink-0 gap-1 rounded-md bg-card px-1.5 text-[10px]"
              disabled={transitionPending}
              onClick={(event) => {
                event.stopPropagation();
                onTransition(primaryQuickAction.to);
              }}
              aria-label={`推进工单 ${order.public_no} 到 ${primaryQuickAction.label}`}
            >
              <ArrowRight className="size-3" />
              推进
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <span
          className="block truncate font-mono text-[11px] font-semibold leading-4 text-primary"
          title={order.public_no}
        >
          {order.public_no}
        </span>
        <div className="mt-0.5 truncate font-semibold leading-4" title={order.customer_name}>
          {order.customer_name || "-"}
        </div>
        <PhoneText value={order.customer_phone} className="block truncate text-[11px] leading-4" />
        {order.accessory_notes ? (
          <div
            className="truncate text-[10px] leading-4 text-muted-foreground"
            title={order.accessory_notes}
          >
            留存：{order.accessory_notes}
          </div>
        ) : (
          <div className="truncate text-[10px] leading-4 text-muted-foreground">无留存备注</div>
        )}
        <DeviceUnlockListBadge method={order.device_unlock_method} className="mt-0.5" />
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
        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate text-[10px] leading-3 text-muted-foreground">
            {primaryRepair?.name || "待报价"}
            {extraRepairCount ? ` +${extraRepairCount}` : ""}
          </span>
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
        <div className={cn("whitespace-nowrap text-[11px] leading-4", paymentClass)}>
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
            {quickActions.length ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  下一步
                </DropdownMenuLabel>
                {quickActions.map((action, index) => (
                  <DropdownMenuItem
                    key={action.to}
                    disabled={transitionPending}
                    onClick={() => onTransition(action.to)}
                    className={cn(index === 0 && "font-medium text-primary")}
                  >
                    {index === 0 ? <ArrowRight className="mr-2 size-3.5" /> : null}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {reasonRequiredCount ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>需在详情记录原因</DropdownMenuItem>
              </>
            ) : null}
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
