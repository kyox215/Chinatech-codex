export const MEMO_DUE_AT_TIME_ZONE = "Europe/Rome";

export type MemoDueAtInputResult =
  | { status: "empty"; iso: null }
  | { status: "valid"; iso: string }
  | {
      status: "invalid";
      iso: null;
      reason: "invalid_format" | "nonexistent_time" | "ambiguous_time";
    };

export type MemoDueAtDisplayResult =
  | { status: "empty"; value: "" }
  | { status: "valid"; value: string; iso: string }
  | { status: "invalid"; value: ""; reason: "invalid_server_timestamp" };

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const wallClockFormatter = new Intl.DateTimeFormat("en-CA-u-hc-h23", {
  timeZone: MEMO_DUE_AT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const absoluteTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function readWallClockParts(timestamp: number): Omit<WallClockParts, "millisecond"> {
  const values = Object.fromEntries(
    wallClockFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function parseWallClock(value: string): WallClockParts | null {
  const match = localDateTimePattern.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: 0,
    millisecond: 0,
  };
  if (parts.year < 1000 || parts.year > 9999) return null;
  const normalized = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ),
  );
  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day ||
    normalized.getUTCHours() !== parts.hour ||
    normalized.getUTCMinutes() !== parts.minute ||
    normalized.getUTCSeconds() !== parts.second ||
    normalized.getUTCMilliseconds() !== parts.millisecond
  ) {
    return null;
  }
  return parts;
}

function getOffsetMilliseconds(timestamp: number) {
  const wallClock = readWallClockParts(timestamp);
  const timestampWithoutMilliseconds = timestamp - new Date(timestamp).getUTCMilliseconds();
  return (
    Date.UTC(
      wallClock.year,
      wallClock.month - 1,
      wallClock.day,
      wallClock.hour,
      wallClock.minute,
      wallClock.second,
    ) - timestampWithoutMilliseconds
  );
}

function wallClockMatches(timestamp: number, expected: WallClockParts) {
  const actual = readWallClockParts(timestamp);
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second &&
    new Date(timestamp).getUTCMilliseconds() === expected.millisecond
  );
}

export function parseMemoDueAtInput(value: string): MemoDueAtInputResult {
  if (value === "") return { status: "empty", iso: null };
  const wallClock = parseWallClock(value);
  if (!wallClock) {
    return { status: "invalid", iso: null, reason: "invalid_format" };
  }

  const wallClockAsUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
    wallClock.millisecond,
  );
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(getOffsetMilliseconds(wallClockAsUtc + hours * 60 * 60 * 1000));
  }
  const matches = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((timestamp, index, candidates) => {
      return candidates.indexOf(timestamp) === index && wallClockMatches(timestamp, wallClock);
    });

  if (matches.length === 0) {
    return { status: "invalid", iso: null, reason: "nonexistent_time" };
  }
  if (matches.length > 1) {
    return { status: "invalid", iso: null, reason: "ambiguous_time" };
  }
  return { status: "valid", iso: new Date(matches[0]).toISOString() };
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

export function formatMemoDueAtForInput(value?: string | null): MemoDueAtDisplayResult {
  if (!value) return { status: "empty", value: "" };
  if (!absoluteTimestampPattern.test(value)) {
    return { status: "invalid", value: "", reason: "invalid_server_timestamp" };
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return { status: "invalid", value: "", reason: "invalid_server_timestamp" };
  }
  const parts = readWallClockParts(instant.getTime());
  const localValue = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
  return { status: "valid", value: localValue, iso: instant.toISOString() };
}
