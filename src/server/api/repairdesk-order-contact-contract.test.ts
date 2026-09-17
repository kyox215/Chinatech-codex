import { describe, expect, it } from "vitest";
import { patchOrderInputSchema, updateOrderInputSchema } from "./repairdesk-schemas";

const version = "2026-09-17T08:00:00.000Z";

describe("order customer CAS request schemas", () => {
  it.each([{ customer_name: "" }, { customer_phone: "+390000000001" }, { contact_phones: [] }])(
    "requires the captured customer version for identity change %j",
    (changes) => {
      expect(
        patchOrderInputSchema.safeParse({ expected_updated_at: version, changes }).success,
      ).toBe(false);
      expect(
        patchOrderInputSchema.parse({
          expected_updated_at: version,
          expected_customer_updated_at: version,
          changes,
        }),
      ).toEqual({
        expected_updated_at: version,
        expected_customer_updated_at: version,
        changes,
      });
    },
  );

  it("does not require customer CAS for an unrelated field and rejects invalid timestamps", () => {
    const input = {
      expected_updated_at: version,
      changes: { issue_description: "Synthetic issue" },
    };
    expect(patchOrderInputSchema.safeParse(input).success).toBe(true);
    expect(
      patchOrderInputSchema.safeParse({ ...input, expected_customer_updated_at: "latest" }).success,
    ).toBe(false);
  });

  it("keeps the backup replacement and customer version in a full update", () => {
    const input = {
      expected_updated_at: version,
      customer_name: "",
      customer_phone: "+390000000001",
      contact_phones: [],
      device_brand: "Synthetic",
      device_model: "Device",
      issue_description: "Issue",
      fault_prices: [],
    };
    expect(updateOrderInputSchema.safeParse(input).success).toBe(false);
    expect(
      updateOrderInputSchema.parse({ ...input, expected_customer_updated_at: version }),
    ).toMatchObject({ contact_phones: [], expected_customer_updated_at: version });
  });
});
