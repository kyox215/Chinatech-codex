import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardPriorityItem } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

const tierStyles: Record<DashboardPriorityItem["tier"], string> = {
  overdue: "border-status-danger-foreground/25 bg-status-danger/10 text-status-danger-foreground",
  ready: "border-status-success-foreground/25 bg-status-success/10 text-status-success-foreground",
  active: "border-primary/25 bg-primary/10 text-primary",
  waiting: "border-status-warn-foreground/25 bg-status-warn/10 text-status-warn-foreground",
};

export function DashboardPriorityCard({
  item,
  primary = false,
}: {
  item: DashboardPriorityItem;
  primary?: boolean;
}) {
  const headingId = `dashboard-priority-${item.orderId}`;

  return (
    <article
      data-ui="dashboard-priority-card"
      data-priority-reason={item.reasonCode}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 rounded-2xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)]",
        primary ? "p-3 sm:p-4" : "p-3",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-foreground px-2 text-[10px] font-semibold text-background">
            第 {item.rank} 优先
          </span>
          <span
            className={cn(
              "inline-flex h-6 min-w-0 items-center rounded-full border px-2 text-[10px] font-semibold",
              tierStyles[item.tier],
            )}
          >
            <span className="truncate">{item.reasonLabel}</span>
          </span>
        </div>
        <span className="shrink-0 font-mono text-[11px] font-medium text-muted-foreground">
          {item.publicNo}
        </span>
      </div>

      <h3
        id={headingId}
        className={cn(
          "mt-2 min-w-0 truncate font-semibold text-foreground",
          primary ? "text-base sm:text-lg" : "text-sm",
        )}
        title={`${item.customerName} · ${item.deviceLabel}`}
      >
        {item.customerName} · {item.deviceLabel}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {item.reasonDescription}
      </p>

      <div className={cn("mt-3 grid min-w-0 gap-2", primary && "sm:grid-cols-2")}>
        <StepBlock
          label="当前步骤"
          value={item.currentStep}
          icon={<Clock3 className="size-3.5" aria-hidden />}
        />
        <StepBlock
          label="下一步"
          value={item.nextStep}
          icon={<CheckCircle2 className="size-3.5" aria-hidden />}
          emphasized
        />
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0">负责人</span>
          <span className="truncate font-medium text-foreground">{item.assigneeLabel}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden />
          <time dateTime={item.updatedAt}>{formatUpdatedAt(item.updatedAt)}</time>
        </span>
      </div>

      {item.assigneeState === "unavailable" ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] leading-4 text-status-warn-foreground">
          <AlertTriangle className="size-3" aria-hidden />
          负责人资料暂时不可确认，请进入工单核对。
        </p>
      ) : null}

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <Button asChild size="sm" className="h-11 min-w-0 rounded-xl px-3 text-xs">
          <Link href={item.action.href} data-dashboard-priority-action={item.orderId}>
            <span className="truncate">{item.action.label}</span>
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-11 min-w-0 rounded-xl px-3 text-xs"
        >
          <Link href={item.detailHref}>
            <span className="truncate">查看工单</span>
          </Link>
        </Button>
      </div>
    </article>
  );
}

function StepBlock({
  label,
  value,
  icon,
  emphasized = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-2.5 py-2",
        emphasized
          ? "border-primary/20 bg-primary/5"
          : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-1 line-clamp-2 text-xs leading-5", emphasized && "font-medium")}>
        {value}
      </p>
    </div>
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Europe/Rome",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
