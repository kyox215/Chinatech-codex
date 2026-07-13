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
  const Icon = groupIcons[group];
  const meta = orderResultGroupMeta[group];

  return (
    <div
      data-order-result-group={group}
      className={cn(
        "flex min-h-9 min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5",
        toneClass(group),
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 id={headingId} className="truncate text-xs font-semibold leading-4">
          {meta.label}
        </h2>
        <p className="truncate text-[11px] leading-4">{meta.hint}</p>
      </div>
      <div className="shrink-0 text-right text-[11px] leading-4 tabular-nums">
        <p className="font-semibold">
          本页 {pageCount} · 共 {totalCount}
        </p>
        <p>本页起 {formatOrderListDate(oldestCreatedAt)}</p>
      </div>
    </div>
  );
}
