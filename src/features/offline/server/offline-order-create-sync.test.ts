import { describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import { syncRepairDeskOfflineOrderCreate } from "./offline-order-create-sync";

const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000101",
  displayName: "Staff",
  storeId: "00000000-0000-4000-8000-000000000201",
  role: "sales",
  storeRole: "sales",
};

describe("offline order create RPC boundary", () => {
  it("hashes a strict payload, invokes the scoped RPC port, and returns only safe metadata", async () => {
    const rpc = vi.fn(async () => ({
      resultCode: "synced",
      responseSummary: {
        serverOrderId: "order_1",
        publicNo: "RD-001",
        updatedAt: "2026-07-16T20:01:00.000Z",
        deviceCustodyStatus: "with_customer",
      },
    }));

    const result = await syncRepairDeskOfflineOrderCreate(validInput(), actor, {
      isEnabled: () => true,
      getSecret: () => "test-offline-sync-secret-001",
      assertLifecycleActive: vi.fn(async () => undefined),
      rpc,
    });

    expect(result.handlerResult).toEqual({ status: "synced", serverOrderId: "order_1" });
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: "offline_op_001" }),
      expect.objectContaining({
        storeId: actor.storeId,
        actorId: actor.id,
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(result.auditMetadata).toEqual({
      operationId: "offline_op_001",
      operationType: "order_create",
      requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      resultCode: "synced",
      target: { entityType: "repair_order", entityId: "order_1" },
    });
    expect(JSON.stringify(result.auditMetadata)).not.toContain("+39");
    expect(JSON.stringify(result.auditMetadata)).not.toContain("Mario");
  });

  it("fails closed for short secrets and actors without write authority", async () => {
    await expect(
      syncRepairDeskOfflineOrderCreate(validInput(), actor, {
        isEnabled: () => true,
        getSecret: () => "short",
        assertLifecycleActive: vi.fn(async () => undefined),
        rpc: vi.fn(),
      }),
    ).rejects.toThrow("at least 16 characters");

    await expect(
      syncRepairDeskOfflineOrderCreate(
        validInput(),
        { ...actor, role: "viewer", storeRole: "viewer" },
        {
          isEnabled: () => true,
          getSecret: () => "test-offline-sync-secret-001",
          assertLifecycleActive: vi.fn(async () => undefined),
          rpc: vi.fn(),
        },
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a queued order after the active store changes", async () => {
    const rpc = vi.fn();
    await expect(
      syncRepairDeskOfflineOrderCreate(
        { ...validInput(), expectedStoreId: "00000000-0000-4000-8000-000000000999" },
        actor,
        {
          isEnabled: () => true,
          getSecret: () => "test-offline-sync-secret-001",
          assertLifecycleActive: vi.fn(async () => undefined),
          rpc,
        },
      ),
    ).rejects.toThrow("切回原店铺");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed before secret hashing and RPC when the queued store is closing", async () => {
    const rpc = vi.fn();
    const getSecret = vi.fn(() => "test-offline-sync-secret-001");

    await expect(
      syncRepairDeskOfflineOrderCreate(validInput(), actor, {
        isEnabled: () => true,
        getSecret,
        assertLifecycleActive: vi.fn(async () => {
          throw new ForbiddenError("店铺已进入关闭流程");
        }),
        rpc,
      }),
    ).rejects.toThrow("关闭流程");

    expect(getSecret).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed before parsing or RPC work when offline replay is disabled", async () => {
    const rpc = vi.fn();

    await expect(
      syncRepairDeskOfflineOrderCreate(validInput(), actor, {
        isEnabled: () => false,
        getSecret: () => "test-offline-sync-secret-001",
        rpc,
      }),
    ).rejects.toThrow("尚未启用");
    expect(rpc).not.toHaveBeenCalled();
  });
});

function validInput() {
  return {
    operationId: "offline_op_001",
    expectedStoreId: actor.storeId,
    baseClientCreatedAt: "2026-07-16T20:00:00.000Z",
    payload: {
      relationshipPlan: {
        customer: { mode: "existing_customer", customerId: "customer_1" },
        device: { mode: "existing_customer_device", deviceId: "device_1" },
      },
      order: {
        order_type: "quick_repair",
        device_custody_status: "with_customer",
        issue_description: "Schermo rotto",
        fault_prices: [{ name: "Display", price: 100, currency_code: "EUR" }],
        deposit_amount: 20,
      },
    },
  };
}
