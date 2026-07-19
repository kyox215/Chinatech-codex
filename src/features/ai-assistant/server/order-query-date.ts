import type { AiOrderDateFilter, AiOrderToolCall } from "@/features/ai-assistant/model/contracts";

export const AI_ORDER_QUERY_TIME_ZONE = "Europe/Rome" as const;

type SearchArguments = Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"];
type DateField = NonNullable<SearchArguments["date_filter"]>["field"];

export type ResolvedOrderDateFilter = AiOrderDateFilter & {
  from: string | null;
  to: string | null;
  periodLabel: string;
  fieldLabel: string;
  timeZone: string;
};

export function resolveOrderDateFilter(
  filter: AiOrderDateFilter | null,
  now = new Date(),
  timeZone = AI_ORDER_QUERY_TIME_ZONE,
): ResolvedOrderDateFilter | null {
  if (!filter) return null;
  const current = localCalendarDay(now, timeZone);
  const currentDate = calendarDate(current.year, current.month, current.day);
  let start: Date | null = null;
  let end: Date | null = null;
  let periodLabel = "";

  switch (filter.expression) {
    case "all_time":
      start = null;
      end = null;
      periodLabel = "全部日期";
      break;
    case "today":
      start = currentDate;
      end = currentDate;
      periodLabel = "今天";
      break;
    case "yesterday":
      start = addCalendarDays(currentDate, -1);
      end = start;
      periodLabel = "昨天";
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
    case "current_calendar_quarter": {
      const quarterStartMonth = Math.floor((current.month - 1) / 3) * 3 + 1;
      start = calendarDate(current.year, quarterStartMonth, 1);
      end = calendarDate(current.year, quarterStartMonth + 3, 0);
      periodLabel = "本季度";
      break;
    }
    case "previous_calendar_quarter": {
      const quarterStartMonth = Math.floor((current.month - 1) / 3) * 3 + 1;
      end = calendarDate(current.year, quarterStartMonth, 0);
      start = calendarDate(end.getUTCFullYear(), end.getUTCMonth() - 1, 1);
      periodLabel = "上季度";
      break;
    }
    case "current_calendar_year":
      start = calendarDate(current.year, 1, 1);
      end = calendarDate(current.year, 12, 31);
      periodLabel = "今年";
      break;
    case "previous_calendar_year":
      start = calendarDate(current.year - 1, 1, 1);
      end = calendarDate(current.year - 1, 12, 31);
      periodLabel = "去年";
      break;
    case "rolling_period":
      end = currentDate;
      start = rollingStartDate(currentDate, filter.amount, filter.unit);
      periodLabel = `近${filter.amount}${rollingUnitLabel(filter.unit)}`;
      break;
    case "absolute_range": {
      start = filter.from ? parseCalendarDate(filter.from) : null;
      end = filter.to ? parseCalendarDate(filter.to) : null;
      if (start && end && start > end) throw new Error("结束日期不能早于开始日期");
      periodLabel = absolutePeriodLabel(filter.from, filter.to);
      break;
    }
  }

  return {
    ...filter,
    from: start ? formatCalendarDate(start) : null,
    to: end ? formatCalendarDate(end) : null,
    periodLabel,
    fieldLabel: dateFieldLabel(filter.field),
    timeZone,
  };
}

