import { afterEach, describe, expect, it } from "vitest";

import { formatMemoDueAtForInput, parseMemoDueAtInput } from "./memo-due-at";

const originalTimeZone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimeZone;
});

describe("memo due-at Europe/Rome conversion", () => {
  it.each([
    ["2026-02-14T10:30", "2026-02-14T09:30:00.000Z"],
    ["2026-07-14T10:30", "2026-07-14T08:30:00.000Z"],
    ["2026-03-29T01:59", "2026-03-29T00:59:00.000Z"],
    ["2026-03-29T03:00", "2026-03-29T01:00:00.000Z"],
    ["2026-10-25T01:59", "2026-10-24T23:59:00.000Z"],
    ["2026-10-25T03:00", "2026-10-25T02:00:00.000Z"],
  ])("converts the unique Rome wall time %s to %s", (localValue, iso) => {
    expect(parseMemoDueAtInput(localValue)).toEqual({ status: "valid", iso });
  });

  it("distinguishes empty, malformed, nonexistent, and ambiguous values", () => {
    expect(parseMemoDueAtInput("")).toEqual({ status: "empty", iso: null });
    expect(parseMemoDueAtInput("2026-02-30T10:00")).toEqual({
      status: "invalid",
      iso: null,
      reason: "invalid_format",
    });
    expect(parseMemoDueAtInput("not-a-date")).toEqual({
      status: "invalid",
      iso: null,
      reason: "invalid_format",
    });
    expect(parseMemoDueAtInput("2026-03-29T02:30")).toEqual({
      status: "invalid",
      iso: null,
      reason: "nonexistent_time",
    });
    expect(parseMemoDueAtInput("2026-10-25T02:30")).toEqual({
      status: "invalid",
      iso: null,
      reason: "ambiguous_time",
    });
  });

  it("keeps server seconds and milliseconds in the canonical instant while backfilling minutes", () => {
    expect(formatMemoDueAtForInput("2026-07-14T08:30:45.123Z")).toEqual({
      status: "valid",
      value: "2026-07-14T10:30",
      iso: "2026-07-14T08:30:45.123Z",
    });
    expect(parseMemoDueAtInput("2026-07-14T10:30:45.123")).toEqual({
      status: "invalid",
      iso: null,
      reason: "invalid_format",
    });
  });

  it.each(["UTC", "America/New_York", "Europe/Rome"])(
    "does not depend on the host TZ=%s",
    (hostTimeZone) => {
      process.env.TZ = hostTimeZone;
      expect(parseMemoDueAtInput("2026-07-14T10:30")).toEqual({
        status: "valid",
        iso: "2026-07-14T08:30:00.000Z",
      });
      expect(formatMemoDueAtForInput("2026-07-14T08:30:45.123Z")).toEqual({
        status: "valid",
        value: "2026-07-14T10:30",
        iso: "2026-07-14T08:30:45.123Z",
      });
    },
  );

  it("backfills UTC instants as Rome wall time across standard and daylight time", () => {
    expect(formatMemoDueAtForInput("2026-02-14T09:30:00.000Z")).toEqual({
      status: "valid",
      value: "2026-02-14T10:30",
      iso: "2026-02-14T09:30:00.000Z",
    });
    expect(formatMemoDueAtForInput("2026-07-14T08:30:00.000Z")).toEqual({
      status: "valid",
      value: "2026-07-14T10:30",
      iso: "2026-07-14T08:30:00.000Z",
    });
    expect(formatMemoDueAtForInput("2026-07-14T08:30Z")).toEqual({
      status: "valid",
      value: "2026-07-14T10:30",
      iso: "2026-07-14T08:30:00.000Z",
    });
  });

  it("fails closed without throwing for invalid or non-absolute server timestamps", () => {
    expect(formatMemoDueAtForInput(null)).toEqual({ status: "empty", value: "" });
    expect(formatMemoDueAtForInput("not-a-timestamp")).toEqual({
      status: "invalid",
      value: "",
      reason: "invalid_server_timestamp",
    });
    expect(formatMemoDueAtForInput("2026-07-14T10:30:00")).toEqual({
      status: "invalid",
      value: "",
      reason: "invalid_server_timestamp",
    });
  });
});
