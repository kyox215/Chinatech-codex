import { describe, expect, it } from "vitest";
import {
  inventorySalesWorkflowCommandBodySchema,
  inventorySalesWorkflowReadBodySchema,
  inventorySalesWorkflowReportBodySchema,
} from "./workflow-contracts";
const id = "20000000-0000-4000-8000-000000000001";
const common = { sale_order_id: id, idempotency_key: id, expected_workflow_version: 0 };
const fiscal = {
  ...common,
  command: "fiscal.record",
  payload: { document_type: "receipt", reference: "R1", issued_at: "2026-09-01T10:00:00Z" },
};
describe("sales workflow strict contracts", () => {
  it("accepts version-zero fiscal command and trims reference", () => {
    expect(
      inventorySalesWorkflowCommandBodySchema.parse({
        ...fiscal,
        payload: { ...fiscal.payload, reference: " R1 " },
      }).payload,
    ).toMatchObject({ reference: "R1" });
  });
  it.each([
    { ...fiscal, actor_id: id },
    { ...fiscal, store_id: id },
    { ...fiscal, expected_workflow_version: -1 },
    { ...fiscal, expected_workflow_version: 0.5 },
    { ...fiscal, payload: { ...fiscal.payload, paid_cents: 1 } },
    { ...fiscal, payload: { ...fiscal.payload, reference: " " } },
    { ...fiscal, payload: { ...fiscal.payload, issued_at: "2026-09-01" } },
    { ...fiscal, payload: { ...fiscal.payload, correction_reason: " " } },
  ])("rejects injected scope, invalid versions and fiscal values %#", (value) => {
    expect(inventorySalesWorkflowCommandBodySchema.safeParse(value).success).toBe(false);
  });
  it("accepts all bounded operational commands", () => {
    for (const [command, payload] of [
      ["fiscal.verify", { expected_fiscal_revision: 1 }],
      ["followup.set", { assignee_membership_id: null, follow_up_at: null }],
      ["issue.open", { kind: "payment_mismatch", summary: "Check receipt" }],
      ["issue.resolve", { issue_id: id, resolution: "Checked receipt" }],
    ])
      expect(
        inventorySalesWorkflowCommandBodySchema.safeParse({ ...common, command, payload }).success,
      ).toBe(true);
  });
  it("rejects reading an injected actor", () => {
    expect(
      inventorySalesWorkflowReadBodySchema.safeParse({ sale_order_id: id, actor_id: id }).success,
    ).toBe(false);
  });
  it("validates real calendar dates and bounded pages", () => {
    expect(inventorySalesWorkflowReportBodySchema.parse({ business_date: "2024-02-29" })).toEqual({
      business_date: "2024-02-29",
      offset: 0,
      limit: 30,
    });
    for (const value of [
      { business_date: "2025-02-29" },
      { business_date: "2026-09-31" },
      { business_date: "2026-09-26", limit: 101 },
      { business_date: "2026-09-26", store_id: id },
    ]) {
      expect(inventorySalesWorkflowReportBodySchema.safeParse(value).success).toBe(false);
    }
  });
});