export function parseTrustedOrderDateFilter(
  value: string,
  field: DateField,
): AiOrderDateFilter | null {
  const normalized = value.normalize("NFKC");

  if (
    /全部日期|所有日期|不限日期|不限时间|从开店到现在|all\s+time|all\s+dates|senza\s+limiti\s+di\s+data/i.test(
      normalized,
    )
  ) {
    return { expression: "all_time", field };
  }

  const absolute = parseAbsoluteDateExpression(normalized, field);
  if (absolute) return absolute;

  const rolling = parseRollingDateExpression(normalized, field);
  if (rolling) return rolling;

  if (/上(?:个)?(?:星期|周)|last\s+week|settimana\s+scorsa/i.test(normalized)) {
    return { expression: "previous_calendar_week", field };
  }
  if (/本周|这周|这个星期|this\s+week|questa\s+settimana/i.test(normalized)) {
    return { expression: "current_calendar_week", field };
  }
  if (/上月|上个月|last\s+month|mese\s+scorso/i.test(normalized)) {
    return { expression: "previous_calendar_month", field };
  }
  if (/本月|这个月|这一个月|今年这个月|this\s+month|questo\s+mese/i.test(normalized)) {
    return { expression: "current_calendar_month", field };
  }
  if (/上季度|上个季度|last\s+quarter|trimestre\s+scorso/i.test(normalized)) {
    return { expression: "previous_calendar_quarter", field };
  }
  if (/本季度|这个季度|this\s+quarter|questo\s+trimestre/i.test(normalized)) {
    return { expression: "current_calendar_quarter", field };
  }
  if (/去年|last\s+year|anno\s+scorso/i.test(normalized)) {
    return { expression: "previous_calendar_year", field };
  }
  if (/今年|this\s+year|quest['’]?anno/i.test(normalized)) {
    return { expression: "current_calendar_year", field };
  }
  if (/昨天|yesterday|ieri/i.test(normalized)) return { expression: "yesterday", field };
  if (/今天|today|oggi/i.test(normalized)) return { expression: "today", field };
  return null;
}

/**
 * Detects date-shaped language that cannot be compiled safely. This prevents
 * an invalid or ambiguous date from being silently dropped while other valid
 * constraints still execute a broader query.
 */
export function hasUnresolvedOrderDateExpression(value: string, field: DateField = "created_at") {
  const normalized = value.normalize("NFKC");
  const rawDateTokens = extractRawFullDateTokens(normalized);
  if (rawDateTokens.some((token) => !parseFullDateToken(token))) return true;

  const looksLikeDateIntent =
    rawDateTokens.length > 0 ||
    /全部日期|所有日期|不限日期|不限时间|从开店到现在|今天|昨天|本周|这周|这个星期|上(?:个)?(?:星期|周)|本月|这个月|这一个月|今年这个月|上月|上个月|本季度|这个季度|上季度|上个季度|今年|去年|all\s+time|all\s+dates|today|yesterday|this\s+(?:week|month|quarter|year)|last\s+(?:week|month|quarter|year)|oggi|ieri|questa\s+settimana|settimana\s+scorsa|questo\s+mese|mese\s+scorso|questo\s+trimestre|trimestre\s+scorso|quest['’]?anno|anno\s+scorso/i.test(
      normalized,
    ) ||
    /(?:最近|近|过去|過去|前)\s*(?:半|[零〇一二两兩三四五六七八九十百\d]+)\s*(?:天|日|周|星期|个?月|個?月|年)(?:内|內|以内|以內)?/i.test(
      normalized,
    ) ||
    /[零〇一二两兩三四五六七八九十百\d]+\s*(?:天|日|周|星期|个?月|個?月|年)(?:内|內|以内|以內)/i.test(
      normalized,
    ) ||
    /(?:last|past)\s+\d{1,4}\s+(?:days?|weeks?|months?|years?)/i.test(normalized) ||
    /(?:negli\s+)?ultim[ei]\s+\d{1,4}\s+(?:giorni|settimane|mesi|anni)/i.test(normalized) ||
    /\b(?:19\d{2}|20\d{2}|21\d{2})\s*年(?:\s*\d{1,2}\s*月|\s*第?\s*[1-4一二三四]\s*(?:季度|季))?/i.test(
      normalized,
    ) ||
    /\b(?:19\d{2}|20\d{2}|21\d{2})(?:[-/]\d{1,2}(?![-/]\d)|\s*Q\s*\d)/i.test(normalized);

  return looksLikeDateIntent && !parseTrustedOrderDateFilter(normalized, field);
}

/**
 * Removes only strict, real Gregorian date tokens before the existing numeric
 * PII detector runs. Phone-like digit strings and invalid dates remain intact
 * and therefore continue to fail closed.
 */
export function redactValidatedOrderDateTokensForEgress(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\d{4}年\d{1,2}月\d{1,2}日?/g, (token) =>
      parseFullDateToken(token) ? "[DATE]" : token,
    )
    .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, (token) =>
      parseFullDateToken(token) ? "[DATE]" : token,
    )
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g, (token) =>
      parseFullDateToken(token) ? "[DATE]" : token,
    );
}

