"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown } from "lucide-react";

import { MoneyText } from "@/components/orders/badges";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
          "grid-cols-[minmax(0,1fr)_112px_28px] items-start gap-x-1.5 gap-y-1 rounded-none border-0 border-b border-[var(--border-panel)] bg-transparent px-0 py-1.5 sm:grid-cols-[minmax(0,1fr)_112px_28px] sm:gap-x-1.5 sm:px-0 sm:py-1.5 [&>div:nth-child(3)>button]:w-7",
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

function useQuoteDisclosureEscape(
  ref: RefObject<HTMLElement | null>,
  isExpanded: () => boolean,
  collapse: () => void,
) {
  useLayoutEffect(() => {
    const ownerWindow = ref.current?.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.isComposing ||
        !isExpanded() ||
        !(event.target instanceof Node) ||
        !ref.current?.contains(event.target)
      )
        return;
      // Radix listens on document capture. Claim only this expanded control's
      // Escape before that listener so the surrounding editor stays open.
      event.preventDefault();
      event.stopPropagation();
      collapse();
    };
    ownerWindow.addEventListener("keydown", handleEscape, true);
    return () => ownerWindow.removeEventListener("keydown", handleEscape, true);
  }, [ref, isExpanded, collapse]);
}

export function OrderWorkspaceQuoteTextField({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  disabled,
  invalid,
  className,
  containerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  containerClassName?: string;
}) {
  const { t } = useLocale();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useQuoteDisclosureEscape(
    controlRef,
    () => expanded,
    () => {
      setExpanded(false);
      toggleRef.current?.focus();
    },
  );
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => {
      const style = getComputedStyle(field);
      const border =
        (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      if (!expanded) {
        const line = parseFloat(style.lineHeight) || 20;
        const padding =
          (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        field.style.height = `${Math.max(line + padding + border, parseFloat(style.minHeight) || 0)}px`;
        return;
      }
      field.style.height = "0px";
      field.style.height = `${field.scrollHeight + border}px`;
    };
    resize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    let width = field.getBoundingClientRect().width;
    let resizeFrame: number | undefined;
    const observer = new ResizeObserver(() => {
      const nextWidth = field.getBoundingClientRect().width;
      if (nextWidth === 0 || nextWidth === width) return;
      width = nextWidth;
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      // ResizeObserver delivers before paint; writing this observed height inside its
      // callback can produce an undelivered-notification loop in WebKit.
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        resize();
      });
    });
    observer.observe(field);
    return () => {
      observer.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
    };
  }, [value, expanded]);
  return (
    <div
      ref={controlRef}
      data-order-quote-text-control="true"
      data-expanded={expanded}
      className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)_24px] items-start", containerClassName)}
    >
      <Textarea
        ref={ref}
        id={id}
        data-order-quote-text-field="true"
        rows={1}
        wrap={expanded ? "soft" : "off"}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onFocus={() => setExpanded(true)}
        onClick={() => setExpanded(true)}
        onChange={(event) => onValueChange(event.target.value.replace(/[\r\n]/g, ""))}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229)
            return;
          // Match the former single-line input: Enter may submit, but never adds a name newline.
          event.preventDefault();
          const form = event.currentTarget.form;
          if (!form) return;
          const defaultButton = Array.from(
            form.ownerDocument.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
              "button, input",
            ),
          ).find(
            (control) =>
              control.form === form &&
              (control.type === "submit" ||
                (control instanceof HTMLInputElement && control.type === "image")),
          );
          if (defaultButton) {
            if (!defaultButton.matches(":disabled")) defaultButton.click();
            return;
          }
          // These growing fields replace text inputs, including their implicit-submit blocking.
          const blockingTypes = new Set([
            "text",
            "search",
            "tel",
            "url",
            "email",
            "password",
            "date",
            "month",
            "week",
            "time",
            "datetime-local",
            "number",
          ]);
          const blockers = Array.from(form.elements).filter(
            (control) =>
              (control instanceof HTMLInputElement && blockingTypes.has(control.type)) ||
              control.hasAttribute("data-order-quote-text-field"),
          );
          if (blockers.length <= 1) form.requestSubmit();
        }}
        className={cn(
          "min-h-9 resize-none overflow-hidden whitespace-pre-wrap rounded-lg px-2 py-1.5 text-base leading-5 shadow-none [overflow-wrap:anywhere] md:text-base lg:text-sm",
          className,
          "h-auto",
          expanded ? "whitespace-pre-wrap" : "whitespace-nowrap",
        )}
      />
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={expanded ? `${t("common.close")} · ${ariaLabel}` : ariaLabel}
        aria-expanded={expanded}
        aria-controls={id}
        className="h-full max-h-9 w-6 rounded-md text-muted-foreground"
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronDown className={cn("size-3", expanded && "rotate-180")} aria-hidden="true" />
      </Button>
    </div>
  );
}

export function OrderWorkspaceQuoteDisclosure({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useQuoteDisclosureEscape(
    ref,
    () => Boolean(ref.current?.open),
    () => {
      if (!ref.current) return;
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    },
  );
  return (
    <details
      ref={ref}
      data-order-quote-disclosure="true"
      className={cn("group min-w-0", className)}
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-start gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate group-open:overflow-visible group-open:whitespace-normal group-open:[overflow-wrap:anywhere]">
          {children}
        </span>
        <ChevronDown
          className="mt-0.5 size-3 shrink-0 text-muted-foreground group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
    </details>
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
