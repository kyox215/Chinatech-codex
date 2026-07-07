import { beforeEach, describe, expect, it, vi } from "vitest";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getRequestActor: vi.fn(),
  hasSupabaseConfig: vi.fn(),
  isRepairDeskE2eAuthBypassEnabled: vi.fn(),
  queueRepairDeskRealtimeBroadcast: vi.fn(),
  updateStoreSettings: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/features/realtime/server/realtime-broadcast", () => ({
  queueRepairDeskRealtimeBroadcast: mocks.queueRepairDeskRealtimeBroadcast,
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/server/auth-context", () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  assertStaffRole: vi.fn(),
  getRequestActor: mocks.getRequestActor,
}));

vi.mock("@/server/supabase", () => ({
  hasSupabaseConfig: mocks.hasSupabaseConfig,
}));

vi.mock("@/shared/lib/e2e-auth-bypass", () => ({
  isRepairDeskE2eAuthBypassEnabled: mocks.isRepairDeskE2eAuthBypassEnabled,
}));

vi.mock("@/lib/mock/api", () => ({
  createOrder: mocks.createOrder,
  updateStoreSettings: mocks.updateStoreSettings,
}));

import { handleRepairDeskPost } from "@/server/api/repairdesk-router";

describe("repairdesk router realtime integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestActor.mockResolvedValue({
      id: "user_1",
      role: "owner",
      storeId,
      storeName: "Chinatech",
      storeRole: "owner",
    });
    mocks.hasSupabaseConfig.mockReturnValue(false);
    mocks.isRepairDeskE2eAuthBypassEnabled.mockReturnValue(false);
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.createOrder.mockResolvedValue({
      id: "order_1",
      public_no: "RD-1",
      status: "new",
    });
    mocks.updateStoreSettings.mockResolvedValue({
      store_name: "Chinatech",
    });
  });

  it("queues realtime metadata only after a successful audited mutation", async () => {
    const response = await handleRepairDeskPost("orders/create", {
      order_type: "quick_repair",
      status: "new",
      issue_description: "Schermo rotto",
      fault_prices: [],
    });

    expect(response.status).toBe(200);
    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenCalledWith({
      storeId,
      domain: "orders",
      mutation: "created",
      queryGroups: ["orders.all", "customers.all"],
    });
  });

  it("does not queue realtime metadata when the mutation fails", async () => {
    mocks.createOrder.mockRejectedValueOnce(new Error("create failed"));

    const response = await handleRepairDeskPost("orders/create", {
      order_type: "quick_repair",
      status: "new",
      issue_description: "Schermo rotto",
      fault_prices: [],
    });

    expect(response.status).toBe(400);
    expect(mocks.queueRepairDeskRealtimeBroadcast).not.toHaveBeenCalled();
  });

  it("queues realtime metadata after a successful direct settings mutation", async () => {
    const response = await handleRepairDeskPost("settings/store/update", {
      input: { store_name: "Chinatech Floridia" },
    });

    expect(response.status).toBe(200);
    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenCalledWith({
      storeId,
      domain: "settings",
      mutation: "settings_updated",
      queryGroups: ["settings.store", "orders.options"],
    });
  });
});
