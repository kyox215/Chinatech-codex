import { describe, expect, it } from "vitest";

import { CUSTOMER_STATUS_TOKEN_PATTERN, getCustomerStatusStage } from "./customer-status";

describe("customer status public model", () => {
  it("accepts only 256-bit base64url tokens", () => {
    expect(CUSTOMER_STATUS_TOKEN_PATTERN.test("A".repeat(43))).toBe(true);
    expect(CUSTOMER_STATUS_TOKEN_PATTERN.test("A".repeat(42))).toBe(false);
    expect(CUSTOMER_STATUS_TOKEN_PATTERN.test(`${"A".repeat(42)}=`)).toBe(false);
    expect(CUSTOMER_STATUS_TOKEN_PATTERN.test(`${"A".repeat(42)}.`)).toBe(false);
  });

  it("maps workflow buckets to customer-safe fixed labels", () => {
    expect(getCustomerStatusStage("diagnosing", "new")).toMatchObject({
      stage: "diagnosing",
      progress_percent: 28,
    });
    expect(getCustomerStatusStage("", "waiting_pickup")).toMatchObject({
      stage: "pickup",
      progress_percent: 90,
    });
    expect(getCustomerStatusStage("pickup", "repaired")).toMatchObject({
      stage: "pickup",
      progress_percent: 90,
    });
    expect(getCustomerStatusStage("", "repaired")).toMatchObject({
      stage: "pickup",
      progress_percent: 90,
    });
    expect(getCustomerStatusStage("diagnosis", "diagnosing")).toMatchObject({
      stage: "diagnosing",
      progress_percent: 28,
    });
    expect(getCustomerStatusStage("private-custom-code", "unknown")).toMatchObject({
      stage: "in_progress",
      progress_percent: 50,
    });
  });
});
