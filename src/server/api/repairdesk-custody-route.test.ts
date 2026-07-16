import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  updateOrderCustody: vi.fn(async () => ({
    ok: true,
    updated_at: "2026-07-16T20:01:00.000Z",
  })),
  writeAuditLog: vi.fn(async () => ({ ok: true })),
  queueRealtime: vi.fn(),
}));

vi.mock("@/server/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/supabase")>()),
  hasSupabaseConfig: () => true,
}));

vi.mock("@/shared/lib/e2e-auth-bypass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/e2e-auth-bypass")>()),
  isRepairDeskE2eAuthBypassEnabled: () => false,
}));

vi.mock("@/features/orders/server/order.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/orders/server/order.service")>()),
  updateOrderCustody: mocks.updateOrderCustody,
}));

vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/features/realtime/server/realtime-broadcast", () => ({
  queueRepairDeskRealtimeBroadcast: mocks.queueRealtime,
}));

import { handleRepairDeskPost } from "./repairdesk-router";

describe("order custody route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes a redacted audit record and invalidates order/customer readers", async () => {
    const requestActor = actor("owner");
    const input = validInput();
    const response = await handleRepairDeskPost(
      "order/custody",
      { id: "order_1", input },
      requestActor,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateOrderCustody).toHaveBeenCalledWith("order_1", input, requestActor);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: requestActor,
        action: "update",
        entityType: "repair_order",
        entityId: "order_1",
        metadata: {
          input: {
            device_custody_status: "with_customer",
            reason: "客人带回设备",
          },
        },
      }),
    );
    expect(mocks.queueRealtime).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store_1",
        domain: "orders",
        mutation: "updated",
        queryGroups: ["orders.all", "customers.all"],
      }),
    );
  });

  it("rejects viewers and technicians without active order scope before mutation", async () => {
    for (const requestActor of [
      actor("viewer"),
      actor("technician", { activeMembershipId: undefined }),
    ]) {
      const response = await handleRepairDeskPost(
        "order/custody",
        { id: "order_1", input: validInput() },
        requestActor,
      );
      expect(response.status).toBe(403);
    }
    expect(mocks.updateOrderCustody).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});

function validInput() {
  return {
    expected_updated_at: "2026-07-16T20:00:00.000Z",
    device_custody_status: "with_customer" as const,
    idempotency_key: "00000000-0000-4000-8000-000000000401",
    reason: "客人带回设备",
  };
}

function actor(role: StoreRole, overrides: Partial<AuditActor> = {}): AuditActor {
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
