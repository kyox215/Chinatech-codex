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
import { Filter, Search, X, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useViewportMode } from "@/hooks/use-mobile";
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
  mobileLeading?: ReactNode;
  action?: ReactNode;
  desktopAction?: ReactNode;
  desktopHeaderAddon?: ReactNode;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchFrame?: "standalone" | "embedded";
  searchAction?: ReactNode;
  filterAction?: ReactNode;
  chips?: RepairOsListHeaderChip[];
  chipsLabel?: string;
  chipsVariant?: "stepper" | "underline";
  desktopHeader?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function RepairOsListScaffold({
  title,
  subtitle,
  eyebrow,
  mobileLeading,
  action,
  desktopAction,
  desktopHeaderAddon,
  searchValue,
  searchPlaceholder = "搜索",
  onSearchChange,
  searchFrame = "embedded",
  searchAction,
  filterAction,
  chips = [],
  chipsLabel = "状态分组",
  chipsVariant = "stepper",
  desktopHeader,
  children,
  className,
}: RepairOsListScaffoldProps) {
  const viewportMode = useViewportMode();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const hasSearch = typeof searchValue === "string" && onSearchChange;
  const trimmedSearchValue = hasSearch ? searchValue.trim() : "";
  const searchTrailingActions = [
    searchAction,
    filterAction ?? (!searchAction ? "default-filter" : null),
  ].filter(Boolean);
  const offsetStyle =
    headerHeight > 0
      ? ({
          "--repair-os-list-header-offset": `${headerHeight + 8}px`,
        } as CSSProperties)
      : undefined;
  const desktopActions = desktopAction ?? action;
  const resolvedDesktopHeader =
    desktopHeader ??
    (desktopActions || desktopHeaderAddon ? (
      <div className="mb-3 space-y-3 sm:mb-4 lg:mb-6">
        {desktopActions ? <div className="flex min-w-0 justify-end">{desktopActions}</div> : null}
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
  }, [viewportMode]);

  if (viewportMode === "pending") {
    return (
      <div
        data-ui="repair-os-list-scaffold"
        data-ui-viewport="pending"
        className={cn(
          "mx-auto w-full min-w-0 max-w-7xl space-y-2 overflow-hidden px-2 py-3 sm:px-4 sm:py-5 md:px-6 lg:px-8",
          className,
        )}
        aria-busy="true"
      >
        <h1 className="text-sm font-semibold leading-5 text-foreground">{title}</h1>
        <span className="sr-only" role="status" aria-live="polite">
          正在准备{title}
        </span>
        <div aria-hidden="true" className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-14 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-ui="repair-os-list-scaffold"
      className={cn(repairOs.mobileUnifiedListPage, className)}
      style={offsetStyle}
    >
      {viewportMode === "compact" ? (
        <div
          ref={headerRef}
          data-ui="repair-os-list-header-shell"
          className={repairOs.mobileListHeaderShell}
        >
          <section
            data-ui="repair-os-list-header-card"
            className={repairOs.mobileFloatingHeaderCard}
          >
            <header
              className={cn(
                repairOs.mobileFloatingHeaderNav,
                mobileLeading && "grid-cols-[36px_minmax(0,1fr)_auto]",
              )}
            >
              {mobileLeading ?? (
                <SidebarTrigger className="size-9 rounded-lg border border-[var(--border-panel)] bg-card shadow-none" />
              )}
              <div className="min-w-0 text-center">
                <h1 className="truncate text-sm font-semibold leading-5">{title}</h1>
                {subtitle ? (
                  <p className="truncate text-[9px] leading-3 text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex min-h-9 min-w-9 shrink-0 items-center justify-end">{action}</div>
            </header>

            <div
              data-ui="repair-os-list-header-body"
              className={cn(repairOs.mobileFloatingHeaderBody, "space-y-2")}
            >
              {hasSearch ? (
                <div
                  data-ui="repair-os-list-search-row"
                  className="grid min-w-0 grid-flow-col grid-cols-[minmax(0,1fr)] auto-cols-max gap-1.5 [&>*]:min-h-9 [&>*]:min-w-9"
                  style={{
                    gridTemplateColumns: `minmax(0, 1fr) repeat(${searchTrailingActions.length}, max-content)`,
                  }}
                >
                  <div
                    className={cn(
                      searchFrame === "embedded" ? repairOs.searchBarEmbedded : repairOs.searchBar,
                      "h-9 rounded-lg px-2",
                      searchFrame === "standalone" && "shadow-none",
                    )}
                  >
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={searchValue}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className={cn(repairOs.searchInput, "h-full text-base")}
                    />
                  </div>
                  {searchAction}
                  {filterAction ??
                    (!searchAction ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="iconDense"
                        className="size-9 rounded-lg bg-card"
                        aria-label="筛选"
                        disabled
                      >
                        <Filter className="size-3.5" />
                      </Button>
                    ) : null)}
                </div>
              ) : null}

              {trimmedSearchValue ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="inline-flex min-w-0 max-w-[calc(100%-3rem)] items-center gap-1 rounded-full border border-[var(--border-panel)] bg-card px-2.5 py-1 text-[11px] font-medium leading-4 text-muted-foreground">
                    <span className="shrink-0">搜索：</span>
                    <span className="truncate font-mono text-foreground">{trimmedSearchValue}</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="清除搜索"
                    onClick={() => onSearchChange?.("")}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}

              {chips.length > 0 ? (
                chipsVariant === "underline" ? (
                  <RepairOsHeaderUnderlineNav chips={chips} label={chipsLabel} />
                ) : (
                  <RepairOsHeaderStepper chips={chips} label={chipsLabel} />
                )
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {viewportMode === "desktop" ? (
        <div className="mb-3 space-y-3 sm:mb-4 lg:mb-6">
          <h1 className="text-xl font-semibold leading-7 text-foreground">{title}</h1>
          {resolvedDesktopHeader}
        </div>
      ) : null}
      <div data-ui="repair-os-list-content" className="min-w-0 pt-2 lg:pt-0">
        {children}
      </div>
    </div>
  );
}

function RepairOsHeaderUnderlineNav({
  chips,
  label,
}: {
  chips: RepairOsListHeaderChip[];
  label: string;
}) {
  return (
    <div
      data-ui="repair-os-header-underline-nav"
      className="grid min-w-0 border-b border-border/70"
      style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={label}
    >
      {chips.map((chip) => {
        const displayCount = typeof chip.count === "number" && chip.count > 99 ? "99+" : chip.count;
        const content = (
          <>
            <span className="min-w-0 truncate">{chip.label}</span>
            {displayCount !== undefined ? (
              <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-80">
                {displayCount}
              </span>
            ) : null}
          </>
        );
        const itemClassName = cn(
          "relative flex h-11 min-w-0 items-center justify-center gap-1 px-1 text-[11px] leading-4 transition-colors",
          chip.active
            ? "font-semibold text-primary after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-t-full after:bg-primary"
            : "text-muted-foreground hover:text-foreground",
        );

        return chip.onClick ? (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClick}
            className={itemClassName}
            aria-label={`${chip.label}${chip.count !== undefined ? `，${chip.count}` : ""}`}
            aria-pressed={chip.active}
          >
            {content}
          </button>
        ) : (
          <div key={chip.key} className={itemClassName}>
            {content}
          </div>
        );
      })}
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
    <div
      data-ui="repair-os-header-stepper"
      className="min-w-0 overflow-x-auto pb-0.5"
      aria-label={label}
    >
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))`, minWidth }}
      >
        <span
          aria-hidden
          className="absolute left-[calc(100%/16)] right-[calc(100%/16)] top-3 h-px bg-border"
        />
        {chips.map((chip) => {
          const content = (
            <>
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
            </>
          );

          return chip.onClick ? (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClick}
              className="relative z-10 grid min-h-8 min-w-0 justify-items-center gap-0.5 px-0.5 text-center"
              aria-pressed={chip.active}
            >
              {content}
            </button>
          ) : (
            <div
              key={chip.key}
              className="relative z-10 grid min-w-0 cursor-default justify-items-center gap-0.5 px-0.5 text-center"
            >
              {content}
            </div>
          );
        })}
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
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="iconDense"
      className="size-9 rounded-lg border-0 text-primary-foreground shadow-[var(--shadow-action)]"
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
