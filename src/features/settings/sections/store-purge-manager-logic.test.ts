import { describe, expect, it } from "vitest";

import type { StorePurgeRequest } from "@/lib/repairdesk/types";

import {
  cancellableState,
  formatTimestamp,
  isKnownPurgeRequestState,
  isMutationOutcomeResolved,
} from "./store-purge-manager-logic";

const request: StorePurgeRequest = {
  request_id: "request-1",
  store_id: "store-1",
  state: "cooling",
  requested_at: "2026-08-27T00:00:00.000Z",
  cooling_until: "2099-01-01T00:00:00.000Z",
  export_job_id: "export-1",
};

describe("store purge manager logic", () => {
  it("accepts only the server-declared request states", () => {
    expect(isKnownPurgeRequestState("cooling")).toBe(true);
    expect(isKnownPurgeRequestState("unexpected")).toBe(false);
    expect(isKnownPurgeRequestState(null)).toBe(false);
  });

  it("only allows cancellation before the destructive step starts", () => {
    expect(cancellableState(request)).toBe(true);
    expect(cancellableState({ ...request, state: "purging" })).toBe(false);
    expect(cancellableState({ ...request, destructive_step_started: true })).toBe(false);
  });

  it("matches each mutation with its safe terminal status", () => {
    expect(
      isMutationOutcomeResolved(
        { kind: "request", previousState: null },
        { ...request, state: "cooling" },
      ),
    ).toBe(true);
    expect(
      isMutationOutcomeResolved(
        { kind: "confirm", previousState: "ready_for_confirmation" },
        { ...request, state: "scheduled" },
      ),
    ).toBe(true);
    expect(
      isMutationOutcomeResolved(
        { kind: "cancel", previousState: "cooling" },
        { ...request, state: "cancelled" },
      ),
    ).toBe(true);
    expect(isMutationOutcomeResolved({ kind: "cancel", previousState: "cooling" }, request)).toBe(
      false,
    );
  });

  it("formats purge timestamps in Rome for each locale without echoing invalid input", () => {
    const hostTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    const instant = "2026-03-29T01:30:00.000Z";
    try {
      expect(formatTimestamp(instant, "zh-CN")).toBe("2026年3月29日 03:30");
      expect(formatTimestamp(instant, "it-IT")).toBe("29 mar 2026, 03:30");
      expect(formatTimestamp(instant, "en")).toBe("Mar 29, 2026, 3:30 AM");
      expect(formatTimestamp("RAW_INVALID_TIMESTAMP", "zh-CN")).toBe("时间不可用");
      expect(formatTimestamp("RAW_INVALID_TIMESTAMP", "it-IT")).toBe("Data non disponibile");
      expect(formatTimestamp("RAW_INVALID_TIMESTAMP", "en")).toBe("Date unavailable");
    } finally {
      if (hostTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = hostTimezone;
    }
  });
});
