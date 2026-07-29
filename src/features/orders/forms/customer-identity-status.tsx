import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CustomerIdentitySummary({
  tone,
  title,
  description,
  actionLabel,
  onAction,
  primaryAction,
}: {
  tone: "selected" | "new" | "warning";
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  primaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <div
      data-customer-identity-summary={tone}
      className={cn(
        "min-w-0 rounded-xl border px-2.5 py-2",
        tone === "warning"
          ? "border-status-warn-foreground/25 bg-status-warn/20 text-status-warn-foreground"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-card text-primary">
          {tone === "warning" ? (
            <AlertTriangle className="size-3.5" />
          ) : tone === "selected" ? (
            <Check className="size-3.5" />
          ) : (
            <UserPlus className="size-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-4">{title}</p>
          <p className="mt-0.5 break-words text-[10px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
        <Button type="button" variant="outline" className="min-h-11 lg:min-h-10" onClick={onAction}>
          <ArrowLeft className="mr-1.5 size-3.5" />
          {actionLabel}
        </Button>
        {primaryAction ? (
          <Button type="button" className="min-h-11 lg:min-h-10" onClick={primaryAction.onClick}>
            <Check className="mr-1.5 size-3.5" />
            {primaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CustomerIntakeFieldShell({
  label,
  required,
  leading,
  trailing,
  children,
}: {
  label: string;
  required?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rd-new-order-field grid min-h-11 min-w-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-0 shadow-[var(--shadow-card)]">
      <label className="flex h-11 items-center text-[10.5px] font-semibold leading-4 text-muted-foreground lg:h-9">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      <div
        className={cn(
          "grid min-w-0 items-start gap-1.5",
          leading ? "grid-cols-[1rem_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {leading ? (
          <span className="grid h-11 w-4 shrink-0 place-items-center text-muted-foreground lg:h-9">
            {leading}
          </span>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
      {trailing ? (
        <div className="pointer-events-none flex h-9 shrink-0 self-center items-center gap-1 border-l border-[var(--border-panel)] pl-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export function LookupNotice({
  children,
  icon,
  tone = "muted",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-card px-2 py-1.5 text-xs",
        tone === "danger" ? "text-status-danger-foreground" : "text-muted-foreground",
      )}
    >
      {icon ?? <Search className="size-3.5 shrink-0" />}
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}
