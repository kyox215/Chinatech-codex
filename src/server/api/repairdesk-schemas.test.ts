import { describe, expect, it } from "vitest";

import {
  BUYBACK_AGREEMENT_VERSION,
  BUYBACK_PRIVACY_NOTICE_SHA256,
  BUYBACK_PRIVACY_NOTICE_TEXT_IT,
  BUYBACK_PRIVACY_NOTICE_VERSION,
  BUYBACK_TERMS_SHA256,
  BUYBACK_TERMS_TEXT_IT,
} from "@/features/buyback/model/buyback-agreement";

import {
  approvalStatusSchema,
  batchTransitionBodySchema,
  buybackFinalizeInputSchema,
  createOrderSchema,
  customerListPageInputSchema,
  customerSearchBodySchema,
  dashboardPrioritySummaryInputSchema,
  dashboardSummaryInputSchema,
  inventoryQualityCheckInputSchema,
  onboardingDecisionBodySchema,
  onboardingRequestBodySchema,
  orderListFiltersSchema,
  orderListPageInputSchema,
  patchOrderInputSchema,
  paymentBodySchema,
  storeInviteLinkCreateBodySchema,
  storeInviteLinkDecisionBodySchema,
  storeInviteLinkRedeemBodySchema,
  storeMemberDecisionBodySchema,
  storeMemberRoleUpdateBodySchema,
  supplierCreateBodySchema,
  transitionOrderBodySchema,
  updateOrderInputSchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

describe("repairdesk API schemas", () => {
  it("accepts only a bounded Dashboard limit and rejects caller-controlled scope", () => {
    expect(dashboardPrioritySummaryInputSchema.parse({ limit: 8 })).toEqual({ limit: 8 });
    expect(() => dashboardPrioritySummaryInputSchema.parse({ limit: 21 })).toThrow();
    expect(() =>
      dashboardPrioritySummaryInputSchema.parse({ limit: 8, storeId: "other-store" }),
    ).toThrow();
  });

  it("keeps the legacy Dashboard page-size contract available during rolling releases", () => {
    expect(dashboardSummaryInputSchema.parse({ pageSize: 6 })).toEqual({ pageSize: 6 });
  });

  it("keeps legacy order page sizes accepted while clamping the detail budget to 50", () => {
    expect(orderListPageInputSchema.parse({ page: "2", pageSize: "50" })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(orderListPageInputSchema.parse({ pageSize: 100 })).toEqual({ pageSize: 50 });
    expect(() => orderListPageInputSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("accepts an optional ISO version for inventory quality-check CAS", () => {
    expect(
      inventoryQualityCheckInputSchema.parse({
        expected_updated_at: "2026-07-13T10:00:00.000Z",
        data_wipe_status: "pass",
      }),
    ).toMatchObject({
      expected_updated_at: "2026-07-13T10:00:00.000Z",
      data_wipe_status: "pass",
    });
    expect(() =>
      inventoryQualityCheckInputSchema.parse({ expected_updated_at: "stale-version" }),
    ).toThrow();
  });

  it("accepts only the allowlisted buyback agreement snapshot without full document data", () => {
    const input = {
      expected_updated_at: "2026-07-12T12:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000201",
      item_patch: {},
      quality_check: {},
      agreement_snapshot: {
        agreement_version: "chinatech-buyback-v1",
        privacy_notice_version: "chinatech-privacy-v1",
        language: "it-IT",
        legal_documents: {
          privacy_notice: {
            version: BUYBACK_PRIVACY_NOTICE_VERSION,
            sha256: BUYBACK_PRIVACY_NOTICE_SHA256,
            text: BUYBACK_PRIVACY_NOTICE_TEXT_IT,
          },
          buyback_terms: {
            version: BUYBACK_AGREEMENT_VERSION,
            sha256: BUYBACK_TERMS_SHA256,
            text: BUYBACK_TERMS_TEXT_IT,
          },
        },
        device: {
          brand: "Apple",
          model: "iPhone 17",
          storage_capacity: "128GB",
          serial_or_imei: "356789012345678",
          purchase_proof: false,
          box_included: false,
        },
        payment: { method: "cash" },
        quote: { amount: 475, currency_code: "EUR" },
        seller: {
          name: "Mario Demo",
          phone: "+39 333 000 1234",
          document_type: "id_card",
          document_no_last4: "1234",
        },
        declarations: {
          ownership_confirmed: true,
          data_wipe_authorized: true,
          privacy_notice_accepted: true,
          agreement_accepted: true,
          no_invoice_confirmed: true,
          no_box_confirmed: true,
        },
      },
      agreement_hash: "a".repeat(64),
      agreement_version: "chinatech-buyback-v1",
      privacy_notice_version: "chinatech-privacy-v1",
      language: "it-IT",
      document_type: "id_card",
      document_no_last4: "1234",
      signature_attachment_id: "00000000-0000-4000-8000-000000000202",
      evidence_attachment_ids: [
        "00000000-0000-4000-8000-000000000203",
        "00000000-0000-4000-8000-000000000204",
        "00000000-0000-4000-8000-000000000205",
      ],
      payment_method: "cash",
    };

    expect(() => buybackFinalizeInputSchema.parse(input)).not.toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          legal_documents: {
            ...input.agreement_snapshot.legal_documents,
            buyback_terms: {
              ...input.agreement_snapshot.legal_documents.buyback_terms,
              text: `${BUYBACK_TERMS_TEXT_IT}\nModifica non firmata`,
            },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          seller: {
            ...input.agreement_snapshot.seller,
            document_no: "CA1234567",
          },
        },
      }),
    ).toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          seller: {
            ...input.agreement_snapshot.seller,
            verification_note: "Documento CA1234567",
          },
        },
      }),
    ).toThrow(/完整证件号/);
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        document_no_last4: "12345678",
      }),
    ).toThrow();
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_snapshot: {
          ...input.agreement_snapshot,
          seller: {
            ...input.agreement_snapshot.seller,
            verification_note: "Documento A-1-2-3-4-5",
          },
        },
      }),
    ).toThrow(/完整证件号/);
    expect(() =>
      buybackFinalizeInputSchema.parse({
        ...input,
        agreement_version: "forged-v2",
        agreement_snapshot: {
          ...input.agreement_snapshot,
          agreement_version: "forged-v2",
        },
      }),
    ).toThrow();
  });

  it("coerces payment amounts", () => {
    expect(
      paymentBodySchema.parse({
        id: "R1",
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000101",
        amount: "25.5",
      }),
    ).toMatchObject({
      id: "R1",
      expected_updated_at: "2026-06-11T00:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000101",
      amount: 25.5,
    });
  });

  it("requires a valid payment idempotency key and cent precision", () => {
    const payment = {
      id: "R1",
      expected_updated_at: "2026-06-11T00:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000101",
      amount: 25.5,
    };
    expect(paymentBodySchema.parse(payment)).toMatchObject(payment);
    const { idempotency_key: _legacyKey, ...legacyPayment } = payment;
    expect(paymentBodySchema.parse(legacyPayment).idempotency_key).toBeUndefined();
    expect(paymentBodySchema.parse({ ...payment, amount: 0.29 }).amount).toBe(0.29);
    expect(paymentBodySchema.parse({ ...payment, amount: 0.57 }).amount).toBe(0.57);
    expect(() => paymentBodySchema.parse({ ...payment, idempotency_key: "retry-1" })).toThrow();
    expect(() => paymentBodySchema.parse({ ...payment, amount: 25.555 })).toThrow();
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

  it("accepts the active order queue groups and rejects retired queue keys", () => {
    const queueGroups = [
      "processing",
      "ordered",
      "arrived",
      "arrived_notified",
      "repaired",
      "repaired_notified",
    ] as const;

    expect(orderListFiltersSchema.parse({ queueGroups }).queueGroups).toEqual(queueGroups);
    expect(() => orderListFiltersSchema.parse({ queueGroups: ["settlement"] })).toThrow();
    expect(() => orderListFiltersSchema.parse({ queueGroups: ["review"] })).toThrow();
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

  it("validates store member lifecycle payloads without accepting owner role", () => {
    expect(
      storeMemberRoleUpdateBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000301",
        role: "sales",
      }),
    ).toMatchObject({
      id: "00000000-0000-4000-8000-000000000301",
      role: "sales",
    });

    expect(() =>
      storeMemberRoleUpdateBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000301",
        role: "owner",
      }),
    ).toThrow();
    expect(() =>
      storeMemberRoleUpdateBodySchema.parse({
        id: "not-a-uuid",
        role: "viewer",
      }),
    ).toThrow();
    expect(
      storeMemberDecisionBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000301",
      }),
    ).toEqual({ id: "00000000-0000-4000-8000-000000000301" });
    expect(() => storeMemberDecisionBodySchema.parse({ id: "membership_staff" })).toThrow();
  });

  it("validates order types from the canonical runtime enum", () => {
    const validOrder = {
      status: "new",
      issue_description: "屏幕碎裂",
      fault_prices: [],
    };

    expect(createOrderSchema.parse({ ...validOrder, order_type: "quick_repair" }).order_type).toBe(
      "quick_repair",
    );
    expect(
      createOrderSchema.parse({ ...validOrder, order_type: "dropoff_repair" }).order_type,
    ).toBe("dropoff_repair");
    expect(() =>
      createOrderSchema.parse({
        ...validOrder,
        order_type: "normal",
      }),
    ).toThrow();
  });

  it("accepts store workflow codes but rejects malformed status values", () => {
    const validOrder = {
      order_type: "quick_repair",
      issue_description: "屏幕碎裂",
      fault_prices: [],
    };
    expect(createOrderSchema.parse({ ...validOrder, status: "waiting_supplier" }).status).toBe(
      "waiting_supplier",
    );

    for (const status of ["A_STATUS", "1status", "bad status", "x", `a${"x".repeat(48)}`]) {
      expect(() => createOrderSchema.parse({ ...validOrder, status })).toThrow();
      expect(() => transitionOrderBodySchema.parse({ id: "R1", to: status })).toThrow();
      expect(() => batchTransitionBodySchema.parse({ ids: ["R1"], to: status })).toThrow();
    }
  });

  it("validates approval status from the canonical runtime enum", () => {
    for (const status of ["pending", "approved", "rejected"] as const) {
      expect(approvalStatusSchema.parse(status)).toBe(status);
    }
    expect(() => approvalStatusSchema.parse("accepted")).toThrow();
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

  it("validates IMEI fields consistently while keeping create and full edit blank optional", () => {
    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: "   " },
      }),
    ).toThrow("IMEI / 序列号不能为空");

    expect(
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: " SN-TEST_20260708:01 " },
      }).changes.device_imei,
    ).toBe("SN-TEST_20260708:01");

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: "A".repeat(65) },
      }),
    ).toThrow("IMEI / 序列号不能超过 64 个字符");

    expect(() =>
      patchOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        changes: { device_imei: "SN<script>" },
      }),
    ).toThrow("IMEI / 序列号只能包含");

    expect(
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: "",
      }).device_imei,
    ).toBe("");
    expect(
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: " SN-TEST_20260708:01 ",
      }).device_imei,
    ).toBe("SN-TEST_20260708:01");
    expect(() =>
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: "A".repeat(65),
      }),
    ).toThrow("IMEI / 序列号不能超过 64 个字符");
    expect(() =>
      createOrderSchema.parse({
        order_type: "quick_repair",
        status: "new",
        issue_description: "屏幕碎裂",
        fault_prices: [],
        device_imei: "SN<script>",
      }),
    ).toThrow("IMEI / 序列号只能包含");

    expect(
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: "",
        issue_description: "屏幕",
        fault_prices: [],
      }).device_imei,
    ).toBe("");
    expect(
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: " SN-TEST_20260708:01 ",
        issue_description: "屏幕",
        fault_prices: [],
      }).device_imei,
    ).toBe("SN-TEST_20260708:01");
    expect(() =>
      updateOrderInputSchema.parse({
        expected_updated_at: "2026-06-11T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: "=490154203237518",
        issue_description: "屏幕",
        fault_prices: [],
      }),
    ).toThrow("IMEI / 序列号只能包含");
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

  it("validates supplier settings payloads", () => {
    expect(
      supplierCreateBodySchema.parse({
        input: {
          name: "MOBILAX",
          short_name: "MOB",
          color: "#2563eb",
          phone: "+39 333 000 0000",
        },
      }).input,
    ).toMatchObject({ name: "MOBILAX", short_name: "MOB", color: "#2563eb" });

    expect(() =>
      supplierCreateBodySchema.parse({
        input: { name: "MOBILAX", color: "blue" },
      }),
    ).toThrow("供应商颜色格式不正确");
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
