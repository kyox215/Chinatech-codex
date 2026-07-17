import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

const mocks = vi.hoisted(() => ({
  acceptKioskSession: vi.fn(),
  createKioskDevicePairing: vi.fn(),
  createKioskSession: vi.fn(),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  getRequestActor: vi.fn(),
  hasSupabaseConfig: vi.fn(),
  isRepairDeskE2eAuthBypassEnabled: vi.fn(),
  queueRepairDeskRealtimeBroadcast: vi.fn(),
  returnKioskSession: vi.fn(),
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
  acceptKioskSession: mocks.acceptKioskSession,
  createOrder: mocks.createOrder,
  getOrder: mocks.getOrder,
  returnKioskSession: mocks.returnKioskSession,
  updateStoreSettings: mocks.updateStoreSettings,
}));

vi.mock("@/features/kiosk/server/kiosk.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/kiosk/server/kiosk.service")>()),
  acceptKioskSession: mocks.acceptKioskSession,
  createKioskDevicePairing: mocks.createKioskDevicePairing,
  createKioskSession: mocks.createKioskSession,
  returnKioskSession: mocks.returnKioskSession,
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
    mocks.getOrder.mockResolvedValue({
      order: { id: "order_1", fault_prices: [] },
    });
    mocks.acceptKioskSession.mockResolvedValue({ id: "session_1", status: "accepted" });
    mocks.returnKioskSession.mockResolvedValue({ id: "session_1", status: "returned" });
    mocks.updateStoreSettings.mockResolvedValue({
      store_name: "Chinatech",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("queues realtime metadata only after a successful audited mutation", async () => {
    const operationId = "00000000-0000-4000-8000-000000000903";
    const response = await handleRepairDeskPost("orders/create", {
      operation_id: operationId,
      order_type: "quick_repair",
      status: "new",
      issue_description: "Schermo rotto",
      fault_prices: [],
    });

    expect(response.status).toBe(200);
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ operation_id: operationId }),
      expect.objectContaining({ storeId }),
    );
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

  it("does not write duplicate audit or realtime events for an idempotent create replay", async () => {
    mocks.createOrder.mockResolvedValueOnce({ id: "order_1", replayed: true });

    const response = await handleRepairDeskPost("orders/create", {
      operation_id: "00000000-0000-4000-8000-000000000904",
      order_type: "quick_repair",
      status: "new",
      issue_description: "Schermo rotto",
      fault_prices: [],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "order_1", replayed: true },
    });
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
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

  it("enforces the owner-manager kiosk review gate on the real routes", async () => {
    mocks.getRequestActor.mockResolvedValueOnce({
      id: "sales_1",
      role: "sales",
      storeId,
      storeName: "Chinatech",
      storeRole: "sales",
    });
    const forbidden = await handleRepairDeskPost("kiosk/sessions/accept", {
      id: "session_1",
      expected_submission_version: 1,
    });
    expect(forbidden.status).toBe(403);
    expect(mocks.acceptKioskSession).not.toHaveBeenCalled();

    const accepted = await handleRepairDeskPost("kiosk/sessions/accept", {
      id: "session_1",
      expected_submission_version: 1,
    });
    expect(accepted.status).toBe(200);
    expect(mocks.acceptKioskSession).toHaveBeenCalledTimes(1);

    expect(mocks.queueRepairDeskRealtimeBroadcast).toHaveBeenLastCalledWith({
      storeId,
      domain: "settings",
      mutation: "updated",
      queryGroups: ["kiosk.sessions", "orders.all", "customers.all"],
    });
  });

  it("blocks production pairing and session creation before any repository write", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.hasSupabaseConfig.mockReturnValue(true);

    const pairing = await handleRepairDeskPost("kiosk/devices/pairing", {
      input: { label: "Front iPad" },
    });
    const session = await handleRepairDeskPost("kiosk/sessions/create", {
      input: {
        device_id: "device_1",
        session_type: "intake_contact",
      },
    });

    expect(pairing.status).toBe(400);
    expect(session.status).toBe(400);
    await expect(pairing.json()).resolves.toMatchObject({
      error: expect.stringContaining("生产功能暂未启用"),
    });
    await expect(session.json()).resolves.toMatchObject({
      error: expect.stringContaining("生产功能暂未启用"),
    });
    expect(mocks.createKioskDevicePairing).not.toHaveBeenCalled();
    expect(mocks.createKioskSession).not.toHaveBeenCalled();
  });

  it("blocks Supabase-backed collection when only the master Kiosk flag is enabled", async () => {
    mocks.hasSupabaseConfig.mockReturnValue(true);
    vi.stubEnv("REPAIRDESK_KIOSK_PRODUCTION_ENABLED", "1");

    const pairing = await handleRepairDeskPost("kiosk/devices/pairing", {
      input: { label: "Front iPad" },
    });
    const session = await handleRepairDeskPost("kiosk/sessions/create", {
      input: {
        device_id: "device_1",
        session_type: "intake_contact",
      },
    });

    expect(pairing.status).toBe(400);
    expect(session.status).toBe(400);
    await expect(pairing.json()).resolves.toMatchObject({
      error: expect.stringContaining("收集与审核链路暂未启用"),
    });
    await expect(session.json()).resolves.toMatchObject({
      error: expect.stringContaining("收集与审核链路暂未启用"),
    });
    expect(mocks.createKioskDevicePairing).not.toHaveBeenCalled();
    expect(mocks.createKioskSession).not.toHaveBeenCalled();
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
