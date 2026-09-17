import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomer,
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
  it("sends the viewed version and all numbers to one atomic trusted-actor RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: true, id: "customer-a", updated_at: nextVersion },
      error: null,
    });
    await expect(
      updateCustomer(
        "customer-a",
        {
          name: "New",
          phone_e164: "+393330001234",
          contact_phones: ["+393330001235"],
          expected_updated_at: version,
        },
        actor,
      ),
    ).resolves.toEqual({ ok: true, updated_at: nextVersion });
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_update_customer_v1", {
      p_store_id: "store-a",
      p_actor_id: "actor-a",
      p_customer_id: "customer-a",
      p_expected_updated_at: version,
      p_profile: expect.objectContaining({
        phone_raw: "393330001234",
        contact_phones: ["+393330001235"],
      }),
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("preserves a future microsecond CAS and accepts the database's greater version", async () => {
    const future = "2099-01-01T00:00:00.000999Z";
    mocks.rpc.mockResolvedValue({
      data: { ok: true, id: "customer-a", updated_at: "2099-01-01T00:00:00.001Z" },
      error: null,
    });
    await expect(
      updateCustomer(
        "customer-a",
        {
          name: "New",
          phone_e164: "+393330001234",
          expected_updated_at: future,
        },
        actor,
      ),
    ).resolves.toEqual({ ok: true, updated_at: "2099-01-01T00:00:00.001Z" });
    expect(mocks.rpc.mock.calls[0][1].p_expected_updated_at).toBe(future);
    expect(mocks.rpc.mock.calls[0][1].p_profile).not.toHaveProperty("updated_at");
  });
  it.each([
    ["customer_stale_version", 409, "CUSTOMER_STALE_VERSION"],
    ["customer_not_found", 404, "CUSTOMER_ENTITY_NOT_FOUND"],
    ["customer_phone_conflict", 409, "CUSTOMER_PHONE_CONFLICT"],
    ["actor_forbidden", 403, "CUSTOMER_FORBIDDEN"],
  ])("maps atomic %s without any unscoped fallback", async (code, status, publicCode) => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code }, error: null });
    await expect(
      updateCustomer(
        "customer-a",
        {
          name: "New",
          phone_e164: "+393330001234",
          expected_updated_at: version,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status, code: publicCode });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("creates through one RPC and validates the returned identity", async () => {
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: { ok: true, id: args.p_customer_id, updated_at: nextVersion },
      error: null,
    }));
    const result = await createCustomer(
      { name: "Created", phone_e164: "+393330001234", contact_phones: ["+393330001235"] },
      actor,
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_create_customer_v1",
      expect.objectContaining({
        p_store_id: "store-a",
        p_actor_id: "actor-a",
        p_customer_id: result.id,
        p_profile: expect.objectContaining({
          phone_raw: "393330001234",
          contact_phones: ["+393330001235"],
        }),
      }),
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not expose database details", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    await expect(
      updateCustomer(
        "customer-a",
        {
          name: "New",
          phone_e164: "+393330001234",
          expected_updated_at: version,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 503, message: "保存客户失败，请稍后重试" });
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
    mocks.rpc.mockResolvedValue({ data: { ok: true, id: "customer-a" }, error: null });
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
