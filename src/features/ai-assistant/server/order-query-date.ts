import type { AiOrderToolCall } from "@/features/ai-assistant/model/contracts";

export const AI_ORDER_QUERY_TIME_ZONE = "Europe/Rome" as const;

type SearchArguments = Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"];
type DateFilter = NonNullable<SearchArguments["date_filter"]>;

export type ResolvedOrderDateFilter = DateFilter & {
  from: string;
  to: string;
  periodLabel: string;
  fieldLabel: string;
};

export function resolveOrderDateFilter(
  filter: DateFilter | null,
  now = new Date(),
  timeZone = AI_ORDER_QUERY_TIME_ZONE,
): ResolvedOrderDateFilter | null {
  if (!filter) return null;
  const current = localCalendarDay(now, timeZone);
  const currentDate = calendarDate(current.year, current.month, current.day);
  let start: Date;
  let end: Date;
  let periodLabel: string;

  switch (filter.expression) {
    case "today":
      start = currentDate;
      end = currentDate;
      periodLabel = "今天";
      break;
    case "current_calendar_week": {
      const mondayOffset = (currentDate.getUTCDay() + 6) % 7;
      start = addCalendarDays(currentDate, -mondayOffset);
      end = addCalendarDays(start, 6);
      periodLabel = "本周";
      break;
    }
    case "previous_calendar_week": {
      const mondayOffset = (currentDate.getUTCDay() + 6) % 7;
      end = addCalendarDays(currentDate, -mondayOffset - 1);
      start = addCalendarDays(end, -6);
      periodLabel = "上周";
      break;
    }
    case "current_calendar_month":
      start = calendarDate(current.year, current.month, 1);
      end = calendarDate(current.year, current.month + 1, 0);
      periodLabel = "本月";
      break;
    case "previous_calendar_month":
      start = calendarDate(current.year, current.month - 1, 1);
      end = calendarDate(current.year, current.month, 0);
      periodLabel = "上月";
      break;
    case "current_calendar_year":
      start = calendarDate(current.year, 1, 1);
      end = calendarDate(current.year, 12, 31);
      periodLabel = "今年";
      break;
  }

  return {
    ...filter,
    from: formatCalendarDate(start),
    to: formatCalendarDate(end),
    periodLabel,
    fieldLabel: dateFieldLabel(filter.field),
  };
}

function localCalendarDay(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.get("year"));
  const month = Number(byType.get("month"));
  const day = Number(byType.get("day"));
  if (![year, month, day].every(Number.isInteger)) throw new Error("门店日历日期解析失败");
  return { year, month, day };
}

function calendarDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addCalendarDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatCalendarDate(value: Date) {
  return [
    String(value.getUTCFullYear()).padStart(4, "0"),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function dateFieldLabel(field: DateFilter["field"]) {
  if (field === "completed_at") return "完成时间";
  if (field === "updated_at") return "更新时间";
  return "创建时间";
}
