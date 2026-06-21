"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Filter, Search, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { brandGradientStyle, pageHeader, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export interface RepairOsMobilePageProps {
  children: ReactNode;
  className?: string;
}

export function RepairOsMobilePage({ children, className }: RepairOsMobilePageProps) {
  return <div className={cn(repairOs.mobilePage, className)}>{children}</div>;
}

export interface RepairOsModuleHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function RepairOsModuleHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: RepairOsModuleHeaderProps) {
  if (!title && !subtitle && !eyebrow && !action) return null;

  if (!title && !subtitle && !eyebrow) {
    return (
      <header className={cn("flex min-w-0 justify-end", className)}>
        <div className={pageHeader.actions}>{action}</div>
      </header>
    );
  }

  return (
    <header className={cn(pageHeader.compact, className)}>
      <div className={pageHeader.titleGroup}>
        {eyebrow ? <p className={pageHeader.eyebrow}>{eyebrow}</p> : null}
        {title ? <h1 className={pageHeader.compactTitle}>{title}</h1> : null}
        {subtitle ? <p className={pageHeader.subtitle}>{subtitle}</p> : null}
      </div>
      {action ? <div className={pageHeader.actions}>{action}</div> : null}
    </header>
  );
}

export interface RepairOsSectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  iconClassName?: string;
  iconWrapperClassName?: string;
  iconFrame?: boolean;
  headingLevel?: 2 | 3 | 4;
}

