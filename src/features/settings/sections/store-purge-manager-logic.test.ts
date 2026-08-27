import { describe, expect, it } from "vitest";

import type { StorePurgeRequest } from "@/lib/repairdesk/types";

import {
  cancellableState,
  isKnownPurgeRequestState,
  isMutationOutcomeResolved,
  purgeStatusCopy,
  purgeUnavailableCopy,
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

  it("keeps status and capability copy centralized", () => {
    expect(purgeStatusCopy("ready_for_confirmation")).toBe("可以进行最终确认");
    expect(purgeStatusCopy("unknown")).toBe("永久删除处理中");
    expect(purgeUnavailableCopy("primary_owner_required")).toContain("店铺主账号");
  });
});
