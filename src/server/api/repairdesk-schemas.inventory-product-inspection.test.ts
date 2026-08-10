import { describe, expect, it } from "vitest";

import { inventoryProductInspectionSchema } from "./repairdesk-schemas";

describe("inventory product inspection contract", () => {
  it("accepts battery boundary values, an explicit unknown value, and all four Face ID states", () => {
    for (const battery_health of [0, 100, null]) {
      expect(inventoryProductInspectionSchema.safeParse({ battery_health }).success).toBe(true);
    }
    for (const face_id_status of ["not_tested", "normal", "abnormal", "not_applicable"] as const) {
      expect(inventoryProductInspectionSchema.safeParse({ face_id_status }).success).toBe(true);
    }
  });

  it("rejects invalid battery values, broad legacy checks and empty payloads", () => {
    expect(inventoryProductInspectionSchema.safeParse({ battery_health: -1 }).success).toBe(false);
    expect(inventoryProductInspectionSchema.safeParse({ battery_health: 100.5 }).success).toBe(
      false,
    );
    expect(inventoryProductInspectionSchema.safeParse({}).success).toBe(false);
    expect(inventoryProductInspectionSchema.safeParse({ touch_id_status: "passed" }).success).toBe(
      false,
    );
  });
});
