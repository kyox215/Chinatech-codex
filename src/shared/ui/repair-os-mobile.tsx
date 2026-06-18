"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Filter, Search, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export interface RepairOsMobilePageProps {
  children: ReactNode;
  className?: string;
}

export function RepairOsMobilePage({ children, className }: RepairOsMobilePageProps) {
  return <div className={cn(repairOs.mobilePage, className)}>{children}</div>;
}

export interface RepairOsModuleHeaderProps {
  action?: ReactNode;
  className?: string;
}

export function RepairOsModuleHeader({ action, className }: RepairOsModuleHeaderProps) {
  if (!action) return null;
  return <header className={cn("flex min-w-0 justify-end", className)}>{action}</header>;
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
  action?: ReactNode;
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
  action,
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

      {desktopHeader ? <div className="hidden md:block">{desktopHeader}</div> : null}
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

export interface RepairOsBusinessCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  trailing?: ReactNode;
}

export function RepairOsBusinessCard({
  children,
  trailing,
  className,
  ...props
}: RepairOsBusinessCardProps) {
  return (
    <article className={cn(repairOs.businessCard, className)} {...props}>
      <div className="min-w-0">{children}</div>
      {trailing ? <div className="min-w-0">{trailing}</div> : null}
    </article>
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
