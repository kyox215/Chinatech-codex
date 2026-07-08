import { describe, expect, it } from "vitest";

import {
  createOrderSchema,
  customerListPageInputSchema,
  customerSearchBodySchema,
  onboardingDecisionBodySchema,
  onboardingRequestBodySchema,
  patchOrderInputSchema,
  paymentBodySchema,
  storeInviteLinkCreateBodySchema,
  storeInviteLinkDecisionBodySchema,
  storeInviteLinkRedeemBodySchema,
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

  it("validates store invite link creation and redemption payloads", () => {
    expect(
      storeInviteLinkCreateBodySchema.parse({
        input: {
          label: "临时员工",
          role: "technician",
          expires_in_days: 7,
          max_uses: 1,
        },
      }).input,
    ).toMatchObject({ role: "technician", expires_in_days: 7, max_uses: 1 });

    expect(() =>
      storeInviteLinkCreateBodySchema.parse({
        input: { role: "owner", expires_in_days: 7, max_uses: 1 },
      }),
    ).toThrow();
    expect(() =>
      storeInviteLinkCreateBodySchema.parse({
        input: { role: "viewer", expires_in_days: 31, max_uses: 1 },
      }),
    ).toThrow();
    expect(() =>
      storeInviteLinkCreateBodySchema.parse({
        input: { role: "viewer", expires_in_days: 7, max_uses: 51 },
      }),
    ).toThrow();

    expect(
      storeInviteLinkDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000201",
      }),
    ).toMatchObject({ id: "00000000-0000-4000-8000-000000000201" });
    expect(storeInviteLinkRedeemBodySchema.parse({ code: " rd_valid_invite_code " })).toMatchObject(
      { code: "rd_valid_invite_code" },
    );
    expect(() => storeInviteLinkRedeemBodySchema.parse({ code: "short" })).toThrow();
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

    expect(
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 5, 9, 8, 7, 4, 6, 3] },
      }).device_unlock,
    ).toEqual({ method: "pattern", pattern: [1, 2, 5, 9, 8, 7, 4, 6, 3] });

    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 3] },
      }),
    ).toThrow();
    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        issue_description: "屏幕",
        fault_prices: [],
        device_unlock: { method: "pattern", pattern: [1, 2, 1, 5] },
      }),
    ).toThrow("不能重复");
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
        changes: { device_unlock: { method: "pattern", pattern: [1, 2, 5, 9, 8, 7] } },
      }).changes.device_unlock,
    ).toEqual({ method: "pattern", pattern: [1, 2, 5, 9, 8, 7] });

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pin", value: "12a4" } },
      }),
    ).toThrow();
    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_unlock: { method: "pattern", pattern: [1, 2, 1, 5] } },
      }),
    ).toThrow("不能重复");
  });

  it("accepts parts supplier inline patches without broadening quick edit fields", () => {
    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { parts_supplier_id: "supplier-1" },
      }).changes.parts_supplier_id,
    ).toBe("supplier-1");

    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { parts_supplier_id: null },
      }).changes.parts_supplier_id,
    ).toBeNull();

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { supplier_id: "supplier-1" },
      }),
    ).toThrow();
  });

  it("validates onboarding request mode-specific fields", () => {
    expect(
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          note: "新员工申请加入",
          requested_role: "manager",
        },
      }).input,
    ).toMatchObject({
      request_type: "join_store",
      target_owner_email: "owner@chinatech.in",
      requested_role: "manager",
    });

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
          requested_role: "technician",
        },
      }),
    ).toThrow("请填写店铺负责人的邮箱");

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          target_store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
          requested_role: "technician",
        },
      }),
    ).toThrow("加入店铺不能直接指定店铺 id");

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: { request_type: "create_store" },
      }),
    ).toThrow("创建店铺请使用创建店铺接口");

    expect(() =>
      onboardingRequestBodySchema.parse({
        input: {
          request_type: "create_store",
          desired_store_name: "ChinaTech Roma",
        },
      }),
    ).toThrow("创建店铺请使用创建店铺接口");
  });

  it("validates onboarding decision approved role", () => {
    expect(
      onboardingDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        approved_role: "viewer",
        note: "只读先加入",
      }),
    ).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      approved_role: "viewer",
      note: "只读先加入",
    });

    expect(() =>
      onboardingDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        approved_role: "owner",
      }),
    ).toThrow();
  });
});
