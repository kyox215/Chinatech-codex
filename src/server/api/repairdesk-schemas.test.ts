import { describe, expect, it } from "vitest";

import {
  createOrderSchema,
  customerSearchBodySchema,
  onboardingRequestBodySchema,
  paymentBodySchema,
  whatsappNotificationBodySchema,
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
        technician_name: "Chen",
        fault_prices: [],
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
