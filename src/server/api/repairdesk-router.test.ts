import { describe, expect, it } from "vitest";

import type {
  AuditActor,
  InventoryTransactionInput,
  PatchOrderFinanceInput,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";
import { BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE } from "@/features/buyback/model/buyback-evidence-policy";
import { ForbiddenError } from "@/server/auth-context";

import { allowsPendingStore, hasOwnOrderCostInputs } from "./repairdesk-router";
import {
  assertOrderDetailReadPermission,
  assertOrderListPermission,
  assertCustomerDetailReadPermission,
  assertCustomerCreatePermission,
  assertCustomerListPermission,
  assertCustomerMessagePermission,
  assertCustomerTagPermission,
  assertCustomerUpdatePermission,
  assertInventoryCreatePermission,
  assertInventoryIntakeDoesNotBypassBuybackFinalize,
  assertBuybackSensitiveWorkflowAvailable,
  assertInventoryQualityCheckPermission,
  assertInventorySalePermission,
  assertInventoryTransactionPermission,
  assertInventoryTransitionPermission,
  assertLegacyElectronicsImportPermission,
  assertKioskSessionCreatePermission,
  assertKioskSessionReviewPermission,
  assertInventoryUpdatePermission,
  assertMemberInvitePermission,
  assertMemberManagePermission,
  assertMemberPermissionGrantPermission,
  assertMemberRevokePermission,
  assertOrderAttachmentUploadPermission,
  assertOrderBatchTransitionPermission,
  assertMessageTemplatePermission,
  assertOrderCreatePermission,
  assertOrderCustodyPermission,
  assertOrderCustomerMessagePermission,
  assertOrderFinancePermission,
  assertOrderQuotePreparePermission,
  assertOrderQuoteSendPermission,
  assertOrderPaymentPermission,
  assertOrderPatchPermission,
  assertOrderTransitionPermission,
  assertStoreSettingsUpdatePermission,
  assertWorkflowConfigurePermission,
  assertOrderUpdatePermission,
  resolveOrderPatchPermissionActions,
  resolveOrderUpdatePermissionActions,
} from "./repairdesk-router";

describe("repairdesk router pending-store access", () => {
  it("allows only POST stores/create under stores", () => {
    expect(allowsPendingStore("stores/create", "POST")).toBe(true);
    expect(allowsPendingStore("stores/create", "GET")).toBe(false);
    expect(allowsPendingStore("stores/context", "GET")).toBe(false);
    expect(allowsPendingStore("stores/members", "GET")).toBe(false);
    expect(allowsPendingStore("stores/members/update-role", "POST")).toBe(false);
    expect(allowsPendingStore("stores/members/disable", "POST")).toBe(false);
    expect(allowsPendingStore("stores/members/restore", "POST")).toBe(false);
    expect(allowsPendingStore("stores/access-requests", "GET")).toBe(false);
    expect(allowsPendingStore("stores/switch", "POST")).toBe(false);
  });

  it("does not allow public store discovery endpoints before active store", () => {
    for (const path of [
      "stores/list",
      "stores/search",
      "stores/context",
      "stores/members",
      "stores/access-requests",
      "onboarding/stores",
    ]) {
      expect(allowsPendingStore(path, "GET")).toBe(false);
      expect(allowsPendingStore(path, "POST")).toBe(false);
    }
  });

  it("uses an exact allowlist for setup endpoints before active store", () => {
    expect(allowsPendingStore("onboarding/status", "GET")).toBe(true);
    expect(allowsPendingStore("onboarding/request", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/request/cancel", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/invitations/accept", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/invite-links/redeem", "POST")).toBe(true);
    expect(allowsPendingStore("stores/invite-links/create", "POST")).toBe(false);
    expect(allowsPendingStore("stores/invite-links/revoke", "POST")).toBe(false);
    expect(allowsPendingStore("platform/onboarding/requests", "GET")).toBe(true);
    expect(allowsPendingStore("platform/onboarding/approve", "POST")).toBe(true);
    expect(allowsPendingStore("platform/onboarding/reject", "POST")).toBe(true);
    expect(allowsPendingStore("account/profile/update", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/anything-else", "GET")).toBe(false);
    expect(allowsPendingStore("platform/orders", "GET")).toBe(false);
    expect(allowsPendingStore("account/anything-else", "POST")).toBe(false);
  });
});

describe("repairdesk router internal cost boundary", () => {
  it("detects every explicit cost payload before schema stripping", () => {
    expect(hasOwnOrderCostInputs({ fault_prices: [] })).toBe(false);
    expect(hasOwnOrderCostInputs({ cost_inputs: [] })).toBe(true);
    expect(hasOwnOrderCostInputs({ cost_inputs: null })).toBe(true);
    expect(hasOwnOrderCostInputs({ cost: 15 })).toBe(true);
    expect(hasOwnOrderCostInputs({ fault_prices: [{ unit_cost: 15 }] })).toBe(true);
    expect(hasOwnOrderCostInputs({ nested: { internalCost: 15 } })).toBe(true);
    expect(hasOwnOrderCostInputs(Object.create({ cost_inputs: [] }))).toBe(false);
  });
});

describe("repairdesk router order write permissions", () => {
  it("separates diagnosis scope from final quote publication and sending", () => {
    const quoteInput = {
      expected_updated_at: "2026-07-17T18:00:00.000Z",
      idempotency_key: "00000000-0000-4000-8000-000000000901",
      diagnosis_result: "检测完成",
      fault_prices: [{ name: "电池", price: 59 }],
    };
    for (const role of ["owner", "manager", "sales"] as const) {
      expect(() => assertOrderQuotePreparePermission(actor(role), quoteInput)).not.toThrow();
      expect(() => assertOrderQuoteSendPermission(actor(role))).not.toThrow();
    }
    expect(() =>
      assertOrderQuotePreparePermission(
        actor("technician", { activeMembershipId: "membership_1" }),
        quoteInput,
      ),
    ).toThrow(ForbiddenError);
    expect(() => assertOrderQuoteSendPermission(actor("viewer"))).toThrow(ForbiddenError);
  });

  it("requires scoped order read permissions for restricted roles", () => {
    expect(() => assertOrderListPermission(actor("owner"))).not.toThrow();
    expect(() => assertOrderDetailReadPermission(actor("sales"))).not.toThrow();
    expect(() => assertOrderListPermission(actor("technician"))).not.toThrow();
    expect(() =>
      assertOrderListPermission(actor("technician", { activeMembershipId: undefined })),
    ).toThrow(ForbiddenError);
    expect(() => assertOrderDetailReadPermission(actor("viewer"))).toThrow(ForbiddenError);
  });

  it("rejects viewer order create, full update, and IMEI patch writes", () => {
    const viewer = actor("viewer");

    expect(() => assertOrderCreatePermission(viewer)).toThrow(ForbiddenError);
    expect(() =>
      assertOrderUpdatePermission(viewer, {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        customer_name: "Cliente",
        customer_phone: "+39 333 000 0000",
        device_brand: "Apple",
        device_model: "iPhone",
        device_imei: "490154203237518",
        issue_description: "Display",
        fault_prices: [],
      }),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertOrderPatchPermission(viewer, {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518" },
      }),
    ).toThrow(ForbiddenError);
  });

  it("maps inline order patch fields to intake or repair permissions", () => {
    expect(
      resolveOrderPatchPermissionActions({
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518", customer_name: "Cliente" },
      }),
    ).toEqual(["order:update_intake"]);

    expect(
      resolveOrderPatchPermissionActions({
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { diagnosis_result: "Needs display", device_notes: "No water damage" },
      }),
    ).toEqual(["order:update_repair"]);

    expect(
      resolveOrderPatchPermissionActions({
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_unlock: { method: "pin", value: "1234" } },
      }),
    ).toEqual(["order:update_repair"]);

    expect(
      resolveOrderPatchPermissionActions({
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518", diagnosis_result: "Needs display" },
      }),
    ).toEqual(["order:update_intake", "order:update_repair"]);
  });

  it("allows owner order writes and blocks scoped intake edits without object scope", () => {
    expect(() => assertOrderCreatePermission(actor("owner"))).not.toThrow();
    expect(() =>
      assertOrderPatchPermission(actor("owner"), {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518" },
      }),
    ).not.toThrow();
    expect(() =>
      assertOrderPatchPermission(actor("technician"), {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { diagnosis_result: "Needs display" },
      }),
    ).not.toThrow();
    expect(() =>
      assertOrderPatchPermission(actor("technician", { activeMembershipId: undefined }), {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518" },
      }),
    ).toThrow(ForbiddenError);
  });

  it("keeps custody mutations store-scoped and unavailable to viewers", () => {
    const input = {
      expected_updated_at: "2026-07-16T20:00:00.000Z",
      device_custody_status: "with_customer" as const,
      idempotency_key: "00000000-0000-4000-8000-000000000401",
    };
    expect(() => assertOrderCustodyPermission(actor("owner"), input)).not.toThrow();
    expect(() => assertOrderCustodyPermission(actor("technician"), input)).not.toThrow();
    expect(() =>
      assertOrderCustodyPermission(actor("technician", { activeMembershipId: undefined }), input),
    ).toThrow(ForbiddenError);
    expect(() => assertOrderCustodyPermission(actor("viewer"), input)).toThrow(ForbiddenError);
  });

  it("requires repair and payment permissions for full order updates", () => {
    expect(resolveOrderUpdatePermissionActions(fullOrderUpdate())).toEqual([
      "order:update_intake",
      "order:update_repair",
      "payment:adjust",
    ]);

    expect(() => assertOrderUpdatePermission(actor("manager"), fullOrderUpdate())).not.toThrow();
    expect(() => assertOrderUpdatePermission(actor("sales"), fullOrderUpdate())).toThrow(
      ForbiddenError,
    );
    expect(() => assertOrderUpdatePermission(actor("technician"), fullOrderUpdate())).toThrow(
      ForbiddenError,
    );
  });

  it("keeps IMEI patch under intake while blocking sensitive unlock patch for sales", () => {
    expect(() =>
      assertOrderPatchPermission(actor("sales"), {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518" },
      }),
    ).not.toThrow();

    expect(() =>
      assertOrderPatchPermission(actor("sales"), {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_unlock: { method: "pin", value: "1234" } },
      }),
    ).toThrow(ForbiddenError);
  });

  it("requires payment adjust permission for order finance route writes", () => {
    const financeInput: PatchOrderFinanceInput = {
      expected_updated_at: "2026-07-08T00:00:00.000Z",
      fault_prices: [{ name: "Display", price: 120 }],
      deposit_amount: 20,
    };

    expect(() => assertOrderFinancePermission(actor("owner"), financeInput)).not.toThrow();
    expect(() => assertOrderFinancePermission(actor("manager"), financeInput)).not.toThrow();
    expect(() => assertOrderFinancePermission(actor("sales"), financeInput)).toThrow(
      ForbiddenError,
    );
    expect(() => assertOrderFinancePermission(actor("viewer"), financeInput)).toThrow(
      ForbiddenError,
    );
  });
});

describe("repairdesk router customer read permissions", () => {
  it("allows customer reads only for roles with an unscoped grant", () => {
    for (const allowedRole of ["owner", "manager", "sales"] as const) {
      expect(() => assertCustomerListPermission(actor(allowedRole))).not.toThrow();
      expect(() => assertCustomerDetailReadPermission(actor(allowedRole))).not.toThrow();
    }

    for (const restrictedRole of ["technician", "viewer"] as const) {
      expect(() => assertCustomerListPermission(actor(restrictedRole))).toThrow(ForbiddenError);
      expect(() => assertCustomerDetailReadPermission(actor(restrictedRole))).toThrow(
        ForbiddenError,
      );
    }
  });
});

describe("repairdesk router non-order write permissions", () => {
  it("requires an assigned order for technician kiosk creation", () => {
    for (const role of ["owner", "manager", "sales"] as const) {
      expect(() => assertKioskSessionCreatePermission(actor(role), {})).not.toThrow();
    }
    expect(() =>
      assertKioskSessionCreatePermission(actor("technician"), { order_id: "order-a" }),
    ).not.toThrow();
    expect(() => assertKioskSessionCreatePermission(actor("technician"), {})).toThrow(
      ForbiddenError,
    );
    expect(() =>
      assertKioskSessionCreatePermission(actor("technician", { activeMembershipId: undefined }), {
        order_id: "order-a",
      }),
    ).toThrow(ForbiddenError);
    expect(() => assertKioskSessionCreatePermission(actor("viewer"), {})).toThrow(ForbiddenError);
  });

  it("limits kiosk session review to store owners and managers", () => {
    expect(() => assertKioskSessionReviewPermission(actor("owner"))).not.toThrow();
    expect(() => assertKioskSessionReviewPermission(actor("manager"))).not.toThrow();
    for (const restrictedRole of ["technician", "sales", "viewer"] as const) {
      expect(() => assertKioskSessionReviewPermission(actor(restrictedRole))).toThrow(
        ForbiddenError,
      );
    }
  });

  it("blocks viewer and unscoped technician customer writes while allowing frontdesk customer work", () => {
    for (const assertCustomerPermission of [
      assertCustomerCreatePermission,
      assertCustomerUpdatePermission,
      assertCustomerTagPermission,
      assertCustomerMessagePermission,
    ]) {
      expect(() => assertCustomerPermission(actor("owner"))).not.toThrow();
      expect(() => assertCustomerPermission(actor("sales"))).not.toThrow();
      expect(() => assertCustomerPermission(actor("technician"))).toThrow(ForbiddenError);
      expect(() => assertCustomerPermission(actor("viewer"))).toThrow(ForbiddenError);
    }
  });

  it("separates normal order payment collection from finance corrections", () => {
    expect(() => assertOrderPaymentPermission(actor("owner"))).not.toThrow();
    expect(() => assertOrderPaymentPermission(actor("manager"))).not.toThrow();
    expect(() => assertOrderPaymentPermission(actor("sales"))).not.toThrow();
    expect(() => assertOrderPaymentPermission(actor("technician"))).toThrow(ForbiddenError);
    expect(() => assertOrderPaymentPermission(actor("viewer"))).toThrow(ForbiddenError);

    const financeInput: PatchOrderFinanceInput = {
      expected_updated_at: "2026-07-08T00:00:00.000Z",
      fault_prices: [{ name: "Display", price: 120 }],
      deposit_amount: 20,
    };

    expect(() => assertOrderFinancePermission(actor("sales"), financeInput)).toThrow(
      ForbiddenError,
    );
  });

  it("blocks viewers from order transitions while preserving operational roles", () => {
    expect(() => assertOrderTransitionPermission(actor("owner"))).not.toThrow();
    expect(() => assertOrderTransitionPermission(actor("manager"))).not.toThrow();
    expect(() => assertOrderTransitionPermission(actor("technician"))).not.toThrow();
    expect(() => assertOrderTransitionPermission(actor("sales"))).not.toThrow();
    expect(() => assertOrderTransitionPermission(actor("viewer"))).toThrow(ForbiddenError);
  });

  it("restricts batch order transitions to owner and manager", () => {
    expect(() => assertOrderBatchTransitionPermission(actor("owner"))).not.toThrow();
    expect(() => assertOrderBatchTransitionPermission(actor("manager"))).not.toThrow();
    expect(() => assertOrderBatchTransitionPermission(actor("technician"))).toThrow(ForbiddenError);
    expect(() => assertOrderBatchTransitionPermission(actor("sales"))).toThrow(ForbiddenError);
    expect(() => assertOrderBatchTransitionPermission(actor("viewer"))).toThrow(ForbiddenError);
  });

  it("allows operational order photo uploads but blocks customer messaging for technicians", () => {
    expect(() => assertOrderAttachmentUploadPermission(actor("owner"))).not.toThrow();
    expect(() => assertOrderAttachmentUploadPermission(actor("manager"))).not.toThrow();
    expect(() => assertOrderAttachmentUploadPermission(actor("technician"))).not.toThrow();
    expect(() => assertOrderAttachmentUploadPermission(actor("sales"))).not.toThrow();
    expect(() => assertOrderAttachmentUploadPermission(actor("viewer"))).toThrow(ForbiddenError);

    expect(() => assertOrderCustomerMessagePermission(actor("owner"))).not.toThrow();
    expect(() => assertOrderCustomerMessagePermission(actor("manager"))).not.toThrow();
    expect(() => assertOrderCustomerMessagePermission(actor("sales"))).not.toThrow();
    expect(() => assertOrderCustomerMessagePermission(actor("technician"))).toThrow(ForbiddenError);
    expect(() => assertOrderCustomerMessagePermission(actor("viewer"))).toThrow(ForbiddenError);
  });

  it("keeps settings, workflow, and message templates owner-manager only", () => {
    for (const assertSettingsPermission of [
      assertStoreSettingsUpdatePermission,
      assertWorkflowConfigurePermission,
      assertMessageTemplatePermission,
    ]) {
      expect(() => assertSettingsPermission(actor("owner"))).not.toThrow();
      expect(() => assertSettingsPermission(actor("manager"))).not.toThrow();
      expect(() => assertSettingsPermission(actor("sales"))).toThrow(ForbiddenError);
      expect(() => assertSettingsPermission(actor("technician"))).toThrow(ForbiddenError);
      expect(() => assertSettingsPermission(actor("viewer"))).toThrow(ForbiddenError);
    }
  });

  it("uses member management gates before store repository object checks", () => {
    for (const assertMemberPermission of [
      assertMemberInvitePermission,
      assertMemberManagePermission,
      assertMemberRevokePermission,
    ]) {
      expect(() => assertMemberPermission(actor("owner"))).not.toThrow();
      expect(() => assertMemberPermission(actor("manager"))).not.toThrow();
      expect(() => assertMemberPermission(actor("sales"))).toThrow(ForbiddenError);
      expect(() => assertMemberPermission(actor("viewer"))).toThrow(ForbiddenError);
    }
  });

  it("requires owner-level grant permission before editing member supplier permissions", () => {
    expect(() => assertMemberPermissionGrantPermission(actor("owner"))).not.toThrow();
    expect(() => assertMemberPermissionGrantPermission(actor("manager"))).toThrow(ForbiddenError);
    expect(() => assertMemberPermissionGrantPermission(actor("sales"))).toThrow(ForbiddenError);
    expect(() => assertMemberPermissionGrantPermission(actor("viewer"))).toThrow(ForbiddenError);
  });

  it("maps inventory writes to granular permission actions", () => {
    expect(() => assertInventoryCreatePermission(actor("owner"))).not.toThrow();
    expect(() => assertInventoryCreatePermission(actor("technician"))).not.toThrow();
    expect(() => assertInventoryUpdatePermission(actor("sales"))).not.toThrow();
    expect(() => assertInventoryQualityCheckPermission(actor("technician"))).not.toThrow();
    expect(() => assertInventoryQualityCheckPermission(actor("sales"))).toThrow(ForbiddenError);
    expect(() => assertInventorySalePermission(actor("sales"))).not.toThrow();
    expect(() => assertInventorySalePermission(actor("owner"))).not.toThrow();
    expect(() => assertInventoryCreatePermission(actor("viewer"))).toThrow(ForbiddenError);
    expect(() => assertInventoryTransitionPermission(actor("owner"), "recycled")).not.toThrow();
    expect(() => assertInventoryTransitionPermission(actor("manager"), "recycled")).not.toThrow();
    expect(() => assertInventoryTransitionPermission(actor("sales"), "recycled")).toThrow(
      ForbiddenError,
    );
    expect(() => assertInventoryTransitionPermission(actor("technician"), "recycled")).toThrow(
      ForbiddenError,
    );
    expect(() => assertInventoryTransitionPermission(actor("sales"), "evaluating")).not.toThrow();
  });

  it("requires inventory sale permission for sale payment transactions", () => {
    const salePayment: InventoryTransactionInput = {
      transaction_type: "sale_payment",
      amount: 100,
    };
    const repairCost: InventoryTransactionInput = {
      transaction_type: "repair_cost",
      amount: 20,
    };
    const directBuybackPayment: InventoryTransactionInput = {
      transaction_type: "buyback_payment",
      amount: 200,
    };

    expect(() => assertInventoryTransactionPermission(actor("sales"), salePayment)).not.toThrow();
    expect(() => assertInventoryTransactionPermission(actor("owner"), salePayment)).not.toThrow();
    expect(() => assertInventoryTransactionPermission(actor("sales"), repairCost)).toThrow(
      ForbiddenError,
    );
    expect(() => assertInventoryTransactionPermission(actor("viewer"), repairCost)).toThrow(
      ForbiddenError,
    );
    expect(() =>
      assertInventoryTransactionPermission(actor("owner"), directBuybackPayment),
    ).toThrow(/只能由.*确认成交操作生成/);
  });

  it("blocks legacy implicit buyback payments and owner-gates historical imports", () => {
    expect(() =>
      assertInventoryIntakeDoesNotBypassBuybackFinalize({
        brand: "Apple",
        model: "iPhone 13",
        buyback_price: 250,
      }),
    ).toThrow(/回收成本只能由.*确认成交操作写入/);
    expect(() =>
      assertInventoryIntakeDoesNotBypassBuybackFinalize({
        brand: "Apple",
        model: "iPhone 13",
        buyback_price: 250,
        quote_payload: { buyback_quote: { final_offer: 250 } },
      }),
    ).toThrow(/回收成本只能由.*确认成交操作写入/);
    expect(() =>
      assertInventoryIntakeDoesNotBypassBuybackFinalize({
        brand: "Apple",
        model: "iPhone 13",
        buyback_price: 0,
        quote_payload: { buyback_quote: { final_offer: 250 } },
      }),
    ).not.toThrow();

    expect(() => assertLegacyElectronicsImportPermission(actor("owner"))).not.toThrow();
    for (const role of ["manager", "technician", "sales", "viewer"] as const) {
      expect(() => assertLegacyElectronicsImportPermission(actor(role))).toThrow(ForbiddenError);
    }
  });

  it("returns the same forbidden feature-off boundary for every store role", () => {
    for (const role of ["owner", "manager", "technician", "sales", "viewer"] as const) {
      expect(() => assertBuybackSensitiveWorkflowAvailable()).toThrow(ForbiddenError);
      expect(() => assertBuybackSensitiveWorkflowAvailable()).toThrow(
        BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
      );
      expect(actor(role).storeRole).toBe(role);
    }
  });
});

function fullOrderUpdate(overrides: Partial<UpdateOrderInput> = {}): UpdateOrderInput {
  return {
    expected_updated_at: "2026-07-08T00:00:00.000Z",
    customer_name: "Cliente",
    customer_phone: "+39 333 000 0000",
    device_brand: "Apple",
    device_model: "iPhone",
    device_imei: "490154203237518",
    device_notes: "No water damage",
    issue_description: "Display cracked",
    diagnosis_result: "Needs display",
    internal_tag: "priority",
    accessory_notes: "Case",
    device_unlock: { method: "pin", value: "1234" },
    warranty_text: "3 months",
    warranty_months: 3,
    warranty_change_reason: "manual edit",
    fault_prices: [{ name: "Display", price: 120 }],
    deposit_amount: 20,
    ...overrides,
  };
}

function actor(
  role: "owner" | "manager" | "technician" | "sales" | "viewer",
  overrides: Partial<AuditActor> = {},
): AuditActor {
  return {
    id: `staff_${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store_1",
    activeMembershipId: `membership_${role}`,
    ...overrides,
  };
}
