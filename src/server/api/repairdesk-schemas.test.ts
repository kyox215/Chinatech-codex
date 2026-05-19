import { describe, expect, it } from "vitest";

import {
  createOrderSchema,
  customerSearchBodySchema,
  paymentBodySchema,
} from "./repairdesk-schemas";

describe("repairdesk API schemas", () => {
  it("coerces payment amounts", () => {
    expect(paymentBodySchema.parse({ id: "R1", amount: "25.5" })).toMatchObject({
      id: "R1",
      amount: 25.5,
    });
  });

  it("applies customer search defaults", () => {
    expect(customerSearchBodySchema.parse({})).toEqual({ q: "", limit: 6 });
  });

  it("rejects incomplete order creation payloads", () => {
    expect(() =>
      createOrderSchema.parse({
        order_type: "normal",
        status: "new",
        technician_name: "Chen",
        fault_prices: [],
      }),
    ).toThrow();
  });
});
