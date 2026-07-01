import { describe, expect, it } from "vitest";

import {
  createOrderSchema,
  customerListPageInputSchema,
  customerSearchBodySchema,
  onboardingRequestBodySchema,
  patchOrderInputSchema,
  paymentBodySchema,
  updateOrderInputSchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

describe("repairdesk API schemas", () => {
  it("coerces payment amounts", () => {
    expect(
      paymentBodySchema.parse({
        id: "R1",
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        amount: "25.5",
      }),
    ).toMatchObject({
      id: "R1",
      expected_updated_at: "2026-06-11T00:00:00.000Z",
      amount: 25.5,
    });
  });

  it("applies customer search defaults", () => {
    expect(customerSearchBodySchema.parse({})).toEqual({ q: "", limit: 8 });
    expect(() => customerSearchBodySchema.parse({ q: "333", limit: 13 })).toThrow();
  });

  it("coerces and caps customer page input", () => {
    expect(customerListPageInputSchema.parse({ page: "2", pageSize: "75" })).toMatchObject({
      page: 2,
      pageSize: 75,
    });
    expect(() => customerListPageInputSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("accepts WhatsApp notification template metadata", () => {
    expect(
      whatsappNotificationBodySchema.parse({
        id: "R1",
        body: "Messaggio",
        template_kind: "pickup_ready",
        transition_to: "notified",
      }),
    ).toMatchObject({
      template_kind: "pickup_ready",
      transition_to: "notified",
    });
  });

  it("rejects incomplete order creation payloads", () => {
    expect(() =>
      createOrderSchema.parse({
        order_type: "normal",
        status: "new",
        fault_prices: [],
      }),
    ).toThrow();
  });

  it("accepts and validates device unlock metadata", () => {
    expect(
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_unlock: { method: "pin", value: "001258" },
      }).device_unlock,
    ).toEqual({ method: "pin", value: "001258" });

    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 2, 5] },
      }),
    ).toThrow();
  });

  it("rejects technician changes in inline order patches", () => {
    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { technician_name: "Chen" },
      }),
    ).toThrow();
  });

  it("accepts device unlock inline patches without exposing a technician patch hole", () => {
    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pattern", pattern: [1, 2, 5, 8] } },
      }).changes.device_unlock,
    ).toEqual({ method: "pattern", pattern: [1, 2, 5, 8] });

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pin", value: "12a4" } },
      }),
    ).toThrow();
  });

  it("validates onboarding request mode-specific fields", () => {
    expect(
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
          requested_role: "technician",
        },
      }).input,
    ).toMatchObject({
      request_type: "join_store",
      requested_role: "technician",
    });

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: { request_type: "create_store" },
      }),
    ).toThrow("请填写要创建的店铺名称");
  });
});
