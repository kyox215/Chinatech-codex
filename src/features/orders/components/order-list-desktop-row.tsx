"use client";

import {
  useEffect,
  useRef,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, MoreHorizontal, PackageSearch, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DeviceCustodyBadge,
  MoneyText,
  OrderTypeBadge,
  PhoneText,
  StatusBadge,
} from "@/components/orders/badges";
import { DeviceUnlockListBadge } from "@/features/orders/components/device-unlock-fields";
import { OrderQueueStageBadge } from "@/features/orders/components/order-queue-stage-badge";
import {
  deriveOrderFinancialState,
  isOrderCancelledForPayment,
} from "@/features/orders/model/order-payment-state";
import { fadeUp } from "@/lib/motion";
import { brandGradientStyle } from "@/lib/ui-patterns";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/api";
import { getWorkflowNextActions } from "@/features/orders/model/order-workflow";
import { orderExceptionMeta } from "@/features/orders/model/canonical-order-status";
import {
  getOrderTaskGuidance,
  orderTaskStageIndex,
  orderTaskStages,
} from "@/features/orders/model/order-task-flow";
import { cn } from "@/lib/utils";
import type { Supplier } from "@/lib/repairdesk/types";
import { orderQueueDesktopGrid } from "@/features/orders/components/order-list-layout";
import { ORDER_DETAIL_HOVER_DELAY_MS } from "@/features/preload/model/order-detail-preload";
import { formatOrderListDate, formatOrderRelativeDate } from "@/features/orders/model/order-date";

export { orderQueueDesktopGrid } from "@/features/orders/components/order-list-layout";

