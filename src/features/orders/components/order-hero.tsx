"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
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
  getOrderWorkflowStatus,
  type OrderTaskStage,
} from "@/features/orders/model/order-task-flow";
import { OrderMiniProgress } from "@/features/orders/components/order-mini-progress";
import { formatOrderDateTime } from "@/features/orders/model/order-date";
import { localizeOrderDetailBadge } from "@/features/orders/model/order-detail-i18n";
import {
  localizeOrderFlowStage,
  localizeOrderTaskGuidance,
  localizeOrderType,
} from "@/features/orders/model/order-i18n";
import { getOrderSideStatusBadges } from "@/features/orders/model/order-side-statuses";
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
  statusChangedAt,
  isEditing = false,
  editPending = false,
  editSaveDisabled = false,
  showBackLink = true,
  surface = "page",
  onClose,
  currentStage,
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
  statusChangedAt?: string;
  isEditing?: boolean;
  editPending?: boolean;
  editSaveDisabled?: boolean;
  showBackLink?: boolean;
  surface?: "page" | "dialog";
  onClose?: () => void;
  currentStage?: OrderTaskStage;
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
  const primaryActionLabel =
    nextActionLabel ??
    (approvalDecisionAvailable ? t("orders2b2.hero.approval") : guidance.nextAction);
  const isTerminal =
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.status === "voided" ||
    order.status === "deleted" ||
    order.workflow_status === "closed";
  const isDanger =
    order.status === "cancelled" ||
    order.exception_status === "cancelled" ||
    order.record_state === "voided" ||
    Boolean(order.deleted_at);
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
                  <time className="truncate" dateTime={order.created_at}>
                    {t("orders2b2.hero.createdAt", {
                      date: formatOrderDateTime(order.created_at, locale),
                    })}
                  </time>
                </span>
                {statusChangedAt ? (
                  <span
                    className="inline-flex min-w-0 items-center gap-1"
                    aria-label={t("orders2b2.overview.statusAt")}
                  >
                    <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                    <time className="truncate" dateTime={statusChangedAt}>
                      {t("orders2b2.overview.statusAt")} {"·"}{" "}
                      {formatOrderDateTime(statusChangedAt, locale)}
                    </time>
                  </span>
                ) : null}
                <span className="inline-flex min-w-0 items-center gap-1">
                  <UserRound className="size-3 shrink-0" />
                  <span className="truncate">
                    {t("orders2b2.hero.technician", { name: order.technician_name || "-" })}
                  </span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Store className="size-3 shrink-0" />
                  <span className="truncate" aria-label={t("orders2b2.overview.store")}>
                    {storeName}
                  </span>
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
          <OrderMiniProgress
            workflowStatus={getOrderWorkflowStatus(order)}
            currentLabel={activeStage.label}
            nextAction={primaryActionLabel}
            danger={isDanger}
            isTerminal={isTerminal}
            className="h-1.5"
          />
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
