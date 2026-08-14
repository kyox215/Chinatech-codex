import type { InventoryLifecycleListSummary } from "@/lib/repairdesk/types";

export type InventoryLifecycleTimelineSource = "milestone-summary" | "ledger-event";

export type InventoryLifecycleTimelineEntry = {
  id: string;
  label: string;
  at: string;
  source: InventoryLifecycleTimelineSource;
  eventType?: string;
  fromStatus?: string;
  toStatus?: string;
  fromStatusLabel?: string;
  toStatusLabel?: string;
};

export type InventoryLifecycleTimelineScope = {
  label: string;
  source: InventoryLifecycleTimelineSource;
  totalValid: number;
  displayedCount: number;
};

export type InventoryLifecycleTimelineResult = {
  items: InventoryLifecycleTimelineEntry[];
  scope: InventoryLifecycleTimelineScope;
};

export type InventoryLifecycleTimelineEvent = {
  event_type?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  occurred_at?: string | null;
};

export type InventoryLifecycleTimelineMilestone = {
  id: string;
  label: string;
  at?: string | null;
};

const statusLabels: Record<string, string> = {
  open: "待检测",
  in_progress: "处理中",
  waiting_customer: "等客户",
  returned: "已返还",
  closed: "已关闭",
  processing: "处理中",
  in_stock: "在库",
  reserved: "已预订",
  sold_pending_pickup: "待取货",
  delivered: "已交付",
  after_sales: "售后处理中",
  removed: "已移除",
};

const eventLabels: Record<string, string> = {
  created: "建立案件",
  status_changed: "状态更新",
};

function validTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function stableSortEntries(entries: InventoryLifecycleTimelineEntry[]) {
  return [...entries].sort((left, right) => {
    const dateDelta = Date.parse(right.at) - Date.parse(left.at);
    if (dateDelta) return dateDelta;
    const sourceDelta = left.source.localeCompare(right.source);
    if (sourceDelta) return sourceDelta;
    const typeDelta = (left.eventType ?? left.id).localeCompare(right.eventType ?? right.id);
    if (typeDelta) return typeDelta;
    return left.id.localeCompare(right.id);
  });
}

function withLimit(
  entries: InventoryLifecycleTimelineEntry[],
  source: InventoryLifecycleTimelineSource,
  limit?: number,
): InventoryLifecycleTimelineResult {
  const sorted = stableSortEntries(entries);
  const safeLimit = limit && limit > 0 ? Math.floor(limit) : undefined;
  const items = safeLimit ? sorted.slice(0, safeLimit) : sorted;
  return {
    items,
    scope: {
      source,
      totalValid: sorted.length,
      displayedCount: items.length,
      label:
        source === "milestone-summary"
          ? `当前摘要确认 ${items.length} 项关键里程碑（不是完整审计历史）`
          : safeLimit
            ? `显示最近 ${items.length} 项（服务端返回范围）`
            : `服务端返回范围内 ${items.length} 项事件`,
    },
  };
}

export function resolveInventoryMilestoneTimeline(
  milestones: readonly InventoryLifecycleTimelineMilestone[],
  options?: { limit?: number },
): InventoryLifecycleTimelineResult {
  const entries = milestones.flatMap((milestone) => {
    if (validTimestamp(milestone.at) === null) return [];
    return [
      {
        id: `milestone:${milestone.id}:${milestone.at}`,
        label: milestone.label,
        at: milestone.at as string,
        source: "milestone-summary" as const,
      },
    ];
  });
  return withLimit(entries, "milestone-summary", options?.limit);
}

export function buildInventoryLifecycleMilestones(
  summary: Pick<
    InventoryLifecycleListSummary,
    "inspection" | "reserved_at" | "sold_at" | "actual_pickup_at" | "after_sales_status"
  > & { after_sales?: { received_at?: string | null } | null },
): InventoryLifecycleTimelineMilestone[] {
  return [
    { id: "inspection", label: "设备检测", at: summary.inspection?.inspected_at },
    { id: "reserved", label: "建立预订", at: summary.reserved_at },
    { id: "sold", label: "完成销售", at: summary.sold_at },
    { id: "pickup", label: "客户取走", at: summary.actual_pickup_at },
    { id: "after-sales", label: "登记售后", at: summary.after_sales?.received_at },
  ];
}

function occurrenceId(
  event: InventoryLifecycleTimelineEvent,
  occurrence: Map<string, number>,
): string {
  const signature = [
    event.event_type ?? "unknown",
    event.occurred_at ?? "",
    event.from_status ?? "",
    event.to_status ?? "",
  ].join(":");
  const next = (occurrence.get(signature) ?? 0) + 1;
  occurrence.set(signature, next);
  return `ledger:${signature}:${next}`;
}

export function resolveInventoryLedgerTimeline(
  events: readonly InventoryLifecycleTimelineEvent[],
  options?: { limit?: number },
): InventoryLifecycleTimelineResult {
  const occurrence = new Map<string, number>();
  const entries = events.flatMap((event) => {
    if (validTimestamp(event.occurred_at) === null) return [];
    const eventType = event.event_type ?? "unknown";
    const fromStatusLabel = event.from_status ? statusLabels[event.from_status] : undefined;
    const toStatusLabel = event.to_status ? statusLabels[event.to_status] : undefined;
    return [
      {
        id: occurrenceId(event, occurrence),
        label: eventLabels[eventType] ?? "业务事件",
        at: event.occurred_at as string,
        source: "ledger-event" as const,
        eventType,
        fromStatus: event.from_status ?? undefined,
        toStatus: event.to_status ?? undefined,
        fromStatusLabel,
        toStatusLabel,
      },
    ];
  });
  return withLimit(entries, "ledger-event", options?.limit);
}