export function DesktopOrderQueueRow({
  order,
  workflow,
  checked,
  selectable = true,
  onOpen,
  onPrefetch,
  onCancelPrefetch,
  onCheckedChange,
  onPrint,
  canPrint = true,
  onStopInteraction,
  suppliers,
}: {
  order: OrderListItem;
  workflow?: OrderWorkflow;
  checked: boolean;
  selectable?: boolean;
  onOpen: () => void;
  onPrefetch?: () => void;
  onCancelPrefetch?: () => void;
  onCheckedChange: (checked: boolean) => void;
  onPrint: () => void;
  canPrint?: boolean;
  onStopInteraction: (event: SyntheticEvent) => void;
  suppliers: Supplier[];
}) {
  const hoverTimerRef = useRef<number | null>(null);
  const exceptionStatus = order.exception_status;
  const cancelled = isOrderCancelledForPayment(order);
  const financialState = deriveOrderFinancialState(order);
  const guidance = getOrderTaskGuidance(order);
  const next = cancelled
    ? { primary: undefined, secondary: [] }
    : getWorkflowNextActions(workflow, order.status);
  const hasOverdueException = !cancelled && Boolean(order.approval_overdue || order.pickup_overdue);
  const createdDate = formatOrderListDate(order.created_at);
  const relativeCreatedDate = formatOrderRelativeDate(order.created_at);
  const paymentLabel = financialState.label;
  const paymentClass =
    financialState.settlement === "settled" || financialState.settlement === "zero_charge"
      ? "text-status-success-foreground"
      : financialState.settlement === "partial"
        ? "text-status-warn-foreground"
        : financialState.settlement === "unpaid"
          ? "text-status-danger-foreground"
          : "text-muted-foreground";
  const primaryRepair = order.fault_prices[0];
  const extraRepairCount = Math.max(0, order.fault_prices.length - 1);
  const allNextActions = [next.primary, ...next.secondary].filter(
    (action): action is NonNullable<typeof next.primary> => Boolean(action),
  );
  const nextLabel = allNextActions[0]?.label ?? "暂无下一步";
  const nextText = allNextActions.length ? `下一步：${nextLabel}` : nextLabel;
  const stageIndex = orderTaskStageIndex[guidance.stage.key] ?? 0;
  const stageStep = stageIndex + 1;
  const partsSupplier = suppliers.find((supplier) => supplier.id === order.parts_supplier_id);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current === null) return;
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };
  const isNestedControl = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest("a,button,input,[role=menuitem],[role=checkbox]"));
  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !onPrefetch) return;
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      onPrefetch();
    }, ORDER_DETAIL_HOVER_DELAY_MS);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isNestedControl(event.target)) return;
    clearHoverTimer();
    onPrefetch?.();
  };
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onPrefetch?.();
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return;
    clearHoverTimer();
    onCancelPrefetch?.();
  };

  useEffect(() => clearHoverTimer, []);

  return (
    <motion.div
      data-order-row="true"
      variants={fadeUp}
      role="button"
      aria-label={`查看工单详情 ${order.public_no}`}
      tabIndex={0}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => {
        clearHoverTimer();
        onCancelPrefetch?.();
      }}
      onPointerDown={handlePointerDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
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
        {selectable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(Boolean(value))}
            aria-label={`选择工单 ${order.public_no}`}
          />
        ) : null}
      </div>

      <div className="min-w-0 px-1.5 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <OrderQueueStageBadge order={order} className="max-w-full text-[10px]" />
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
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-mono text-[10px] leading-none text-muted-foreground">
            {stageStep}/{orderTaskStages.length}
          </span>
          <div
            className="grid min-w-0 flex-1 grid-cols-5 gap-0.5"
            aria-label={`当前进度第 ${stageStep} 步，共 ${orderTaskStages.length} 步`}
          >
            {orderTaskStages.map((stage, index) => (
              <span
                key={stage.key}
                className={cn("h-1 rounded-full bg-muted", index <= stageIndex && "bg-primary")}
              />
            ))}
          </div>
        </div>
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
            title={order.accessory_notes || "无随附物品"}
          >
            {order.accessory_notes ? `随附：${order.accessory_notes}` : "无随附物品"}
          </span>
          {order.device_unlock_method ? (
            <DeviceUnlockListBadge method={order.device_unlock_method} className="shrink-0" />
          ) : null}
        </div>
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <div className="truncate font-medium leading-4" title={order.device_label}>
          {order.device_label || "-"}
        </div>
        <DeviceCustodyBadge
          status={order.device_custody_status}
          deliveredAt={order.delivered_at}
          className="mt-0.5 max-w-full text-[9px]"
        />
        <div
          className="truncate text-[11px] leading-4 text-muted-foreground"
          title={order.issue_description}
        >
          {order.issue_description || "-"}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[10px] leading-3 text-muted-foreground">
            {order.finance_redacted ? "报价信息受限" : primaryRepair?.name || "待报价"}
            {extraRepairCount ? ` +${extraRepairCount}` : ""}
          </span>
          {primaryRepair && !order.finance_redacted ? (
            <MoneyText
              amount={primaryRepair.price}
              className="shrink-0 text-[10px] font-semibold leading-3 text-foreground"
            />
          ) : null}
        </div>
        {partsSupplier ? (
          <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-3 text-primary">
            <PackageSearch className="size-2.5 shrink-0" />
            <span className="truncate">{partsSupplier.short_name || partsSupplier.name}</span>
          </div>
        ) : null}
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
        {order.finance_redacted ? (
          <span className="whitespace-nowrap text-xs text-muted-foreground">金额受限</span>
        ) : (
          <MoneyText
            amount={order.quotation_amount}
            className="whitespace-nowrap text-sm font-semibold"
          />
        )}
        <div className={cn("whitespace-nowrap text-[10px] leading-4", paymentClass)}>
          {paymentLabel}
        </div>
        {cancelled && !order.finance_redacted ? (
          <div className="whitespace-nowrap text-[9px] leading-3 text-muted-foreground">
            不计入待收
          </div>
        ) : null}
        {!order.finance_redacted ? (
          <div
            className={cn(
              "whitespace-nowrap text-[10px] leading-3",
              !cancelled && order.balance_amount > 0
                ? "text-status-danger-foreground"
                : "text-muted-foreground",
            )}
          >
            {cancelled ? (
              <>
                取消时 <MoneyText amount={order.balance_amount} />
              </>
            ) : order.balance_amount > 0 ? (
              <>
                尾款 <MoneyText amount={order.balance_amount} />
              </>
            ) : (
              "尾款清"
            )}
          </div>
        ) : null}
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
        <div className="truncate text-[10px] leading-3" title={relativeCreatedDate}>
          {relativeCreatedDate}
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
              <a href={`/orders/${order.id}`}>在新页打开</a>
            </DropdownMenuItem>
            {canPrint ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onPrint}>
                  <Printer className="mr-2 size-3.5" /> 打印
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
