import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderEvent } from "@/lib/repairdesk/types";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const ROME_TIME_ZONE = "Europe/Rome";

const listDateFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  "zh-CN": new Intl.DateTimeFormat("zh-CN", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }),
  "it-IT": new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }),
  en: new Intl.DateTimeFormat("en", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }),
};

const detailDateFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  "zh-CN": new Intl.DateTimeFormat("zh-CN", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  "it-IT": new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  en: new Intl.DateTimeFormat("en", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
};

function parseOrderDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatOrderListDate(value: string, locale: AppLocale = "it-IT") {
  const date = parseOrderDate(value);
  return date
    ? listDateFormatters[locale].format(date)
    : translateMessage(locale, "orders.unknownDate");
}

export function formatOrderDateTime(value: string, locale: AppLocale = "it-IT") {
  const date = parseOrderDate(value);
  return date
    ? detailDateFormatters[locale].format(date)
    : translateMessage(locale, "orders.unknownDate");
}

export function formatOrderRelativeDate(
  value: string,
  now: Date | number = Date.now(),
  locale: AppLocale = "zh-CN",
) {
  const date = parseOrderDate(value);
  if (!date) return translateMessage(locale, "orders.unknownTime");

  const nowMs = now instanceof Date ? now.getTime() : now;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - date.getTime()) / 1_000));
  if (elapsedSeconds < 60) return translateMessage(locale, "orders.justNow");
  if (elapsedSeconds < 3_600)
    return relativeUnit(Math.floor(elapsedSeconds / 60), "minute", locale);
  if (elapsedSeconds < 86_400)
    return relativeUnit(Math.floor(elapsedSeconds / 3_600), "hour", locale);

  const elapsedDays = Math.floor(elapsedSeconds / 86_400);
  if (elapsedDays < 30) return relativeUnit(elapsedDays, "day", locale);
  if (elapsedDays < 365) return relativeUnit(Math.floor(elapsedDays / 30), "month", locale);
  return relativeUnit(Math.floor(elapsedDays / 365), "year", locale);
}

function relativeUnit(
  count: number,
  unit: "minute" | "hour" | "day" | "month" | "year",
  locale: AppLocale,
) {
  const key = (
    {
      minute: count === 1 ? "orders.minuteAgo" : "orders.minutesAgo",
      hour: count === 1 ? "orders.hourAgo" : "orders.hoursAgo",
      day: count === 1 ? "orders.dayAgo" : "orders.daysAgo",
      month: count === 1 ? "orders.monthAgo" : "orders.monthsAgo",
      year: count === 1 ? "orders.yearAgo" : "orders.yearsAgo",
    } as const
  )[unit];
  return translateMessage(locale, key, { count });
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
