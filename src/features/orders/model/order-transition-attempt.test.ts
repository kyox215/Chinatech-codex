import { describe, expect, it } from "vitest";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import {
  getOrderTransitionAttempt,
  isDefinitiveTransitionFailure,
} from "./order-transition-attempt";

const input = {
  scope: "store-a:user-a",
  id: "order-a",
  to: "completed" as const,
  updatedAt: "2026-09-26T10:00:00Z",
};

describe("order transition retry identity", () => {
  it("replays the same version and key after a lost response and background refresh", () => {
    const first = getOrderTransitionAttempt(undefined, input);
    const retry = getOrderTransitionAttempt(first, { ...input, updatedAt: "2026-09-26T10:01:00Z" });
    expect(retry).toBe(first);
    expect(retry.expected_updated_at).toBe(input.updatedAt);
  });
  it.each([
    { scope: "store-b:user-a" },
    { id: "order-b" },
    { reason: "changed" },
    { to: "cancelled" as const },
  ])("starts a new attempt when intent changes: %o", (change) => {
    const first = getOrderTransitionAttempt(undefined, input);
    const next = getOrderTransitionAttempt(first, { ...input, ...change });
    expect(next.idempotency_key).not.toBe(first.idempotency_key);
  });
  it("only clears retry identity after a definitive rejection", () => {
    expect(isDefinitiveTransitionFailure(new RepairDeskApiError("conflict", 409))).toBe(true);
    expect(isDefinitiveTransitionFailure(new RepairDeskApiError("unavailable", 503))).toBe(false);
    expect(isDefinitiveTransitionFailure(new TypeError("lost connection"))).toBe(false);
    expect(
      isDefinitiveTransitionFailure(new RepairDeskApiError("connection lost after commit", 400)),
    ).toBe(false);
    expect(
      isDefinitiveTransitionFailure(new RepairDeskApiError("工单已被更新，请刷新后再试", 400)),
    ).toBe(true);
  });
});
