import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderEvent } from "@/lib/repairdesk/types";

const ROME_TIME_ZONE = "Europe/Rome";

const listDateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: ROME_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const detailDateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: ROME_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function parseOrderDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatOrderListDate(value: string) {
  const date = parseOrderDate(value);
  return date ? listDateFormatter.format(date) : "日期未知";
}

export function formatOrderDateTime(value: string) {
  const date = parseOrderDate(value);
  return date ? detailDateFormatter.format(date) : "日期未知";
}

export function formatOrderRelativeDate(value: string, now: Date | number = Date.now()) {
  const date = parseOrderDate(value);
  if (!date) return "时间未知";

  const nowMs = now instanceof Date ? now.getTime() : now;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - date.getTime()) / 1_000));
  if (elapsedSeconds < 60) return "刚刚";
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)} 分钟前`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)} 小时前`;

  const elapsedDays = Math.floor(elapsedSeconds / 86_400);
  if (elapsedDays < 30) return `${elapsedDays} 天前`;
  if (elapsedDays < 365) return `${Math.floor(elapsedDays / 30)} 个月前`;
  return `${Math.floor(elapsedDays / 365)} 年前`;
}

export function findCurrentOrderStatusChangedAt({
  status,
  createdAt,
  events,
}: {
  status: RepairOrderStatus;
  createdAt: string;
  events: OrderEvent[];
}) {
  const statusEvents = events
    .filter((event) => event.event_type === "status_changed")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const matching = statusEvents.find(
    (event) => event.payload.to === status && event.payload.from !== event.payload.to,
  );
  return matching?.created_at ?? createdAt;
}
