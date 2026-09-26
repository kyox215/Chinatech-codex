import { describe, expect, it } from "vitest";
import type { OrderDetail } from "@/lib/repairdesk/types";
import { buildEditForm } from "./edit-order-form";

describe("order device note snapshot", () => {
  it.each([
    ["", ""],
    [undefined, "legacy device note"],
    ["order note", "order note"],
  ])(
    "keeps an explicit snapshot note %s distinct from an absent field",
    (snapshotNote, expected) => {
      const detail = {
        order: {
          updated_at: "2026-09-26T00:00:00Z",
          customer_name: "Test",
          customer_phone: "",
          device_snapshot: { brand: "Test", model: "Phone", device_notes: snapshotNote },
          fault_prices: [],
          deposit_amount: 0,
        },
        device: { device_notes: "legacy device note" },
      } as unknown as OrderDetail;
      expect(buildEditForm(detail).device_notes).toBe(expected);
    },
  );
});
