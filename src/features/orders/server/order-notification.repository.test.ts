import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordOrderNotification } from "./order-notification.repository";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => mocks }));
const actor = {
  id: "actor",
  storeId: "store",
  storeRole: "sales" as const,
  role: "technician" as const,
  displayName: "Synthetic",
};
const input = {
  body: "  Manual message  ",
  channel: "whatsapp" as const,
  expected_updated_at: "2026-09-16T04:00:00.123456+00:00",
  idempotency_key: "00000000-0000-4000-8000-000000000001",
};
const receipt = {
  ok: true,
  id: "message",
  event_id: "event",
  channel: "whatsapp",
  body: "Manual message",
  updated_at: "2026-09-16T04:00:00.123457Z",
  replayed: false,
  delivery_verified: false,
  statusChanged: false,
  recipient_phone: null,
  from: "new",
  to: null,
};
beforeEach(() => vi.clearAllMocks());
describe("atomic manual notifications", () => {
  it("passes the original version and stable key to one RPC with trusted actor/store", async () => {
    mocks.rpc.mockResolvedValue({ data: receipt, error: null });
    expect(await recordOrderNotification("order", input, actor)).toEqual(receipt);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("repairdesk_record_order_notification", {
      p_store_id: "store",
      p_actor_id: "actor",
      p_order_id: "order",
      p_expected_updated_at: input.expected_updated_at,
      p_operation_id: input.idempotency_key,
      p_body: "Manual message",
      p_channel: "whatsapp",
      p_template_kind: null,
      p_recipient_phone: null,
      p_transition_to: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    "stale_version",
    "idempotency_conflict",
    "order_voided",
    "custody_required",
    "invalid_transition",
  ])("keeps %s structured and makes no fallback writes", async (code) => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code }, error: null });
    await expect(recordOrderNotification("order", input, actor)).rejects.toMatchObject({
      status: 409,
      code,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    { ok: true },
    { ...receipt, updated_at: "" },
    { ...receipt, event_id: "" },
    { ...receipt, replayed: undefined },
    { ...receipt, delivery_verified: true },
  ])("fails closed for incomplete RPC result %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(recordOrderNotification("order", input, actor)).rejects.toMatchObject({
      status: 503,
      code: "ORDER_NOTIFICATION_INVALID_RESULT",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not replace a missing transaction with legacy individual writes", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(recordOrderNotification("order", input, actor)).rejects.toMatchObject({
      status: 503,
      code: "ORDER_NOTIFICATION_MIGRATION_REQUIRED",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("checks current store role before dispatch even when global role is owner", async () => {
    await expect(
      recordOrderNotification("order", input, { ...actor, role: "owner", storeRole: "technician" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns an exact replay receipt without fetching a newer version", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...receipt, replayed: true }, error: null });
    expect(await recordOrderNotification("order", input, actor)).toMatchObject({
      replayed: true,
      updated_at: receipt.updated_at,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
