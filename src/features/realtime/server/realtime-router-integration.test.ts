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

vi.mock("@/lib/mock/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mock/api")>()),
  createOrder: mocks.createOrder,
  updateStoreSettings: mocks.updateStoreSettings,
}));

import { handleRepairDeskPost } from "@/server/api/repairdesk-router";
import { SettingsMutationError } from "@/features/settings/model/store-settings-errors";

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
      section: "store",
      expectedStoreId: storeId,
      expectedUpdatedAt: "2026-07-12T10:00:00.000Z",
      input: {
        store_name: "Chinatech Floridia",
        store_address: "Via Roma 1",
        store_phone: "+39 333 111 2222",
        store_whatsapp: "+39 333 111 2222",
        store_email: "owner@example.com",
      },
    });

    expect(response.status).toBe(200);
    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenCalledWith({
      storeId,
      domain: "settings",
      mutation: "settings_updated",
      queryGroups: ["settings.store", "orders.options"],
    });
  });

  it("broadcasts supplier mutations to the store-scoped supplier query group", async () => {
    const response = await handleRepairDeskPost("settings/suppliers/create", {
      input: { name: "Realtime Supplier" },
    });

    expect(response.status).toBe(200);
    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenCalledWith({
      storeId,
      domain: "settings",
      mutation: "settings_updated",
      queryGroups: ["suppliers.all", "orders.options", "orders.all"],
    });
  });

  it("returns stable validation details and never mutates or broadcasts malformed settings", async () => {
    const response = await handleRepairDeskPost("settings/store/update", {
      section: "store",
      expectedStoreId: storeId,
      expectedUpdatedAt: "2026-07-12T10:00:00.000Z",
      input: {
        store_name: "",
        store_address: "",
        store_phone: "",
        store_whatsapp: "",
        store_email: "invalid",
      },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "SETTINGS_VALIDATION_FAILED",
      fieldErrors: {
        "input.store_name": ["店铺名不能为空"],
        "input.store_email": ["邮箱格式无效"],
      },
    });
    expect(mocks.updateStoreSettings).not.toHaveBeenCalled();
    expect(mocks.queueRepairDeskRealtimeBroadcast).not.toHaveBeenCalled();
  });

  it("checks permission before validation and never broadcasts conflicts", async () => {
    mocks.getRequestActor.mockResolvedValueOnce({
      id: "viewer_1",
      role: "viewer",
      storeId,
      storeRole: "viewer",
    });
    const forbidden = await handleRepairDeskPost("settings/store/update", { malformed: true });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateStoreSettings).not.toHaveBeenCalled();

    mocks.updateStoreSettings.mockRejectedValueOnce(SettingsMutationError.versionConflict());
    const conflict = await handleRepairDeskPost("settings/store/update", {
      section: "notifications",
      expectedStoreId: storeId,
      expectedUpdatedAt: "2026-07-12T10:00:00.000Z",
      input: { print_footer: "Footer", message_signature: "Firma" },
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ code: "SETTINGS_VERSION_CONFLICT" });
    expect(mocks.queueRepairDeskRealtimeBroadcast).not.toHaveBeenCalled();
  });
});