export function RepairOsSectionHeader({
  title,
  description,
  icon: Icon,
  action,
  className,
  bodyClassName,
  titleClassName,
  descriptionClassName,
  iconClassName,
  iconWrapperClassName,
  iconFrame = true,
  headingLevel = 2,
}: RepairOsSectionHeaderProps) {
  const HeadingTag = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <div className={cn(repairOs.adminSectionHeader, className)}>
      <div className={cn("flex min-w-0 items-center gap-2", bodyClassName)}>
        {Icon ? (
          iconFrame ? (
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary",
                iconWrapperClassName,
              )}
            >
              <Icon className={cn("size-3.5", iconClassName)} />
            </span>
          ) : (
            <Icon className={cn("size-4 shrink-0 text-primary", iconClassName)} />
          )
        ) : null}
        <div className="min-w-0">
          <HeadingTag className={cn(repairOs.adminSectionTitle, titleClassName)}>
            {title}
          </HeadingTag>
          {description ? (
            <p
              className={cn(
                "truncate text-[11px] leading-4 text-muted-foreground",
                descriptionClassName,
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const infoTileFrameClass = {
  soft: "min-w-0 rounded-xl bg-[var(--surface-panel-muted)] px-2 py-1.5",
  bordered:
    "min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5",
  plain: "min-w-0",
} as const;

export interface RepairOsInfoTileProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  frame?: keyof typeof infoTileFrameClass;
  bodyClassName?: string;
  leadingClassName?: string;
  trailingClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  metaClassName?: string;
}

export function RepairOsInfoTile({
  label,
  value,
  meta,
  leading,
  trailing,
  frame = "soft",
  className,
  bodyClassName,
  leadingClassName,
  trailingClassName,
  labelClassName,
  valueClassName,
  metaClassName,
  ...props
}: RepairOsInfoTileProps) {
  const hasSlots = Boolean(leading || trailing);

  return (
    <div
      className={cn(
        infoTileFrameClass[frame],
        hasSlots && "flex items-center justify-between gap-2",
        className,
      )}
      {...props}
    >
      {leading ? <div className={cn("shrink-0", leadingClassName)}>{leading}</div> : null}
      <div className={cn("min-w-0", bodyClassName)}>
        <div className={cn("truncate text-[10px] leading-3 text-muted-foreground", labelClassName)}>
          {label}
        </div>
        <div className={cn("mt-0.5 min-w-0 break-words text-xs leading-4", valueClassName)}>
          {value}
        </div>
        {meta ? (
          <div
            className={cn(
              "mt-0.5 truncate text-[10px] leading-3 text-muted-foreground",
              metaClassName,
            )}
          >
            {meta}
          </div>
        ) : null}
      </div>
      {trailing ? <div className={cn("shrink-0", trailingClassName)}>{trailing}</div> : null}
    </div>
  );
}

export interface RepairOsInfoGridRow {
  label: ReactNode;
  value: ReactNode;
  key?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export interface RepairOsInfoGridProps {
  rows: RepairOsInfoGridRow[];
  className?: string;
  rowClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function RepairOsInfoGrid({
  rows,
  className,
  rowClassName,
  labelClassName,
  valueClassName,
}: RepairOsInfoGridProps) {
  return (
    <dl className={cn("grid gap-1 text-[11px] leading-4", className)}>
      {rows.map((row, index) => (
        <div
          key={row.key ?? `info-row-${index}`}
          className={cn(
            "grid grid-cols-[70px_minmax(0,1fr)] gap-2 sm:grid-cols-[76px_minmax(0,1fr)]",
            rowClassName,
            row.className,
          )}
        >
          <dt className={cn("truncate text-muted-foreground", labelClassName, row.labelClassName)}>
            {row.label}
          </dt>
          <dd className={cn("min-w-0 break-words font-medium", valueClassName, row.valueClassName)}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface RepairOsInfoLineProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  divider?: boolean;
}

export function RepairOsInfoLine({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
  divider = true,
  ...props
}: RepairOsInfoLineProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 text-[10px] leading-4",
        divider && "border-b border-border/40 pb-1 last:border-0",
        className,
      )}
      {...props}
    >
      <span className={cn("shrink-0 text-muted-foreground", labelClassName)}>{label}</span>
      <span className={cn("min-w-0 truncate text-right font-medium", valueClassName)}>{value}</span>
    </div>
  );
}

export interface RepairOsListHeaderChip {
  key: string;
  label: string;
  shortLabel?: string;
  count?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export interface RepairOsListScaffoldProps {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  desktopAction?: ReactNode;
  desktopHeaderAddon?: ReactNode;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filterAction?: ReactNode;
  chips?: RepairOsListHeaderChip[];
  chipsLabel?: string;
  desktopHeader?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function RepairOsListScaffold({
  title,
  subtitle,
  eyebrow,
  action,
  desktopAction,
  desktopHeaderAddon,
  searchValue,
  searchPlaceholder = "搜索",
  onSearchChange,
  filterAction,
  chips = [],
  chipsLabel = "状态分组",
  desktopHeader,
  children,
  className,
}: RepairOsListScaffoldProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const hasSearch = typeof searchValue === "string" && onSearchChange;
  const offsetStyle = {
    "--repair-os-list-header-offset": `${headerHeight + 8}px`,
  } as CSSProperties;
  const resolvedDesktopHeader =
    desktopHeader ??
    (title || subtitle || eyebrow || action ? (
      <div className="mb-3 space-y-3 sm:mb-4">
        <RepairOsModuleHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          action={desktopAction ?? action}
        />
        {desktopHeaderAddon}
      </div>
    ) : null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeight = () => {
      setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div className={cn(repairOs.mobileUnifiedListPage, className)} style={offsetStyle}>
      <div ref={headerRef} className={repairOs.mobileListHeaderShell}>
        <section className={repairOs.mobileFloatingHeaderCard}>
          <header className={repairOs.mobileFloatingHeaderNav}>
            <SidebarTrigger className="size-7 rounded-lg border border-[var(--border-panel)] bg-card shadow-none" />
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold leading-5">{title}</p>
              {subtitle ? (
                <p className="truncate text-[9px] leading-3 text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex size-7 shrink-0 items-center justify-end">{action}</div>
          </header>

          <div className={cn(repairOs.mobileFloatingHeaderBody, "space-y-1.5")}>
            {hasSearch ? (
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] gap-1.5">
                <div className={cn(repairOs.searchBar, "h-8 rounded-xl px-2 shadow-none")}>
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className={cn(repairOs.searchInput, "h-7 text-xs")}
                  />
                </div>
                {filterAction ?? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-xl bg-card"
                    aria-label="筛选"
                    disabled
                  >
                    <Filter className="size-3.5" />
                  </Button>
                )}
              </div>
            ) : null}

            {chips.length > 0 ? <RepairOsHeaderStepper chips={chips} label={chipsLabel} /> : null}
          </div>
        </section>
      </div>

      {resolvedDesktopHeader ? (
        <div className="hidden md:block">{resolvedDesktopHeader}</div>
      ) : null}
      {children}
    </div>
  );
}

function RepairOsHeaderStepper({
  chips,
  label,
}: {
  chips: RepairOsListHeaderChip[];
  label: string;
}) {
  const minWidth = Math.max(320, chips.length * 54);

  return (
    <div className="min-w-0 overflow-x-auto pb-0.5" aria-label={label}>
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))`, minWidth }}
      >
        <span
          aria-hidden
          className="absolute left-[calc(100%/16)] right-[calc(100%/16)] top-3 h-px bg-border"
        />
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClick}
            className="relative z-10 grid min-w-0 justify-items-center gap-0.5 px-0.5 text-center"
            aria-pressed={chip.active}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border text-[11px] font-semibold leading-none transition-colors",
                chip.active
                  ? "border-primary bg-primary text-primary-foreground shadow-none"
                  : "border-border bg-surface-muted text-muted-foreground",
              )}
            >
              {chip.shortLabel ?? chip.label.slice(0, 1)}
            </span>
            <span
              className={cn(
                "flex max-w-full items-center justify-center gap-0.5 truncate text-[9px] leading-3",
                chip.active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              <span className="truncate">{chip.label}</span>
              {chip.count !== undefined ? (
                <span
                  className={cn(
                    "font-mono text-[9px] tabular-nums",
                    chip.active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {chip.count}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RepairOsHeaderActionButton({
  children,
  onClick,
  ariaLabel,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      className="size-7 rounded-lg border-0 text-primary-foreground shadow-[var(--shadow-action)]"
      style={brandGradientStyle}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export interface RepairOsMetric {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "blue" | "green" | "amber" | "violet" | "slate";
}

const metricToneClass: Record<NonNullable<RepairOsMetric["tone"]>, string> = {
  blue: "bg-primary/10 text-primary ring-primary/10",
  green: "bg-status-success text-status-success-foreground ring-status-success-foreground/10",
  amber: "bg-status-warn text-status-warn-foreground ring-status-warn-foreground/10",
  violet: "bg-brand-violet/10 text-primary ring-primary/10",
  slate: "bg-muted text-muted-foreground ring-border/60",
};

export function RepairOsMetricStrip({
  metrics,
  className,
}: {
  metrics: RepairOsMetric[];
  className?: string;
}) {
  const columns =
    metrics.length >= 4 ? "grid-cols-4" : metrics.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className={cn(repairOs.metricStrip, columns, className)}>
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const tone =
          metric.tone ?? (index % 3 === 0 ? "blue" : index % 3 === 1 ? "green" : "amber");

        return (
          <div key={metric.label} className={repairOs.metricCard}>
            {Icon ? (
              <span className={cn(repairOs.metricIcon, metricToneClass[tone])}>
                <Icon className="size-3.5" />
              </span>
            ) : null}
            <p className={repairOs.metricLabel}>{metric.label}</p>
            <p className={cn(repairOs.metricValue, Icon && "mt-1")}>{metric.value}</p>
            {metric.hint ? (
              <p className="mt-1 truncate text-[10px] text-muted-foreground">{metric.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export interface RepairOsChip {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function RepairOsChipRow({
  chips,
  className,
}: {
  chips: RepairOsChip[];
  className?: string;
}) {
  return (
    <div className={cn(repairOs.chipRow, className)}>
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.onClick}
          className={cn(repairOs.chip, chip.active && repairOs.chipActive)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

type RepairOsBusinessCardElement = "article" | "button" | "div" | "label";

export interface RepairOsBusinessCardProps
  extends
    HTMLAttributes<HTMLElement>,
    Pick<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "type"> {
  children: ReactNode;
  as?: RepairOsBusinessCardElement;
  leading?: ReactNode;
  trailing?: ReactNode;
  leadingClassName?: string;
  bodyClassName?: string;
  trailingClassName?: string;
}

export function RepairOsBusinessCard({
  children,
  as: Component = "article",
  leading,
  trailing,
  className,
  leadingClassName,
  bodyClassName,
  trailingClassName,
  ...props
}: RepairOsBusinessCardProps) {
  const layoutClass = leading
    ? trailing
      ? "grid-cols-[auto_minmax(0,1fr)_auto]"
      : "grid-cols-[auto_minmax(0,1fr)]"
    : undefined;

  return (
    <Component className={cn(repairOs.businessCard, className, layoutClass)} {...props}>
      {leading ? <div className={cn("shrink-0", leadingClassName)}>{leading}</div> : null}
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
      {trailing ? <div className={cn("min-w-0", trailingClassName)}>{trailing}</div> : null}
    </Component>
  );
}

export interface RepairOsBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function RepairOsBadge({ children, className, ...props }: RepairOsBadgeProps) {
  return (
    <span className={cn(repairOs.badge, className)} {...props}>
      {children}
    </span>
  );
}
