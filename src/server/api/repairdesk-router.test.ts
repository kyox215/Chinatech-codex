import { describe, expect, it } from "vitest";

import type { PatchOrderFinanceInput, UpdateOrderInput } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import { allowsPendingStore } from "./repairdesk-router";
import {
  assertOrderCreatePermission,
  assertOrderFinancePermission,
  assertOrderPatchPermission,
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

describe("repairdesk router order write permissions", () => {
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
      assertOrderPatchPermission(actor("technician"), {
        expected_updated_at: "2026-07-08T00:00:00.000Z",
        changes: { device_imei: "490154203237518" },
      }),
    ).toThrow(ForbiddenError);
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

function actor(role: "owner" | "manager" | "technician" | "sales" | "viewer") {
  return {
    id: `staff_${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store_1",
  };
}
