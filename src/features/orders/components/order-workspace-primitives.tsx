"use client";

import type { ComponentType, ReactNode } from "react";

import { MoneyText } from "@/components/orders/badges";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export type OrderWorkspaceMoneyTone = "neutral" | "info" | "success" | "warning" | "danger";
export type OrderWorkspaceMoneyStripVariant = "status" | "finance";

const moneyToneClass: Record<OrderWorkspaceMoneyTone, string> = {
  neutral: "border-[var(--border-panel)] bg-card text-foreground",
  info: "border-status-info-foreground/20 bg-status-info/10 text-status-info-foreground",
  success:
    "border-status-success-foreground/20 bg-status-success/10 text-status-success-foreground",
  warning: "border-status-warn-foreground/20 bg-status-warn/15 text-status-warn-foreground",
  danger: "border-status-danger-foreground/20 bg-status-danger/10 text-status-danger-foreground",
};

export function OrderWorkspaceSectionHeader({
  title,
  icon: Icon,
  description,
  action,
  className,
}: {
  title: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        {Icon ? <Icon className="size-3 shrink-0 text-primary" /> : null}
        <div className="min-w-0">
          <h3 className="truncate text-[11px] font-semibold leading-4 text-foreground lg:text-[13px] lg:leading-5">
            {title}
          </h3>
          {description ? (
            <p className="truncate text-[9px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function OrderWorkspaceMoneyStrip({
  total,
  deposit,
  balance,
  className,
  itemClassName,
  compact = false,
  variant = "status",
  cancelled = false,
  depositControl,
  appearance = "default",
}: {
  total: number;
  deposit: number;
  balance: number;
  className?: string;
  itemClassName?: string;
  compact?: boolean;
  variant?: OrderWorkspaceMoneyStripVariant;
  cancelled?: boolean;
  depositControl?: ReactNode;
  appearance?: "default" | "quote-editor";
}) {
  const { t } = useLocale();
  if (appearance === "quote-editor") {
    return (
      <div
        data-order-workspace-money-strip="true"
        className={cn("grid min-w-0 grid-cols-3 items-stretch gap-1.5", className)}
      >
        <div className="min-w-0 rounded-lg bg-primary/5 px-2 py-1">
          <div className="text-[10px] leading-4 text-muted-foreground">
            {t("orders2b1.money.total")}
          </div>
          <MoneyText
            amount={total}
            className="flex h-[25px] items-center justify-end truncate font-mono text-base font-semibold tabular-nums text-primary"
          />
        </div>
        <div
          data-new-order-field="deposit"
          className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1"
        >
          <div className="text-[10px] leading-4 text-muted-foreground">
            {t("orders2b1.money.deposit")}
          </div>
          <div className="min-w-0 [&>button]:!h-[25px] [&>button]:min-h-0 [&>button]:rounded-none [&>button]:border-x-0 [&>button]:border-t-0 [&>button]:bg-transparent [&>button]:px-0 [&>button]:font-semibold [&>div]:!h-[25px] [&>div]:rounded-none [&>div]:border-x-0 [&>div]:border-t-0 [&>div]:bg-transparent [&>div]:px-0 [&>div]:font-semibold [&_input]:!h-[25px]">
            {depositControl ?? (
              <MoneyText
                amount={deposit}
                className="flex h-[25px] items-center justify-end font-mono text-base font-semibold"
              />
            )}
          </div>
        </div>
        <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1">
          <div className="text-[10px] leading-4 text-muted-foreground">
            {t("orders2b1.money.balance")}
          </div>
          <MoneyText
            amount={balance}
            className="flex h-[25px] items-center justify-end truncate font-mono text-base font-semibold tabular-nums"
          />
        </div>
      </div>
    );
  }
  const financeVariant = variant === "finance";
  const totalTone: OrderWorkspaceMoneyTone = financeVariant
    ? "info"
    : total > 0
      ? "info"
      : "neutral";
  const depositTone: OrderWorkspaceMoneyTone =
    deposit > total ? "danger" : financeVariant ? "success" : deposit > 0 ? "warning" : "neutral";
  const balanceTone: OrderWorkspaceMoneyTone = cancelled
    ? "neutral"
    : balance <= 0 && total > 0
      ? "success"
      : financeVariant
        ? "warning"
        : balance > 0
          ? "warning"
          : "neutral";

  return (
    <div
      data-order-workspace-money-strip="true"
      className={cn("grid min-w-0 grid-cols-3 gap-1.5", className)}
    >
      <OrderWorkspaceMoneyTile
        label={t("orders2b1.money.total")}
        amount={total}
        tone={totalTone}
        strong
        compact={compact}
        emphasizeTone={financeVariant}
        className={itemClassName}
      />
      {depositControl ? (
        <div
          data-new-order-field="deposit"
          className={cn(
            "min-w-0 rounded-lg border px-1.5 py-1",
            moneyToneClass[depositTone],
            compact && "rounded-md px-2 py-1",
            financeVariant &&
              "shadow-[inset_0_1px_0_color-mix(in_oklch,currentColor_12%,transparent)]",
            itemClassName,
          )}
        >
          <div
            className={cn(
              "truncate font-semibold leading-3",
              compact ? "text-[10px]" : "text-[9px]",
              "lg:text-xs lg:leading-4",
            )}
          >
            {t("orders2b1.money.deposit")}
          </div>
          <div className="mt-0.5 min-w-0">{depositControl}</div>
        </div>
      ) : (
        <OrderWorkspaceMoneyTile
          label={t("orders2b1.money.deposit")}
          amount={deposit}
          tone={depositTone}
          compact={compact}
          emphasizeTone={financeVariant}
          className={itemClassName}
        />
      )}
      <OrderWorkspaceMoneyTile
        label={t(cancelled ? "orders2b1.money.cancelledBalance" : "orders2b1.money.balance")}
        amount={balance}
        tone={balanceTone}
        strong={!cancelled && balance > 0}
        compact={compact}
        emphasizeTone={financeVariant}
        className={itemClassName}
      />
    </div>
  );
}

export function OrderWorkspaceMoneyTile({
  label,
  amount,
  tone = "neutral",
  strong,
  compact = false,
  emphasizeTone = false,
  className,
}: {
  label: ReactNode;
  amount: number;
  tone?: OrderWorkspaceMoneyTone;
  strong?: boolean;
  compact?: boolean;
  emphasizeTone?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-1.5 py-1",
        moneyToneClass[tone],
        compact && "rounded-md px-2 py-1",
        emphasizeTone && "shadow-[inset_0_1px_0_color-mix(in_oklch,currentColor_12%,transparent)]",
        className,
      )}
    >
      <div
        className={cn(
          "truncate font-semibold leading-3",
          compact ? "text-[10px]" : "text-[9px]",
          "lg:text-xs lg:leading-4",
          tone === "neutral" && "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <MoneyText
        amount={amount}
        className={cn(
          "mt-0.5 block truncate font-mono font-semibold leading-4 tabular-nums",
          compact ? "text-xs" : "text-[11px]",
          "lg:text-xs lg:leading-4",
          strong && !emphasizeTone && "text-foreground",
        )}
      />
    </div>
  );
}

export function OrderWorkspaceQuoteRow({
  children,
  price,
  action,
  priceFullWidth = false,
  className,
  appearance = "default",
  note,
  priceMessage,
}: {
  children: ReactNode;
  price: ReactNode;
  action?: ReactNode;
  priceFullWidth?: boolean;
  className?: string;
  appearance?: "default" | "quote-editor";
  note?: ReactNode;
  priceMessage?: ReactNode;
}) {
  return (
    <div
      data-order-workspace-quote-row="true"
      className={cn(
        "grid min-w-0 items-center gap-1 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1 sm:gap-1.5 sm:p-2",
        priceFullWidth
          ? "grid-cols-[minmax(0,1fr)_auto]"
          : "grid-cols-[minmax(0,1fr)_78px_auto] sm:grid-cols-[minmax(0,1fr)_96px_auto]",
        appearance === "quote-editor" &&
          "grid-cols-[minmax(0,1fr)_82px_28px] items-start gap-x-1 gap-y-1 rounded-none border-0 border-b border-[var(--border-panel)] bg-transparent px-0 py-1 sm:grid-cols-[minmax(0,1fr)_96px_28px] sm:gap-x-1 sm:px-0 sm:py-1 [&>div:nth-child(3)>button]:w-7",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0",
          appearance === "quote-editor" && "flex min-h-9 flex-wrap items-center gap-x-1.5",
        )}
      >
        <div className={cn("min-w-0", appearance === "quote-editor" && "flex-[1_1_5rem]")}>
          {children}
        </div>
        {appearance === "quote-editor" && note ? (
          <div className="min-w-0 max-w-full text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
            {note}
          </div>
        ) : null}
      </div>
      <div className={cn("min-w-0", priceFullWidth && "col-span-2 row-start-2")}>{price}</div>
      {action ? (
        <div className={cn("shrink-0", priceFullWidth && "col-start-2 row-start-1")}>{action}</div>
      ) : null}
      {(appearance !== "quote-editor" && note) || priceMessage ? (
        <div
          data-order-quote-secondary
          className="col-span-full grid min-w-0 grid-cols-subgrid items-start gap-x-2"
        >
          <div className="min-w-0">{appearance !== "quote-editor" ? note : null}</div>
          <div className="col-span-2 min-w-0">{priceMessage}</div>
        </div>
      ) : null}
    </div>
  );
}

export function OrderWorkspaceQuoteDisplayRow({
  name,
  note,
  amount,
  className,
}: {
  name: string;
  note?: string;
  amount: number;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <OrderWorkspaceQuoteRow
      className={className}
      price={
        <MoneyText amount={amount} className="block truncate text-right text-xs font-medium" />
      }
    >
      <div className="truncate text-xs font-medium" title={name}>
        {name || t("orders2b1.quote.unnamedItem")}
      </div>
      {note ? (
        <div
          className="truncate text-[11px] leading-4 text-muted-foreground lg:text-[11px]"
          title={note}
        >
          {note}
        </div>
      ) : null}
    </OrderWorkspaceQuoteRow>
  );
}

export function OrderWorkspaceEmptyBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-order-workspace-empty-block="true"
      className={cn(
        "rounded-lg border border-dashed border-[var(--border-panel)] bg-background/60 px-2 py-2 text-center text-[10px] leading-4 text-muted-foreground lg:text-xs lg:leading-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
