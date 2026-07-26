import { describe, expect, it } from "vitest";

import { applyInventoryWorkflowV2InputSchema } from "./inventory-v2-workflow-contract";

const base = {
  expected_updated_at: "2026-07-26T00:00:00.000Z",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
};

describe("applyInventoryWorkflowV2InputSchema", () => {
  it("accepts strict inspection, transition and commercial commands", () => {
    expect(
      applyInventoryWorkflowV2InputSchema.parse({
        ...base,
        operation: "inspect",
        target_status: "evaluating",
        inspection: {
          imei_check_status: "pass",
          activation_lock_status: "pass",
          data_wipe_status: "pass",
          cosmetic_grade: "good",
          functional_grade: "passed",
          battery_health: 89,
        },
      }),
    ).toMatchObject({ operation: "inspect", target_status: "evaluating" });
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "transition",
        target_status: "listed",
      }).success,
    ).toBe(true);
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "update_commercials",
        commercial_patch: { cost_amount: 200, list_price: 349.9, warranty_months: 12 },
      }).success,
    ).toBe(true);
  });

  it("rejects missing payloads, terminal statuses, unknown keys and invalid cents", () => {
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({ ...base, operation: "inspect" }).success,
    ).toBe(false);
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "transition",
        target_status: "sold",
      }).success,
    ).toBe(false);
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "update_commercials",
        target_status: "listed",
        commercial_patch: { list_price: 300 },
      }).success,
    ).toBe(false);
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "transition",
        target_status: "listed",
        inspection: { imei_check_status: "pass" },
      }).success,
    ).toBe(false);
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "update_commercials",
        commercial_patch: { list_price: 10.001 },
      }).success,
    ).toBe(false);
    expect(
      applyInventoryWorkflowV2InputSchema.safeParse({
        ...base,
        operation: "inspect",
        inspection: { imei_check_status: "pass", secret: true },
      }).success,
    ).toBe(false);
  });
});
