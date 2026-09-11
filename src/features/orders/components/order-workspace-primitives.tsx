"use client";

import {
  useId,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type MouseEventHandler,
} from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";

import { MoneyText } from "@/components/orders/badges";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export type OrderWorkspaceMoneyTone = "neutral" | "info" | "success" | "warning" | "danger";
export type OrderWorkspaceMoneyStripVariant = "status" | "finance";

/** A read-only projection of the existing quote items; editing stays with the caller. */
export function OrderWorkspaceRepairItems({
  names,
  onEdit,
  onEditClick,
  className,
  actions,
}: {
  names: string[];
  onEdit?: (trigger: HTMLButtonElement) => void;
  onEditClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  actions?: ReactNode;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const itemsId = useId();
  return (
    <section
      data-order-workbench-repairs="true"
      data-order-repairs-expanded={expanded || undefined}
      className={cn("min-w-0", className)}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3>{t("orders2b2.overview.quoteItems")}</h3>
        <span className="text-xs text-muted-foreground">{names.length}</span>
      </div>
      {names.length ? (
        <ul id={itemsId} className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-3">
          {names.map((name, index) => (
            <li
              key={index}
              data-order-repair-overflow={index >= 4 || undefined}
              className="flex min-w-0 items-start gap-2 text-xs leading-5"
            >
              <Check
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("orders2b2.overview.noQuoteItems")}</p>
      )}
      {names.length > 4 ? (
        <button
          type="button"
          className="order-workbench-items-expand min-h-11 text-xs text-primary focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          aria-controls={itemsId}
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded ? "orders2b2.mobile.collapse" : "orders2b2.mobile.historyAll")} ·{" "}
          {names.length}
        </button>
      ) : null}
      <div className="order-workbench-quote-actions">
        {onEdit || onEditClick ? (
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 border-t border-[var(--border-panel)] text-left text-xs font-medium text-primary focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${t("orders2b2.hero.edit")} · ${t("orders2b2.overview.quoteItems")}`}
            onClick={(event) => {
              if (onEditClick) onEditClick(event);
              else onEdit?.(event.currentTarget);
            }}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t("orders2b2.hero.edit")} · {t("orders2b2.overview.quoteItems")}
          </button>
        ) : null}
        {actions}
      </div>
    </section>
  );
}

/** Full text remains readable without permission to open an editor. */
export function OrderWorkspaceFullText({ text }: { text: string | null | undefined }) {
  const { t } = useLocale();
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const [hasOverflow, setHasOverflow] = useState(
    Boolean(text && (text.length > 120 || text.split("\n").length > 3)),
  );
  useEffect(() => {
    const preview = disclosureRef.current?.parentElement?.querySelector("p");
    if (!preview) return;
    const measure = () => {
      if (preview.clientHeight > 0) setHasOverflow(preview.scrollHeight > preview.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [text]);
  if (!text) return null;
  return (
    <details ref={disclosureRef} hidden={!hasOverflow} className="order-workbench-full-text">
      <summary className="min-h-11 cursor-pointer text-xs text-primary focus-visible:ring-2 focus-visible:ring-ring">
        {t("orders2b2.mobile.expandDetails")}
      </summary>
      <p className="whitespace-pre-wrap break-words">{text}</p>
    </details>
  );
}

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
  appearance?: "default" | "quote-editor" | "workbench-summary";
}) {
  const { t } = useLocale();
  if (appearance === "workbench-summary") {
    return (
      <dl
        data-order-workbench-money-summary="true"
        className={cn("order-workbench-money-summary", className)}
      >
        {[
          [t("orders2b2.finance.total"), total],
          [t("orders2b2.finance.depositPaid"), deposit],
          [t(cancelled ? "orders2b1.money.cancelledBalance" : "orders2b1.task.due"), balance],
        ].map(([label, amount], index) => (
          <div
            key={index}
            data-order-workbench-amount={
              index === 0 ? "total" : index === 1 ? "deposit" : "balance"
            }
          >
            <dt>{label}</dt>
            <dd>
              <MoneyText amount={Number(amount)} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (appearance === "quote-editor") {
    return (
      <div
        data-order-workspace-money-strip="true"
        className={cn("grid min-w-0 grid-cols-3 items-stretch gap-1.5", className)}
      >
        <div className="flex min-w-0 flex-col justify-between gap-1 rounded-lg bg-primary/5 px-2 py-1.5 max-[389px]:px-[3px]">
          <div className="whitespace-normal text-[10px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
            {t("orders2b1.money.total")}
          </div>
          <MoneyText
            amount={total}
            className={cn(
              "block min-h-8 whitespace-nowrap text-right font-mono text-base font-semibold leading-8 tabular-nums text-primary max-[389px]:text-xs",
              Math.abs(total) >= 10000 && "text-sm",
            )}
          />
        </div>
        <div
          data-new-order-field="deposit"
          className="flex min-w-0 flex-col justify-between gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 max-[389px]:px-[3px]"
        >
          <div className="whitespace-normal text-[10px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
            {t("orders2b1.money.deposit")}
          </div>
          <div className="min-w-0 [&>button]:!h-auto [&>button]:min-h-8 [&>button]:rounded-none [&>button]:border-x-0 [&>button]:border-t-0 [&>button]:bg-transparent [&>button]:px-0 [&>button]:font-semibold [&>button>span:last-child]:overflow-visible [&>button>span:last-child]:text-clip [&>button>span:last-child]:whitespace-nowrap [&>button>span:last-child]:leading-6 max-[389px]:[&>button]:grid-cols-1 max-[389px]:[&>button]:gap-0 max-[389px]:[&>button>span:first-child]:text-left max-[389px]:[&>button>span:first-child]:text-[10px] max-[389px]:[&>button>span:first-child]:leading-3 [&>div]:!h-8 [&>div]:rounded-none [&>div]:border-x-0 [&>div]:border-t-0 [&>div]:bg-transparent [&>div]:px-0 [&>div]:font-semibold [&_input]:!h-8">
            {depositControl ?? (
              <MoneyText
                amount={deposit}
                className="block min-h-8 whitespace-nowrap text-right font-mono text-base font-semibold leading-8 max-[389px]:text-xs"
              />
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 max-[389px]:px-[3px]">
          <div className="whitespace-normal text-[10px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
            {t("orders2b1.money.balance")}
          </div>
          <MoneyText
            amount={balance}
            className={cn(
              "block min-h-8 whitespace-nowrap text-right font-mono text-base font-semibold leading-8 tabular-nums max-[389px]:text-xs",
              Math.abs(balance) >= 10000 && "text-sm",
            )}
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
          "grid-cols-[minmax(0,1fr)_120px_28px] items-start gap-x-1.5 gap-y-1 rounded-none border-0 border-b border-[var(--border-panel)] bg-transparent px-0 py-1.5 sm:grid-cols-[minmax(0,1fr)_120px_28px] sm:gap-x-1.5 sm:px-0 sm:py-1.5 [&>div:nth-child(3)>button]:w-7",
        className,
      )}
    >
      <div className={cn("min-w-0", appearance === "quote-editor" && "grid min-h-9 gap-y-0.5")}>
        <div className="min-w-0">{children}</div>
        {appearance === "quote-editor" && note ? (
          <OrderWorkspaceQuoteDisclosure className="text-[11px] leading-4 text-muted-foreground">
            {note}
          </OrderWorkspaceQuoteDisclosure>
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

function OrderWorkspaceQuotePopup({
  value,
  displayValue,
  onValueChange,
  ariaLabel,
  placeholder,
  disabled,
  invalid,
  className,
  containerClassName,
}: {
  value: ReactNode;
  displayValue?: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  containerClassName?: string;
}) {
  const { t } = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const openingValue = useRef("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editable = Boolean(onValueChange);
  const title = ariaLabel || t("orders2b2.overview.quoteItems");
  const close = () => setOpen(false);
  const save = () => {
    if (disabled || !onValueChange) return;
    const nextValue = draft.replace(/[\r\n]/g, "");
    if (nextValue !== openingValue.current) onValueChange(nextValue);
    close();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && disabled) return;
        if (next) {
          openingValue.current = typeof value === "string" ? value : "";
          setDraft(openingValue.current);
        }
        setOpen(next);
      }}
    >
      <div
        data-order-quote-text-control={editable || undefined}
        data-order-quote-disclosure={!editable || undefined}
        className={cn("min-w-0", containerClassName)}
      >
        <DialogTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            data-keypad-defer-dismiss
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            aria-controls={open ? id : undefined}
            className={cn(
              "flex w-full min-w-0 items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {(displayValue ?? value) || placeholder || title}
            </span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </DialogTrigger>
      </div>
      <DialogContent
        ref={contentRef}
        id={id}
        data-order-quote-popup="true"
        data-quote-editable={editable}
        mobileEditor
        editorLayout
        aria-describedby={undefined}
        closeLabel={t("common.close")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus({ preventScroll: true });
        }}
        onEscapeKeyDown={(event) => {
          if (event.isComposing) event.preventDefault();
        }}
        className={cn(
          componentOverlay.editorSurface,
          componentOverlay.denseEditorSurface,
          "max-h-[calc(100dvh-1rem)]",
        )}
      >
        <DialogHeader className={componentOverlay.denseEditorHeader}>
          <DialogTitle className="min-w-0 break-words text-base leading-5">{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className={componentOverlay.denseEditorBody}>
          {editable ? (
            <Textarea
              rows={4}
              value={draft}
              aria-label={title}
              placeholder={placeholder}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              onChange={(event) => setDraft(event.target.value.replace(/[\r\n]/g, ""))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229)
                  return;
                event.preventDefault();
                event.stopPropagation();
                save();
              }}
              className="min-h-28 resize-none text-base leading-6 md:text-base"
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
              {displayValue ?? value}
            </div>
          )}
        </DialogBody>
        <DialogFooter className={componentOverlay.denseEditorFooter}>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            className={!editable ? "col-span-2" : undefined}
          >
            {t(editable ? "common.cancel" : "common.close")}
          </Button>
          {editable ? (
            <Button type="button" disabled={disabled} onClick={save}>
              {t("orders2b2.hero.save")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderWorkspaceQuoteTextField({
  readOnly = false,
  ...props
}: {
  value: string;
  displayValue?: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  readOnly?: boolean;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <OrderWorkspaceQuotePopup
      {...props}
      onValueChange={readOnly ? undefined : props.onValueChange}
      className={cn(
        "min-h-9 rounded-lg border px-2 py-1.5 text-base leading-5 md:text-base lg:text-sm",
        props.className,
      )}
    />
  );
}

export function OrderWorkspaceQuoteDisclosure({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <OrderWorkspaceQuotePopup value={children} className={className} />;
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
      className={cn(
        "grid-cols-[minmax(0,1fr)_112px_auto] sm:grid-cols-[minmax(0,1fr)_112px_auto]",
        className,
      )}
      price={
        <MoneyText
          amount={amount}
          className="block whitespace-nowrap text-right text-xs font-medium"
        />
      }
    >
      <OrderWorkspaceQuoteDisclosure className="text-xs font-medium">
        {name || t("orders2b1.quote.unnamedItem")}
      </OrderWorkspaceQuoteDisclosure>
      {note ? (
        <OrderWorkspaceQuoteDisclosure className="text-[11px] leading-4 text-muted-foreground">
          {note}
        </OrderWorkspaceQuoteDisclosure>
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
