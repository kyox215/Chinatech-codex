import type { ComponentType, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-1 flex min-w-0 items-center justify-between gap-1 text-[11px] font-semibold leading-4 text-foreground",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        {Icon ? (
          <Icon className="size-3 shrink-0 text-primary" />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
        )}
        <span className="truncate">{title}</span>
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}

export function FormItem({
  label,
  required,
  children,
  className,
  mobileLabel = "visible",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  mobileLabel?: "visible" | "sr-only";
}) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <Label
        className={cn(
          "text-[10.5px] font-semibold leading-4 text-muted-foreground sm:text-[11px]",
          mobileLabel === "sr-only" && "sr-only sm:not-sr-only",
        )}
      >
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function MoneyRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1.5 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1">
      <span className="truncate text-[10px] font-medium leading-3 text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums leading-4 text-foreground",
          strong && "font-semibold text-foreground",
        )}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}