function parseAbsoluteDateExpression(value: string, field: DateField): AiOrderDateFilter | null {
  const tokens = extractFullDateTokens(value);
  if (tokens.length > 2) return null;
  if (tokens.length === 2) {
    const [from, to] = tokens;
    if (!from || !to || from.date > to.date) return null;
    return { expression: "absolute_range", field, from: from.date, to: to.date };
  }
  if (tokens.length === 1) {
    const token = tokens[0];
    if (!token) return null;
    if (/之前|以前|before|prima\s+del/i.test(value)) {
      return {
        expression: "absolute_range",
        field,
        from: null,
        to: formatCalendarDate(addCalendarDays(parseCalendarDate(token.date), -1)),
      };
    }
    if (/截至|截止|through|on\s+or\s+before|fino\s+al/i.test(value)) {
      return { expression: "absolute_range", field, from: null, to: token.date };
    }
    if (/之后|以后|after|dopo\s+il/i.test(value)) {
      return {
        expression: "absolute_range",
        field,
        from: formatCalendarDate(addCalendarDays(parseCalendarDate(token.date), 1)),
        to: null,
      };
    }
    if (/以来|since|dal\s+/i.test(value)) {
      return { expression: "absolute_range", field, from: token.date, to: null };
    }
    return { expression: "absolute_range", field, from: token.date, to: token.date };
  }

  const quarterPeriods = extractQuarterPeriods(value);
  if (quarterPeriods.length > 2) return null;
  if (quarterPeriods.length > 0) {
    const first = quarterPeriods[0];
    const last = quarterPeriods.at(-1);
    if (!first || !last) return null;
    const firstBounds = quarterBounds(first.year, first.quarter);
    const lastBounds = quarterBounds(last.year, last.quarter);
    if (firstBounds.from > lastBounds.to) return null;
    return periodDateFilter(value, field, firstBounds.from, lastBounds.to, quarterPeriods.length);
  }

  if (
    /\b(?:19\d{2}|20\d{2}|21\d{2})\s*年\s*\d{1,2}\s*月/.test(value) ||
    /\b(?:19\d{2}|20\d{2}|21\d{2})[-/]\d{1,2}(?![-/]\d)/.test(value)
  ) {
    const monthPeriods = extractMonthPeriods(value);
    if (monthPeriods.length === 0 || monthPeriods.length > 2) return null;
    const first = monthPeriods[0];
    const last = monthPeriods.at(-1);
    if (!first || !last) return null;
    const firstBounds = monthBounds(first.year, first.month);
    const lastBounds = monthBounds(last.year, last.month);
    if (firstBounds.from > lastBounds.to) return null;
    return periodDateFilter(value, field, firstBounds.from, lastBounds.to, monthPeriods.length);
  }

  const yearPeriods = [...value.matchAll(/\b(19\d{2}|20\d{2}|21\d{2})\s*年(?:全年)?/g)].map(
    (match) => Number(match[1]),
  );
  if (yearPeriods.length > 2) return null;
  if (yearPeriods.length > 0) {
    const first = yearPeriods[0];
    const last = yearPeriods.at(-1);
    if (!first || !last || first > last) return null;
    return periodDateFilter(value, field, `${first}-01-01`, `${last}-12-31`, yearPeriods.length);
  }
  return null;
}

function parseRollingDateExpression(value: string, field: DateField): AiOrderDateFilter | null {
  if (/(?:最近|近|过去|過去)?\s*半年(?:内|內|以内|以內)?/i.test(value)) {
    return { expression: "rolling_period", field, amount: 6, unit: "month" };
  }

  const chinese = value.match(
    /(?:最近|近|过去|過去|前)\s*([零〇一二两兩三四五六七八九十百\d]+)\s*(天|日|周|星期|个?月|個?月|年)(?:内|內|以内|以內)?/i,
  );
  if (chinese) {
    const amount = parseBoundedAmount(chinese[1]);
    const rawUnit = chinese[2] ?? "";
    const unit = /天|日/.test(rawUnit)
      ? "day"
      : /周|星期/.test(rawUnit)
        ? "week"
        : /月/.test(rawUnit)
          ? "month"
          : "year";
    return amount ? { expression: "rolling_period", field, amount, unit } : null;
  }

  const chineseWithin = value.match(
    /([零〇一二两兩三四五六七八九十百\d]+)\s*(天|日|周|星期|个?月|個?月|年)(?:内|內|以内|以內)/i,
  );
  if (chineseWithin) {
    const amount = parseBoundedAmount(chineseWithin[1]);
    const rawUnit = chineseWithin[2] ?? "";
    const unit = /天|日/.test(rawUnit)
      ? "day"
      : /周|星期/.test(rawUnit)
        ? "week"
        : /月/.test(rawUnit)
          ? "month"
          : "year";
    return amount ? { expression: "rolling_period", field, amount, unit } : null;
  }

  const english = value.match(/(?:last|past)\s+(\d{1,3})\s+(days?|weeks?|months?|years?)/i);
  if (english) {
    const amount = parseBoundedAmount(english[1]);
    const rawUnit = english[2]?.toLowerCase() ?? "";
    const unit = rawUnit.startsWith("day")
      ? "day"
      : rawUnit.startsWith("week")
        ? "week"
        : rawUnit.startsWith("month")
          ? "month"
          : "year";
    return amount ? { expression: "rolling_period", field, amount, unit } : null;
  }

  const italian = value.match(/(?:negli\s+)?ultim[ei]\s+(\d{1,3})\s+(giorni|settimane|mesi|anni)/i);
  if (italian) {
    const amount = parseBoundedAmount(italian[1]);
    const rawUnit = italian[2]?.toLowerCase() ?? "";
    const unit =
      rawUnit === "giorni"
        ? "day"
        : rawUnit === "settimane"
          ? "week"
          : rawUnit === "mesi"
            ? "month"
            : "year";
    return amount ? { expression: "rolling_period", field, amount, unit } : null;
  }
  return null;
}

