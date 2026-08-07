import { describe, expect, it } from "vitest";

import {
  inventoryLifecycleCommandBodySchema,
  inventoryLifecycleCommandNames,
  inventoryLifecycleCommandRequiresManager,
} from "./contracts";

describe("inventory lifecycle command contract", () => {
  it("keeps the command surface explicit", () => {
    expect(inventoryLifecycleCommandNames).toContain("reservation.create");
    expect(inventoryLifecycleCommandNames).toContain("after_sales.close");
    expect(inventoryLifecycleCommandNames).not.toContain("import.seatable");
  });

  it("rejects browser-supplied store and actor scope", () => {
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        command: "reservation.create",
        idempotency_key: "00000000-0000-4000-8000-000000000001",
        payload: { store_id: "store", stock_unit_id: "unit" },
      }),
    ).toThrow();
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        command: "reservation.create",
        idempotency_key: "00000000-0000-4000-8000-000000000001",
        payload: { actor_id: "actor", stock_unit_id: "unit" },
      }),
    ).toThrow();
  });

  it("marks money-disposition commands as manager-only", () => {
    expect(inventoryLifecycleCommandRequiresManager("reservation.cancel")).toBe(true);
    expect(inventoryLifecycleCommandRequiresManager("payment.append")).toBe(false);
  });

  it("keeps lifecycle payloads strict and money precision bounded", () => {
    const base = {
      command: "reservation.create" as const,
      idempotency_key: "00000000-0000-4000-8000-000000000001",
      payload: {
        stock_unit_id: "00000000-0000-4000-8000-000000000002",
        expected_unit_version: 1,
        agreed_price: "199.90",
        customer_id: "00000000-0000-4000-8000-000000000003",
      },
    };
    const parsed = inventoryLifecycleCommandBodySchema.parse(base);
    expect((parsed.payload as { agreed_price: number }).agreed_price).toBe(199.9);
    const customerPayload = {
      ...base,
      payload: {
        ...base.payload,
        customer_id: "00000000-0000-4000-8000-000000000004",
      },
    };
    expect(
      (
        inventoryLifecycleCommandBodySchema.parse(customerPayload).payload as {
          customer_id: string;
        }
      ).customer_id,
    ).toBe("00000000-0000-4000-8000-000000000004");
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        ...base,
        payload: { ...base.payload, customer_id: "cust_1" },
      }),
    ).toThrow();
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        ...base,
        payload: { ...base.payload, customer_id: "not-a-uuid" },
      }),
    ).toThrow();
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        ...base,
        payload: { ...base.payload, agreed_price: "199.999" },
      }),
    ).toThrow();
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        ...base,
        payload: { ...base.payload, agreed_price: 199.999 },
      }),
    ).toThrow();
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        ...base,
        payload: { ...base.payload, unexpected: true },
      }),
    ).toThrow();
    expect(() =>
      inventoryLifecycleCommandBodySchema.parse({
        ...base,
        payload: {
          ...base.payload,
          checks: Object.fromEntries(
            Array.from({ length: 33 }, (_, index) => [`check_${index}`, true]),
          ),
        },
      }),
    ).toThrow();
  });
});
