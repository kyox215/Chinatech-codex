import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardPriorityItem } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";
import { localizeDashboardPriorityItem } from "@/features/dashboard/model/dashboard-priority-i18n";

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
  const { t, locale } = useLocale();
  const localizedItem = localizeDashboardPriorityItem(item, t);
  const headingId = `dashboard-priority-${item.orderId}`;

  return (
    <article
      data-ui="dashboard-priority-card"
      data-priority-reason={item.reasonCode}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 rounded-2xl border border-[var(--border-panel)] bg-card p-2.5 shadow-[var(--shadow-card)] lg:p-3",
        primary && "lg:p-4",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-foreground px-2 text-[9px] font-semibold text-background lg:h-6 lg:text-[11px] lg:leading-4">
            {t("dashboard.priorityRank", { rank: item.rank })}
          </span>
          <span
            className={cn(
              "inline-flex h-5 min-w-0 items-center rounded-full border px-2 text-[9px] font-semibold lg:h-6 lg:text-[11px] lg:leading-4",
              tierStyles[item.tier],
            )}
          >
            <span className="truncate">{localizedItem.reasonLabel}</span>
          </span>
        </div>
        <span className="max-w-[42%] shrink-0 truncate font-mono text-[10px] font-medium text-muted-foreground lg:max-w-none lg:text-[11px] lg:leading-4">
          {item.publicNo}
        </span>
      </div>

      <h3
        id={headingId}
        className={cn(
          "mt-1.5 min-w-0 truncate text-sm font-semibold text-foreground lg:mt-2",
          primary && "lg:text-lg",
        )}
        title={`${item.customerName} · ${item.deviceLabel}`}
      >
        {item.customerName} · {item.deviceLabel}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground lg:mt-1 lg:line-clamp-2 lg:text-xs lg:leading-5">
        {localizedItem.reasonDescription}
      </p>

      <div
        className={cn(
          "mt-2 grid min-w-0 gap-0.5 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1 lg:mt-3 lg:gap-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
          primary && "lg:grid-cols-2",
        )}
      >
        <StepBlock
          label={t("dashboard.currentStep")}
          value={localizedItem.currentStep ?? t("orders.noNextStep")}
          icon={<Clock3 className="size-3.5" aria-hidden />}
        />
        <StepBlock
          label={t("dashboard.nextStep")}
          value={localizedItem.nextStep ?? t("orders.noNextStep")}
          icon={<CheckCircle2 className="size-3.5" aria-hidden />}
          emphasized
        />
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground lg:mt-3 lg:text-xs lg:leading-4">
        <span className="inline-flex min-w-0 items-center gap-1">
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0">{t("dashboard.assignee")}</span>
          <span className="truncate font-medium text-foreground">
            {localizedItem.assigneeLabel}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden />
          <time dateTime={item.updatedAt}>{formatUpdatedAt(item.updatedAt, locale)}</time>
        </span>
      </div>

      {item.assigneeState === "unavailable" ? (
        <p className="mt-1.5 inline-flex line-clamp-1 items-center gap-1 text-[10px] leading-4 text-status-warn-foreground lg:mt-2 lg:text-xs lg:leading-[18px]">
          <AlertTriangle className="size-3" aria-hidden />
          {t("dashboard.assigneeUnavailable")}
        </p>
      ) : null}

      <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 lg:mt-3 lg:gap-2">
        <Button asChild size="sm" className="h-11 min-w-0 rounded-xl px-3 text-xs">
          <Link href={item.action.href} data-dashboard-priority-action={item.orderId}>
            <span className="truncate">{localizedItem.action.label}</span>
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
            <span className="truncate">{t("dashboard.viewOrder")}</span>
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
        "grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-2 py-1 lg:block lg:rounded-xl lg:border lg:px-2.5 lg:py-2",
        emphasized
          ? "border-t border-primary/15 pt-1.5 lg:border-primary/20 lg:bg-primary/5"
          : "lg:border-[var(--border-panel)] lg:bg-[var(--surface-panel-muted)]",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground lg:text-xs lg:leading-4">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "line-clamp-1 min-w-0 text-[11px] leading-4 lg:mt-1 lg:line-clamp-2 lg:text-xs lg:leading-5",
          emphasized && "font-medium",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatUpdatedAt(value: string, locale: "zh-CN" | "it-IT" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translateMessage(locale, "dashboard.dateUnknown");
  return new Intl.DateTimeFormat(
    locale === "zh-CN" ? "zh-CN" : locale === "it-IT" ? "it-IT" : "en",
    {
      timeZone: "Europe/Rome",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}
