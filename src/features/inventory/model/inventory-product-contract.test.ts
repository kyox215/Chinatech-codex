import { describe, expect, it } from "vitest";

import {
  createInventoryProductBodySchema,
  inventoryProductListFiltersSchema,
  updateInventoryProductBodySchema,
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

  it("accepts multiple valid device identifiers and variant-level GTIN", () => {
    const result = createInventoryProductBodySchema.parse({
      input: {
        idempotency_key: "00000000-0000-4000-8000-000000000001",
        category: "phone",
        brand: "Apple",
        model: "iPhone 15",
        ram_capacity: "6 GB",
        storage_capacity: "128 GB",
        gtin: "4006381333931",
        identifiers: [
          { kind: "imei1", value: "490154203237518", source: "scan", primary: true },
          { kind: "eid", value: "89043051202500726225007991441943", source: "scan" },
        ],
      },
    });
    expect(result.input.identifiers).toHaveLength(2);
  });

  it("rejects invalid IMEI, EID, GTIN and duplicate identifier values", () => {
    for (const patch of [
      { identifiers: [{ kind: "imei1", value: "123456789012345", source: "manual" }] },
      { identifiers: [{ kind: "eid", value: "123", source: "manual" }] },
      { gtin: "12345678" },
      {
        identifiers: [
          { kind: "imei1", value: "490154203237518", source: "manual" },
          { kind: "serial", value: "490154203237518", source: "manual" },
        ],
      },
    ]) {
      expect(
        createInventoryProductBodySchema.safeParse({
          input: {
            idempotency_key: "00000000-0000-4000-8000-000000000001",
            category: "phone",
            brand: "Apple",
            model: "iPhone 15",
            ...patch,
          },
        }).success,
      ).toBe(false);
    }
  });

  it("requires one primary identifier and a CAS version when updating", () => {
    expect(
      updateInventoryProductBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000010",
        input: {
          idempotency_key: "00000000-0000-4000-8000-000000000011",
          expected_version: 2,
          category: "computer",
          brand: "Apple",
          model: "MacBook Air",
          identifiers: [
            { kind: "serial", value: "C02EXAMPLE123", source: "manual", primary: true },
          ],
        },
      }).input.expected_version,
    ).toBe(2);
  });
});
