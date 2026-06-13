import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { repairOs } from "@/lib/ui-patterns";
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