function extractFullDateTokens(value: string) {
  const patterns = [
    /\d{4}年\d{1,2}月\d{1,2}日?/g,
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g,
  ];
  return patterns
    .flatMap((pattern) =>
      [...value.matchAll(pattern)].map((match) => ({
        index: match.index ?? 0,
        raw: match[0],
        date: parseFullDateToken(match[0]),
      })),
    )
    .filter((item): item is { index: number; raw: string; date: string } => Boolean(item.date))
    .sort((left, right) => left.index - right.index);
}

function extractRawFullDateTokens(value: string) {
  return [
    /\d{4}年\d{1,2}月\d{1,2}日?/g,
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g,
  ].flatMap((pattern) => value.match(pattern) ?? []);
}

function extractQuarterPeriods(value: string) {
  return [
    ...value.matchAll(
      /\b(19\d{2}|20\d{2}|21\d{2})\s*年?\s*(?:第?\s*([1-4一二三四])\s*(?:季度|季|quarter|trimestre)|Q\s*([1-4]))/gi,
    ),
  ].map((match) => {
    const rawQuarter = match[2] ?? match[3] ?? "";
    return {
      index: match.index ?? 0,
      year: Number(match[1]),
      quarter: /^[1-4]$/.test(rawQuarter)
        ? Number(rawQuarter)
        : ({ 一: 1, 二: 2, 三: 3, 四: 4 } as const)[rawQuarter as "一"],
    };
  });
}

function extractMonthPeriods(value: string) {
  return [
    /\b(19\d{2}|20\d{2}|21\d{2})\s*年\s*(1[0-2]|0?[1-9])\s*月(?!\s*\d)/g,
    /\b(19\d{2}|20\d{2}|21\d{2})[-/](1[0-2]|0?[1-9])(?!\d|[-/])/g,
  ]
    .flatMap((pattern) =>
      [...value.matchAll(pattern)].map((match) => ({
        index: match.index ?? 0,
        year: Number(match[1]),
        month: Number(match[2]),
      })),
    )
    .sort((left, right) => left.index - right.index);
}

function quarterBounds(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;
  return {
    from: formatCalendarDate(calendarDate(year, startMonth, 1)),
    to: formatCalendarDate(calendarDate(year, startMonth + 3, 0)),
  };
}

function monthBounds(year: number, month: number) {
  return {
    from: formatCalendarDate(calendarDate(year, month, 1)),
    to: formatCalendarDate(calendarDate(year, month + 1, 0)),
  };
}

function periodDateFilter(
  value: string,
  field: DateField,
  from: string,
  to: string,
  periodCount: number,
): AiOrderDateFilter {
  if (periodCount > 1) return { expression: "absolute_range", field, from, to };
  if (/之前|以前|before|prima\s+del/i.test(value)) {
    return {
      expression: "absolute_range",
      field,
      from: null,
      to: formatCalendarDate(addCalendarDays(parseCalendarDate(from), -1)),
    };
  }
  if (/截至|截止|through|on\s+or\s+before|fino\s+al/i.test(value)) {
    return { expression: "absolute_range", field, from: null, to };
  }
  if (/之后|以后|after|dopo/i.test(value)) {
    return {
      expression: "absolute_range",
      field,
      from: formatCalendarDate(addCalendarDays(parseCalendarDate(to), 1)),
      to: null,
    };
  }
  if (/以来|since|dal\s+/i.test(value)) {
    return { expression: "absolute_range", field, from, to: null };
  }
  return { expression: "absolute_range", field, from, to };
}

