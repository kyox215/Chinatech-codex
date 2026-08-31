import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  Bell,
  CheckCircle2,
  CircleCheckBig,
  PackageCheck,
  PackagePlus,
  Wrench,
} from "lucide-react";

import { formatOrderListDate } from "@/features/orders/model/order-date";
import { orderResultGroupMeta } from "@/features/orders/model/order-list-grouping";
import type { OrderResultGroup } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeOrderResultGroup } from "@/features/orders/model/order-i18n";

const groupIcons: Record<OrderResultGroup, LucideIcon> = {
  processing: Wrench,
  ordered: PackagePlus,
  arrived: PackageCheck,
  arrived_notified: Bell,
  repaired: CheckCircle2,
  repaired_notified: BadgeCheck,
  completed: CircleCheckBig,
  cancelled: Ban,
};

function toneClass(group: OrderResultGroup) {
  const tone = orderResultGroupMeta[group].tone;
  if (tone === "info") {
    return "border-status-info-foreground/25 bg-status-info/65 text-status-info-foreground";
  }
  if (tone === "warn") {
    return "border-status-warn-foreground/25 bg-status-warn/65 text-status-warn-foreground";
  }
  if (tone === "success") {
    return "border-status-success-foreground/25 bg-status-success/65 text-status-success-foreground";
  }
  if (tone === "danger") {
    return "border-status-danger-foreground/25 bg-status-danger/50 text-status-danger-foreground";
  }
  return "border-border/60 bg-surface-muted text-foreground";
}

export function OrderResultGroupHeader({
  headingId,
  group,
  pageCount,
  totalCount,
  oldestCreatedAt,
  className,
}: {
  headingId: string;
  group: OrderResultGroup;
  pageCount: number;
  totalCount: number;
  oldestCreatedAt: string;
  className?: string;
}) {
  const { t, locale } = useLocale();
  const Icon = groupIcons[group];
  const meta = orderResultGroupMeta[group];
  const oldestDate = formatOrderListDate(oldestCreatedAt, locale);
  const localizedMeta = localizeOrderResultGroup(group, t);

  return (
    <div
      data-order-result-group={group}
      aria-label={t("orders.resultGroupAria", {
        label: localizedMeta.label,
        pageCount,
        totalCount,
        hint: localizedMeta.hint,
        date: oldestDate,
      })}
      className={cn(
        "flex min-h-10 min-w-0 items-center gap-[clamp(0.25rem,1.28vw,0.375rem)] rounded-[clamp(0.5rem,2.56vw,0.625rem)] border px-[clamp(0.375rem,2.05vw,0.5625rem)] py-1 lg:min-h-9 lg:gap-2 lg:rounded-md lg:px-2.5 lg:py-1.5",
        toneClass(group),
        className,
      )}
    >
      <Icon
        className="size-[clamp(0.75rem,3.33vw,0.875rem)] shrink-0 lg:size-3.5"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <h2
          id={headingId}
          className="truncate text-[clamp(0.6875rem,3.08vw,0.75rem)] font-semibold leading-3.5 lg:text-xs lg:leading-4"
        >
          {localizedMeta.label}
        </h2>
        <p className="truncate text-[clamp(0.5625rem,2.56vw,0.625rem)] leading-3 lg:text-[11px] lg:leading-4">
          {localizedMeta.hint}
        </p>
      </div>
      <div className="shrink-0 text-right text-[clamp(0.5625rem,2.56vw,0.625rem)] leading-3 tabular-nums lg:text-[11px] lg:leading-4">
        <p className="font-semibold">
          {pageCount} / {totalCount}
        </p>
        <p>{t("orders.resultGroupStart", { date: oldestDate })}</p>
      </div>
    </div>
  );
}
