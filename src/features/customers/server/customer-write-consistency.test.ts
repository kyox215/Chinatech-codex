import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteCustomerDevice,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
} from "./customer.repository";
import type { AuditActor } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => mocks }));
const actor = {
  id: "actor-a",
  storeId: "store-a",
  storeRole: "owner",
  email: "synthetic@example.test",
  displayName: "Synthetic",
} as AuditActor;
const version = "2026-09-15T10:00:00.000001Z";
const nextVersion = "2026-09-15T10:00:00.000002Z";
function query(data: unknown, error: unknown = null) {
  const result = { data, error };
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of [q.select, q.eq, q.in, q.limit, q.update, q.delete, q.insert])
    method.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  mocks.from.mockReset();
  mocks.rpc.mockReset();
});
describe("customer write CAS repository", () => {
  it("uses store/id/viewed version and returns the actual microsecond database version", async () => {
    const write = query({ id: "customer-a", updated_at: nextVersion });
    mocks.from.mockReturnValueOnce(query([])).mockReturnValueOnce(write);
    await expect(
      updateCustomer(
        "customer-a",
        { name: "New", phone_e164: "+393330001234", expected_updated_at: version },
        actor,
      ),
    ).resolves.toEqual({ ok: true, updated_at: nextVersion });
    expect(write.eq.mock.calls).toEqual([
      ["store_id", "store-a"],
      ["id", "customer-a"],
      ["updated_at", version],
    ]);
  });
  it("writes a greater future-microsecond payload while preserving the exact CAS predicate", async () => {
    const future = "2099-01-01T00:00:00.000999Z";
    const write = query({ id: "customer-a", updated_at: "2099-01-01T00:00:00.001Z" });
    mocks.from.mockReturnValueOnce(query([])).mockReturnValueOnce(write);
    await updateCustomer(
      "customer-a",
      { name: "New", phone_e164: "+393330001234", expected_updated_at: future },
      actor,
    );
    expect(write.update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: "2099-01-01T00:00:00.001Z" }),
    );
    expect(write.eq).toHaveBeenCalledWith("updated_at", future);
  });
  it.each([
    { exists: true, status: 409 },
    { exists: false, status: 404 },
  ])("classifies no-row updates without unscoped lookup ($status)", async ({ exists, status }) => {
    const lookup = query(exists ? { id: "customer-a" } : null);
    mocks.from
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query(null))
      .mockReturnValueOnce(lookup);
    await expect(
      updateCustomer(
        "customer-a",
        { name: "New", phone_e164: "+393330001234", expected_updated_at: version },
        actor,
      ),
    ).rejects.toMatchObject({ status });
    expect(lookup.eq.mock.calls).toEqual([
      ["store_id", "store-a"],
      ["id", "customer-a"],
    ]);
  });
  it("rejects missing version before any query", async () => {
    await expect(
      updateCustomer(
        "customer-a",
        { name: "New", phone_e164: "+393330001234", expected_updated_at: "" },
        actor,
      ),
    ).rejects.toMatchObject({ code: "CUSTOMER_VERSION_REQUIRED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("device update binds both the customer and viewed version", async () => {
    const write = query({ id: "device-a", updated_at: nextVersion });
    mocks.from.mockReturnValueOnce(query({ id: "customer-a" })).mockReturnValueOnce(write);
    await expect(
      upsertCustomerDevice(
        "customer-a",
        { id: "device-a", brand: "Test", model: "Device", expected_updated_at: version },
        actor,
      ),
    ).resolves.toEqual({ id: "device-a", updated_at: nextVersion });
    expect(write.eq.mock.calls).toContainEqual(["customer_id", "customer-a"]);
    expect(write.eq.mock.calls).toContainEqual(["updated_at", version]);
  });
  it("atomic device delete binds the actor, tenant, customer and viewed version", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, id: "device-a" }, error: null });
    await expect(deleteCustomerDevice("customer-a", "device-a", version, actor)).resolves.toEqual({
      ok: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_delete_customer_device", {
      p_store_id: "store-a",
      p_actor_id: "actor-a",
      p_customer_id: "customer-a",
      p_device_id: "device-a",
      p_expected_updated_at: version,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    ["CUSTOMER_STALE_VERSION", 409],
    ["CUSTOMER_DEVICE_NOT_FOUND", 404],
    ["CUSTOMER_FORBIDDEN", 403],
    ["CUSTOMER_DEVICE_HAS_ORDERS", 409],
  ])("atomic deletion preserves %s", async (message, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(
      deleteCustomerDevice("customer-a", "device-a", version, actor),
    ).rejects.toMatchObject({ status });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ok: true }, { ok: true, id: "wrong-device" }])(
    "rejects incomplete deletion acknowledgement %j",
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(
        deleteCustomerDevice("customer-a", "device-a", version, actor),
      ).rejects.toMatchObject({ status: 503, code: "CUSTOMER_WRITE_RESULT_INVALID" });
    },
  );
  it("replaces tags only through the atomic trusted-actor RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, updated_at: nextVersion }, error: null });
    await expect(
      setCustomerTags("customer-a", { tagIds: [], expected_customer_updated_at: version }, actor),
    ).resolves.toEqual({ ok: true, updated_at: nextVersion });
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_replace_customer_tags", {
      p_store_id: "store-a",
      p_actor_id: "actor-a",
      p_customer_id: "customer-a",
      p_expected_updated_at: version,
      p_tag_ids: [],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ok: true }, { ok: true, updated_at: "invalid" }])(
    "fails closed for incomplete RPC success %j",
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(
        setCustomerTags("customer-a", { tagIds: [], expected_customer_updated_at: version }, actor),
      ).rejects.toMatchObject({ status: 503, code: "CUSTOMER_WRITE_RESULT_INVALID" });
    },
  );
  it("fails closed when an UPDATE returns no actual version", async () => {
    mocks.from.mockReturnValueOnce(query([])).mockReturnValueOnce(query({ id: "customer-a" }));
    await expect(
      updateCustomer(
        "customer-a",
        { name: "New", phone_e164: "+393330001234", expected_updated_at: version },
        actor,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
  it.each([
    ["CUSTOMER_STALE_VERSION", 409],
    ["CUSTOMER_NOT_FOUND", 404],
    ["CUSTOMER_FORBIDDEN", 403],
    ["CUSTOMER_TAGS_INVALID", 400],
  ])("preserves structured RPC failure %s", async (message, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(
      setCustomerTags(
        "customer-a",
        { tagIds: ["tag-a"], expected_customer_updated_at: version },
        actor,
      ),
    ).rejects.toMatchObject({ status });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
