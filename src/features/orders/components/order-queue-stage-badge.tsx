import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  Bell,
  CheckCircle2,
  PackageCheck,
  PackagePlus,
  Wrench,
} from "lucide-react";

import { isOrderArchivedForQueue } from "@/features/orders/model/order-list-visibility";
import {
  getOrderQueueGroup,
  orderQueueGroupMeta,
} from "@/features/orders/model/order-queue-classification";
import type { StatusTone } from "@/lib/mock/enums";
import type { OrderListItem, OrderQueueGroup } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { localizeOrderQueueStage } from "@/features/orders/model/order-i18n";

type QueueStageOrder = Pick<
  OrderListItem,
  "status" | "workflow_status" | "parts_status" | "notify_status" | "exception_status"
>;

const groupIcons: Record<OrderQueueGroup, LucideIcon> = {
  processing: Wrench,
  ordered: PackagePlus,
  arrived: PackageCheck,
  arrived_notified: Bell,
  repaired: CheckCircle2,
  repaired_notified: BadgeCheck,
};

const toneClass: Record<StatusTone, string> = {
  neutral: "border-status-neutral-foreground/20 bg-status-neutral text-status-neutral-foreground",
  info: "border-status-info-foreground/30 bg-status-info text-status-info-foreground",
  progress:
    "border-status-progress-foreground/30 bg-status-progress text-status-progress-foreground",
  warn: "border-status-warn-foreground/30 bg-status-warn text-status-warn-foreground",
  success: "border-status-success-foreground/30 bg-status-success text-status-success-foreground",
  danger: "border-status-danger-foreground/30 bg-status-danger text-status-danger-foreground",
};

export function OrderQueueStageBadge({
  order,
  className,
}: {
  order: QueueStageOrder;
  className?: string;
}) {
  const { t } = useLocale();
  const archived = isOrderArchivedForQueue(order);
  const cancelled = order.status === "cancelled" || order.exception_status === "cancelled";
  const group = archived ? null : getOrderQueueGroup(order);
  const localizedGroup = group ? localizeOrderQueueStage(group, t) : null;
  const meta = group
    ? {
        tone: orderQueueGroupMeta[group].tone,
        label: localizedGroup!.label,
        hint: localizedGroup!.hint,
      }
    : cancelled
      ? { label: t("orders.cancelled"), hint: t("orders.cancelledHint"), tone: "danger" as const }
      : { label: t("orders.completed"), hint: t("orders.completedHint"), tone: "neutral" as const };
  const Icon = group ? groupIcons[group] : cancelled ? Ban : CheckCircle2;
  const stageKey = group ?? (cancelled ? "cancelled" : order.status);

  return (
    <span
      data-order-queue-stage={stageKey}
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[9px] font-semibold leading-none",
        toneClass[meta.tone],
        className,
      )}
      title={meta.hint}
      aria-label={t("orders.stageAria", { stage: meta.label })}
    >
      <Icon className="size-2.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
