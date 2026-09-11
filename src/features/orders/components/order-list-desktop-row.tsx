"use client";

import {
  useEffect,
  useRef,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { motion } from "framer-motion";
import { ChevronRight, Clock, MoreHorizontal, PackageSearch, Printer } from "lucide-react";

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
} from "@/components/orders/badges";
import { DeviceUnlockListBadge } from "@/features/orders/components/device-unlock-fields";
import { OrderListStatus } from "@/features/orders/components/order-list-status";
import { getOrderListPresentation } from "@/features/orders/model/order-list-presentation";
import {
  deriveOrderFinancialState,
  isOrderCancelledForPayment,
} from "@/features/orders/model/order-payment-state";
import { fadeUp } from "@/lib/motion";
import { brandGradientStyle } from "@/lib/ui-patterns";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import type { Supplier } from "@/lib/repairdesk/types";
import { orderQueueDesktopGrid } from "@/features/orders/components/order-list-layout";
import { ORDER_DETAIL_HOVER_DELAY_MS } from "@/features/preload/model/order-detail-preload";
import { formatOrderListDate, formatOrderRelativeDate } from "@/features/orders/model/order-date";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  localizeDeviceCustody,
  localizeDeviceUnlockMethod,
  localizeOrderFinancialLabel,
  localizeOrderType,
} from "@/features/orders/model/order-i18n";
import type { MessageKey } from "@/shared/i18n/messages";

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
  printDisabledReason,
  onOpenPrintRecovery,
  onStopInteraction,
  suppliers,
  layout = "row",
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
  printDisabledReason?: string;
  onOpenPrintRecovery?: () => void;
  onStopInteraction: (event: SyntheticEvent) => void;
  suppliers: Supplier[];
  layout?: "row" | "card";
}) {
  const { locale, t } = useLocale();
  const hoverTimerRef = useRef<number | null>(null);
  const cancelled = isOrderCancelledForPayment(order);
  const financialState = deriveOrderFinancialState(order);
  const presentation = getOrderListPresentation(order, t, workflow);
  const createdDate = formatOrderListDate(order.created_at, locale);
  const relativeCreatedDate = formatOrderRelativeDate(order.created_at, Date.now(), locale);
  const paymentLabel = localizeOrderFinancialLabel(financialState, t);
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
  const partsSupplier = suppliers.find((supplier) => supplier.id === order.parts_supplier_id);
  const customerName = getCustomerDisplayName(order.customer_name, order.customer_phone, t);

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
      data-order-id={order.id}
      data-order-row-layout={layout}
      data-selected={checked ? "true" : "false"}
      variants={fadeUp}
      role="button"
      aria-label={t("orders.viewDetails", { id: order.public_no })}
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

      <div data-order-cell="selection" className="px-1.5 py-1.5 pl-2.5" onClick={onStopInteraction}>
        {selectable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(Boolean(value))}
            aria-label={t("orders.selectOrder", { id: order.public_no })}
          />
        ) : null}
      </div>

      <div data-order-cell="identity" className="min-w-0 px-1.5 py-1.5">
        <p
          className="mb-1 truncate font-mono text-xs font-semibold text-primary"
          title={order.public_no}
        >
          {order.public_no}
        </p>
        <div
          className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground"
          title={relativeCreatedDate}
        >
          <Clock className="size-3 shrink-0" />
          {createdDate}
        </div>
        <p
          className="mt-1 truncate text-[10px] text-muted-foreground"
          title={order.technician_name}
        >
          {order.technician_name || t("orders.unassigned")}
        </p>
        <OrderTypeBadge
          type={order.order_type}
          label={localizeOrderType(order.order_type, t)}
          className="mt-1 max-w-full whitespace-normal text-[9px]"
        />
      </div>

      <div
        data-order-cell="customer"
        className="min-w-0 px-2 py-1.5"
        data-order-customer-identity="true"
      >
        <PhoneText
          value={order.customer_phone}
          className="block truncate text-xs font-semibold leading-4 text-primary xl:text-[13px] xl:leading-5"
        />
        <div
          className="truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4"
          title={customerName}
        >
          {customerName}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span
            className="min-w-0 truncate text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4"
            title={order.accessory_notes || t("orders.noAccessories")}
          >
            {order.accessory_notes
              ? t("orders.accessories", { value: order.accessory_notes })
              : t("orders.noAccessories")}
          </span>
          {order.device_unlock_method ? (
            <DeviceUnlockListBadge
              method={order.device_unlock_method}
              label={localizeDeviceUnlockMethod(order.device_unlock_method, t)}
              className="shrink-0"
            />
          ) : null}
        </div>
      </div>

      <div data-order-cell="device" className="min-w-0 px-2 py-1.5">
        <div className="truncate font-medium leading-4" title={order.device_label}>
          {order.device_label || "-"}
        </div>
        {order.device_custody_status !== "with_shop" ? (
          <DeviceCustodyBadge
            status={order.device_custody_status}
            deliveredAt={order.delivered_at}
            label={localizeDeviceCustody(order.device_custody_status, order.delivered_at, t)}
            className="mt-0.5 max-w-full text-[9px] lg:text-[11px] lg:leading-4"
          />
        ) : null}
        <div
          className="truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4"
          title={order.issue_description}
        >
          {order.issue_description || "-"}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {order.finance_redacted
              ? t("orders.quoteRestricted")
              : primaryRepair?.name || t("orders.quotePending")}
            {!order.finance_redacted && extraRepairCount ? ` +${extraRepairCount}` : ""}
          </span>
          {primaryRepair && !order.finance_redacted ? (
            <MoneyText
              amount={primaryRepair.price}
              className="shrink-0 text-[10px] font-semibold leading-3 text-foreground lg:text-xs lg:leading-4"
            />
          ) : null}
        </div>
        {partsSupplier ? (
          <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-3 text-primary lg:text-[11px] lg:leading-4">
            <PackageSearch className="size-2.5 shrink-0" />
            <span className="truncate">{partsSupplier.short_name || partsSupplier.name}</span>
          </div>
        ) : null}
        {order.device_imei ? (
          <div className="sr-only" title={order.device_imei}>
            IMEI {order.device_imei.slice(-10)}
          </div>
        ) : null}
      </div>

      <div data-order-cell="status" className="min-w-0 px-2 py-2">
        <OrderListStatus order={order} workflow={workflow} />
      </div>

      <div
        data-order-cell="finance"
        className="min-w-0 px-2 py-1.5 text-right"
        data-order-financial-summary="true"
      >
        {order.finance_redacted ? (
          <span className="text-xs text-muted-foreground">{t("orders.amountRestricted")}</span>
        ) : (
          <MoneyText
            amount={order.quotation_amount}
            className="whitespace-nowrap text-xs font-semibold xl:text-sm"
          />
        )}
        <div
          className={cn("text-[10px] leading-4 break-words lg:text-xs lg:leading-4", paymentClass)}
        >
          {paymentLabel}
        </div>
        {cancelled && !order.finance_redacted ? (
          <div className="text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
            {t("orders.excludedFromBalance")}
          </div>
        ) : null}
        {!order.finance_redacted ? (
          <div
            className={cn(
              "text-[10px] leading-3 lg:text-xs lg:leading-4",
              !cancelled && order.balance_amount > 0
                ? "text-status-danger-foreground"
                : "text-muted-foreground",
            )}
          >
            {cancelled ? (
              <>
                {t("orders.atCancellation")}{" "}
                <MoneyText
                  amount={order.balance_amount}
                  className="inline-block whitespace-nowrap"
                />
              </>
            ) : order.balance_amount > 0 ? (
              <>
                {t("orders.balanceDue")}{" "}
                <MoneyText
                  amount={order.balance_amount}
                  className="inline-block whitespace-nowrap"
                />
              </>
            ) : (
              t("orders.balanceClear")
            )}
          </div>
        ) : null}
      </div>

      <div data-order-cell="next" className="min-w-0 px-2 py-1.5" onClick={onStopInteraction}>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpen}
          data-order-next-task="true"
          title={t("orders.viewDetails", { id: order.public_no })}
          className="min-h-11 h-auto w-full justify-between gap-1 rounded-lg border border-border bg-card px-2 py-2 text-left text-[11px] font-medium text-primary whitespace-normal"
        >
          <span className="min-w-0 break-words">{presentation.nextAction}</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </div>

      <div data-order-cell="more" className="px-1.5 py-1.5" onClick={onStopInteraction}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-lg"
              aria-label={t("orders.moreActions")}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <a href={`/orders/${order.id}`}>{t("orders.openNewPage")}</a>
            </DropdownMenuItem>
            {canPrint ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={printDisabledReason ? undefined : onPrint}
                  disabled={Boolean(printDisabledReason)}
                  title={printDisabledReason}
                >
                  <Printer className="mr-2 size-3.5" /> {t("orders.print")}
                </DropdownMenuItem>
                {printDisabledReason && onOpenPrintRecovery ? (
                  <DropdownMenuItem onClick={onOpenPrintRecovery}>
                    {t("orders.printSettings")}
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

function getCustomerDisplayName(
  customerName: string | null | undefined,
  customerPhone: string | null | undefined,
  t: (key: MessageKey) => string,
) {
  const trimmedName = customerName?.trim() || "";
  const normalizedName = normalizeComparable(trimmedName);
  if (!trimmedName || (normalizedName && normalizedName === normalizeComparable(customerPhone))) {
    return t("orders.nameMissing");
  }
  return trimmedName;
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
