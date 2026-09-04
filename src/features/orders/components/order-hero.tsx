"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  MoreHorizontal,
  Pencil,
  Printer,
  QrCode,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrderDetail } from "@/lib/repairdesk/api";
import {
  getOrderTaskGuidance,
  orderTaskStages,
  type OrderTaskStage,
} from "@/features/orders/model/order-task-flow";
import { formatOrderDateTime } from "@/features/orders/model/order-date";
import { localizeOrderDetailBadge } from "@/features/orders/model/order-detail-i18n";
import {
  localizeOrderFlowStage,
  localizeOrderTaskGuidance,
  localizeOrderType,
} from "@/features/orders/model/order-i18n";
import { getOrderSideStatusBadges } from "@/features/orders/model/order-side-statuses";
import {
  deriveOrderFinancialState,
  isOrderCancelledForPayment,
} from "@/features/orders/model/order-payment-state";
import { detailWorkspace } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function OrderHero({
  order,
  onPrint,
  printDisabled = false,
  printPending = false,
  printDisabledReason,
  onRevokeCustomerStatusLinks,
  customerStatusRevokePending = false,
  onCancel,
  canCancel = false,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  storeName = "",
  isEditing = false,
  editPending = false,
  editSaveDisabled = false,
  showBackLink = true,
  surface = "page",
  onClose,
  currentStage,
  currentStageIndex = 0,
  nextActionLabel,
  taskHint,
  approvalDecisionAvailable = false,
  financeSummary,
  contextualStatus,
  printRecovery,
}: {
  order: OrderDetail["order"];
  onPrint: () => void;
  printDisabled?: boolean;
  printPending?: boolean;
  printDisabledReason?: string;
  onRevokeCustomerStatusLinks?: () => void;
  customerStatusRevokePending?: boolean;
  onCancel: () => void;
  canCancel?: boolean;
  onEdit?: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  storeName?: string;
  isEditing?: boolean;
  editPending?: boolean;
  editSaveDisabled?: boolean;
  showBackLink?: boolean;
  surface?: "page" | "dialog";
  onClose?: () => void;
  currentStage?: OrderTaskStage;
  currentStageIndex?: number;
  nextActionLabel?: string;
  taskHint?: string;
  approvalDecisionAvailable?: boolean;
  financeSummary?: ReactNode;
  contextualStatus?: ReactNode;
  printRecovery?: ReactNode;
}) {
  const { locale, t } = useLocale();
  const sideBadges = getOrderSideStatusBadges(order);
  const guidance = localizeOrderTaskGuidance(getOrderTaskGuidance(order), t);
  const activeStageSource = currentStage ?? guidance.stage;
  const activeStage = {
    ...activeStageSource,
    ...localizeOrderFlowStage(activeStageSource, t),
  };
  const localizedStages = orderTaskStages.map((stage) => localizeOrderFlowStage(stage, t));
  const safeCurrentStageIndex = Math.max(
    0,
    Math.min(currentStageIndex, orderTaskStages.length - 1),
  );
  const primaryActionLabel =
    nextActionLabel ??
    (approvalDecisionAvailable ? t("orders2b2.hero.approval") : guidance.nextAction);
  const progressPercent = Math.max(
    0,
    Math.min(100, (safeCurrentStageIndex / Math.max(1, orderTaskStages.length - 1)) * 100),
  );
  const stageGridStyle = {
    gridTemplateColumns: `repeat(${orderTaskStages.length}, minmax(0, 1fr))`,
  };
  const showFinanceReadiness = !order.finance_redacted && !isOrderCancelledForPayment(order);
  const financialState = deriveOrderFinancialState(order);
  const readiness = [
    { label: t("orders2b2.hero.customerPhone"), done: Boolean(order.customer_phone?.trim()) },
    { label: t("orders2b2.hero.deviceModel"), done: Boolean(order.device_label?.trim()) },
    ...(showFinanceReadiness
      ? [
          {
            label: t("orders2b2.hero.repairQuote"),
            done: order.fault_prices.length > 0 || order.quotation_amount > 0,
          },
          {
            label: t("orders2b2.hero.balance"),
            done:
              financialState.settlement === "settled" ||
              financialState.settlement === "zero_charge" ||
              financialState.settlement === "refunded" ||
              activeStage.key !== "pickup",
          },
        ]
      : []),
  ];
  const missingCount = readiness.filter((item) => !item.done).length;
  const missingItems = readiness.filter((item) => !item.done);
  const heroActions = (
    <div className="flex min-w-0 shrink-0 items-center justify-end gap-1">
      {printDisabled && printRecovery ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="relative size-11 border-status-warn-foreground/30 text-status-warn-foreground lg:size-7"
              aria-label={t("orders2b2.hero.printRecovery", {
                reason: printDisabledReason ?? t("orders2b2.hero.printUnavailable"),
              })}
              title={printDisabledReason ?? t("orders2b2.hero.printUnavailable")}
            >
              <Printer className="size-4" />
              <span
                className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-warn-foreground"
                aria-hidden="true"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(380px,calc(100vw-24px))] p-2"
            aria-label={t("orders2b2.hero.printConfig")}
          >
            {printRecovery}
          </PopoverContent>
        </Popover>
      ) : (
        <Button
          size="icon"
          variant="outline"
          className="size-11 lg:size-7"
          disabled={printDisabled}
          aria-busy={printPending}
          onClick={onPrint}
          aria-label={
            printDisabled
              ? (printDisabledReason ?? t("orders2b2.hero.printUnavailable"))
              : t("orders2b2.hero.print")
          }
          title={
            printDisabled
              ? (printDisabledReason ?? t("orders2b2.hero.printUnavailable"))
              : t("orders2b2.hero.print")
          }
        >
          <Printer className="size-4" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="size-11 lg:size-7"
            aria-label={t("orders2b2.hero.more")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              const copy = navigator.clipboard?.writeText(window.location.href);
              if (!copy) return;
              void copy
                .then(() => toast.success(t("orders2b2.hero.linkCopied")))
                .catch(() => toast.error(t("orders2b2.hero.copyFailed")));
            }}
          >
            {t("orders2b2.hero.copyLink")}
          </DropdownMenuItem>
          {onRevokeCustomerStatusLinks ? (
            <DropdownMenuItem
              disabled={customerStatusRevokePending}
              onClick={onRevokeCustomerStatusLinks}
            >
              <QrCode className="mr-2 size-3.5" />
              {customerStatusRevokePending
                ? t("orders2b2.hero.resettingQr")
                : t("orders2b2.hero.resetQr")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={!canCancel}
            onClick={onCancel}
          >
            <XCircle className="mr-2 size-3.5" />
            {canCancel ? t("orders2b2.hero.cancelOrder") : t("orders2b2.hero.cancelUnavailable")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isEditing ? (
        <>
          <Button
            size="sm"
            disabled={editPending || editSaveDisabled}
            onClick={onSaveEdit}
            className="h-7 gap-1 border-0 px-2 text-[11px] text-primary-foreground lg:text-xs"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Save className="size-3.5" />
            {editPending ? t("orders2b2.hero.saving") : t("orders2b2.hero.save")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px] lg:text-xs"
            disabled={editPending}
            onClick={onCancelEdit}
          >
            <X className="size-3.5" /> {t("orders2b2.hero.cancel")}
          </Button>
        </>
      ) : onEdit ? (
        <Button
          size="sm"
          variant="outline"
          className="h-11 min-w-11 gap-1 px-3 text-xs lg:h-7 lg:min-w-0 lg:px-2 lg:text-[11px]"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" /> {t("orders2b2.hero.edit")}
        </Button>
      ) : null}
      {surface === "dialog" && onClose ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-11 lg:size-7"
          onClick={onClose}
          aria-label={t("orders2b2.close")}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );

  return (
    <div
      data-order-hero="true"
      data-order-desktop-status-card="true"
      className={cn(
        "sticky z-20 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)]/95 shadow-[var(--shadow-workspace)] backdrop-blur-xl",
        surface === "dialog"
          ? cn(detailWorkspace.flatHero, "top-0 mb-2 p-1.5 sm:mb-2 sm:p-1.5")
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
                className="size-7 shrink-0 lg:hidden"
                aria-label={t("orders2b2.backOrdersAria")}
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
                  label={activeStage.label}
                  tone={activeStage.tone}
                  className="text-[10px] lg:text-[11px] lg:leading-4"
                />
                {sideBadges.map((badge) => (
                  <StatusBadge
                    key={badge.key}
                    status={order.status}
                    label={localizeOrderDetailBadge(badge, t)}
                    tone={badge.tone}
                    className="max-w-[7rem] truncate text-[10px] lg:text-[11px] lg:leading-4"
                  />
                ))}
                <OrderTypeBadge
                  type={order.order_type}
                  label={localizeOrderType(order.order_type, t)}
                  className="text-[10px] lg:text-[11px] lg:leading-4"
                />
                {order.original_order_id && (
                  <Link
                    href={`/orders/${order.original_order_id}`}
                    className="inline-flex items-center gap-1 rounded border bg-status-warn px-1.5 py-0.5 text-[10px] leading-none text-status-warn-foreground hover:underline lg:text-xs lg:leading-4"
                  >
                    <Wrench className="size-3" /> {t("orders2b2.hero.reworkSource")}
                  </Link>
                )}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Clock3 className="size-3 shrink-0" />
                  <span className="truncate">
                    {t("orders2b2.hero.createdAt", {
                      date: formatOrderDateTime(order.created_at, locale),
                    })}
                  </span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <UserRound className="size-3 shrink-0" />
                  <span className="truncate">
                    {t("orders2b2.hero.technician", { name: order.technician_name || "-" })}
                  </span>
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

        {contextualStatus ? <div className="min-w-0">{contextualStatus}</div> : null}

        <section
          className={cn(
            "min-w-0",
            surface === "dialog" &&
              financeSummary &&
              "grid items-center gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,290px)]",
          )}
        >
          {surface === "dialog" ? (
            <div
              data-order-progress-compact="true"
              className="flex h-7 min-w-0 items-center gap-2 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]/55 px-2"
            >
              <div className="flex min-w-0 shrink items-center gap-1 text-[10px] lg:text-xs lg:leading-4">
                <span className="shrink-0 text-muted-foreground">
                  {t("orders2b2.hero.current")}
                </span>
                <span className="truncate font-semibold text-primary">{activeStage.label}</span>
              </div>
              <div
                data-order-stage-rail="true"
                role="list"
                aria-label={t("orders2b2.hero.progressAria", { stage: activeStage.label })}
                className="relative min-w-[130px] flex-1 px-1"
              >
                <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 rounded-full bg-border/80" />
                <div
                  className="absolute left-2 top-1/2 h-0.5 max-w-[calc(100%-1rem)] -translate-y-1/2 rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="relative grid items-center gap-1" style={stageGridStyle}>
                  {localizedStages.map((stage, index) => {
                    const completed = index < safeCurrentStageIndex;
                    const active = index === safeCurrentStageIndex;
                    const displayStage = active ? activeStage : stage;
                    return (
                      <span
                        key={stage.key}
                        role="listitem"
                        aria-current={active ? "step" : undefined}
                        aria-label={`${index + 1}. ${displayStage.label}${
                          completed
                            ? t("orders2b2.hero.stepComplete")
                            : active
                              ? t("orders2b2.hero.stepCurrent")
                              : t("orders2b2.hero.stepPending")
                        }`}
                        title={displayStage.label}
                        className={cn(
                          "mx-auto grid size-3.5 place-items-center rounded-full border bg-card text-[7px] font-semibold leading-none shadow-sm lg:text-[11px] lg:leading-4",
                          completed && "border-primary bg-primary text-primary-foreground",
                          active &&
                            "border-primary bg-primary/10 text-primary ring-1 ring-primary/25",
                          !completed &&
                            !active &&
                            "border-[var(--border-panel)] bg-[var(--surface-panel)] text-muted-foreground",
                        )}
                      >
                        {completed ? <Check className="size-2.5" aria-hidden="true" /> : index + 1}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex min-w-0 shrink items-center justify-end gap-1 text-right">
                <span className="hidden shrink-0 text-[10px] text-muted-foreground lg:inline lg:text-xs lg:leading-4">
                  {t("orders2b2.hero.next")}
                </span>
                <span
                  className="max-w-[9rem] truncate text-[11px] font-semibold"
                  title={taskHint ?? guidance.task}
                >
                  {primaryActionLabel}
                </span>
                {missingCount ? (
                  <span
                    data-order-readiness="true"
                    className="shrink-0 rounded-full bg-status-warn px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-warn-foreground lg:text-[11px] lg:leading-4"
                    title={missingItems
                      .map((item) => t("orders2b2.hero.missingItem", { item: item.label }))
                      .join(", ")}
                  >
                    {t("orders2b2.hero.missing", { count: missingCount })}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-status-success px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-success-foreground lg:text-[11px] lg:leading-4">
                    {t("orders2b2.hero.ready")}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
                    {t("orders2b2.hero.currentFlow")}
                  </span>
                  <span className="ml-1.5 text-xs font-semibold text-primary">
                    {activeStage.label}
                  </span>
                </div>
                <div className="flex min-w-0 items-center justify-end gap-1.5 text-right leading-4">
                  <span className="hidden text-[10px] text-muted-foreground sm:inline lg:text-xs lg:leading-4">
                    {t("orders2b2.hero.next")}
                  </span>
                  <span
                    className="max-w-[10rem] truncate text-xs font-semibold"
                    title={taskHint ?? guidance.task}
                  >
                    {primaryActionLabel}
                  </span>
                  {missingCount ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-warn px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-warn-foreground lg:text-[11px] lg:leading-4">
                      <AlertTriangle className="size-3" />
                      {t("orders2b2.hero.missing", { count: missingCount })}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-status-success px-1.5 py-0.5 text-[9px] font-semibold leading-none text-status-success-foreground lg:text-[11px] lg:leading-4">
                      {t("orders2b2.hero.ready")}
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
                <div className="relative grid gap-1" style={stageGridStyle}>
                  {localizedStages.map((stage, index) => {
                    const completed = index < safeCurrentStageIndex;
                    const active = index === safeCurrentStageIndex;
                    const displayStage = active ? activeStage : stage;
                    return (
                      <div key={stage.key} className="min-w-0 text-center">
                        <span
                          className={cn(
                            "mx-auto grid place-items-center rounded-full border bg-card text-[8px] font-semibold shadow-sm lg:text-[11px] lg:leading-4",
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
                            "mt-0.5 truncate text-[8px] leading-[9px] text-muted-foreground lg:text-[11px] lg:leading-4",
                            active && "font-semibold text-primary",
                          )}
                        >
                          {displayStage.label}
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
                      className="truncate rounded-full bg-status-warn px-1.5 py-0.5 text-[9px] font-medium leading-3 text-status-warn-foreground lg:text-[11px] lg:leading-4"
                    >
                      {t("orders2b2.hero.missingItem", { item: item.label })}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
          {surface === "dialog" && financeSummary ? (
            <div className="min-w-0 border-l border-[var(--border-panel)] pl-1.5">
              {financeSummary}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
