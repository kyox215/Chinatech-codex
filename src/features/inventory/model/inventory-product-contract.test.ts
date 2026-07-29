import { describe, expect, it } from "vitest";

import {
  createInventoryProductBodySchema,
  inventoryProductListFiltersSchema,
} from "@/server/api/repairdesk-schemas";

describe("inventory product API contract", () => {
  it.each(["phone", "tablet", "computer", "game_console", "other"])(
    "accepts a minimal %s product",
    (category) => {
      const result = createInventoryProductBodySchema.parse({
        input: {
          idempotency_key: "00000000-0000-4000-8000-000000000001",
          category,
          brand: "Synthetic Brand",
          model: "Synthetic Model",
        },
      });
      expect(result.input).not.toHaveProperty("source_type");
      expect(result.input).not.toHaveProperty("cost_amount");
      expect(result.input).not.toHaveProperty("serial_or_imei");
    },
  );

  it("requires identifier kind and value together", () => {
    expect(() =>
      createInventoryProductBodySchema.parse({
        input: {
          idempotency_key: "00000000-0000-4000-8000-000000000001",
          category: "phone",
          brand: "Synthetic Brand",
          model: "Synthetic Model",
          serial_or_imei: "490154203237518",
        },
      }),
    ).toThrow();
  });

  it("rejects unknown buyback and actor/store fields", () => {
    expect(() =>
      createInventoryProductBodySchema.parse({
        input: {
          idempotency_key: "00000000-0000-4000-8000-000000000001",
          category: "phone",
          brand: "Synthetic Brand",
          model: "Synthetic Model",
          source_type: "buyback",
          customer_id: "customer",
          store_id: "store",
        },
      }),
    ).toThrow();
  });

  it("bounds product filters", () => {
    expect(
      inventoryProductListFiltersSchema.parse({
        categories: ["phone", "tablet"],
        statuses: ["in_stock"],
      }),
    ).toEqual({ categories: ["phone", "tablet"], statuses: ["in_stock"] });
  });
});