function parseFullDateToken(value: string) {
  const chinese = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (chinese)
    return validatedCalendarDate(Number(chinese[1]), Number(chinese[2]), Number(chinese[3]));

  const yearFirst = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirst) {
    return validatedCalendarDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }

  const european = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (european) {
    const day = Number(european[1]);
    const month = Number(european[2]);
    // 01/02/2026 is intentionally left for clarification rather than guessed.
    if (day <= 12 && month <= 12) return null;
    return validatedCalendarDate(Number(european[3]), month, day);
  }
  return null;
}

function validatedCalendarDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 2199 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const value = calendarDate(year, month, day);
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() + 1 !== month ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return formatCalendarDate(value);
}

function parseCalendarDate(value: string) {
  const parsed = parseFullDateToken(value);
  if (!parsed) throw new Error("日期无效");
  const [year, month, day] = parsed.split("-").map(Number);
  return calendarDate(year!, month!, day!);
}

function parseBoundedAmount(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[两兩]/g, "二");
  if (/^\d+$/.test(normalized)) {
    const amount = Number(normalized);
    return Number.isSafeInteger(amount) && amount >= 1 && amount <= 120 ? amount : null;
  }
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (normalized === "一百") return 100;
  if (normalized.startsWith("一百")) {
    const remainder = normalized.slice(2);
    const remainderAmount = remainder.startsWith("零")
      ? (digits[remainder.slice(1)] ?? -1)
      : remainder
        ? parseChineseUnderHundred(remainder, digits)
        : 0;
    if (remainderAmount < 0) return null;
    const amount = 100 + remainderAmount;
    return amount >= 1 && amount <= 120 ? amount : null;
  }
  const amount = parseChineseUnderHundred(normalized, digits);
  return amount >= 1 && amount <= 120 ? amount : null;
}

function parseChineseUnderHundred(normalized: string, digits: Record<string, number>) {
  if (normalized === "十") return 10;
  const [tensText, onesText] = normalized.split("十");
  return normalized.includes("十")
    ? (tensText ? (digits[tensText] ?? -10) : 1) * 10 + (onesText ? (digits[onesText] ?? -100) : 0)
    : (digits[normalized] ?? -1);
}

function rollingStartDate(value: Date, amount: number, unit: "day" | "week" | "month" | "year") {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 120)
    throw new Error("滚动日期范围无效");
  if (unit === "day") return addCalendarDays(value, -(amount - 1));
  if (unit === "week") return addCalendarDays(value, -(amount * 7 - 1));
  if (unit === "month") return subtractCalendarMonths(value, amount);
  return subtractCalendarYears(value, amount);
}

function subtractCalendarMonths(value: Date, months: number) {
  const sourceYear = value.getUTCFullYear();
  const sourceMonth = value.getUTCMonth() + 1;
  const sourceDay = value.getUTCDate();
  const targetFirst = calendarDate(sourceYear, sourceMonth - months, 1);
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonth = targetFirst.getUTCMonth() + 1;
  const lastDay = calendarDate(targetYear, targetMonth + 1, 0).getUTCDate();
  return calendarDate(targetYear, targetMonth, Math.min(sourceDay, lastDay));
}

function subtractCalendarYears(value: Date, years: number) {
  const year = value.getUTCFullYear() - years;
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  const lastDay = calendarDate(year, month + 1, 0).getUTCDate();
  return calendarDate(year, month, Math.min(day, lastDay));
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

function absolutePeriodLabel(from: string | null, to: string | null) {
  if (from && to && from === to) return from;
  if (from && to) return `${from}—${to}`;
  if (from) return `${from}起`;
  return `截至${to}`;
}

function rollingUnitLabel(unit: "day" | "week" | "month" | "year") {
  if (unit === "day") return "天";
  if (unit === "week") return "周";
  if (unit === "month") return "个月";
  return "年";
}

function dateFieldLabel(field: DateField) {
  if (field === "completed_at") return "完成时间";
  if (field === "updated_at") return "更新时间";
  return "创建时间";
}
