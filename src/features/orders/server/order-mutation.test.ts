import { describe, expect, it, vi } from "vitest";
import { mutateOrderAtomic, orderMutationIdentity } from "./order-mutation";

const base = {
  storeId: "store-1",
  actorId: "actor-1",
  orderId: "order-1",
  mode: "finance" as const,
  request: {
    expected_updated_at: "2026-09-07T10:00:00Z",
    fault_prices: [{ name: "Repair", price: 120 }],
  },
};

describe("atomic order mutation identity", () => {
  it("includes the frozen customer version and backup replacement in retry identity", () => {
    const request = {
      ...base.request,
      expected_customer_updated_at: "2026-09-17T08:00:00Z",
      changes: { contact_phones: [] as string[] },
    };
    const identity = orderMutationIdentity({ ...base, request });
    expect(
      orderMutationIdentity({
        ...base,
        request: { ...request, expected_customer_updated_at: "2026-09-17T08:01:00Z" },
      }).requestHash,
    ).not.toBe(identity.requestHash);
    expect(
      orderMutationIdentity({ ...base, request: { ...request, changes: {} } }).requestHash,
    ).not.toBe(identity.requestHash);
  });
  it("reuses an intent for the same original payload and version regardless of key order", () => {
    const first = orderMutationIdentity(base);
    expect(
      orderMutationIdentity({
        ...base,
        request: {
          fault_prices: [{ price: 120, name: "Repair" }],
          expected_updated_at: base.request.expected_updated_at,
        },
      }),
    ).toEqual(first);
    expect(first.operationId).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });

  it("changes the fingerprint for payload, version, actor, store, target or mode", () => {
    for (const changed of [
      { ...base, request: { ...base.request, fault_prices: [{ name: "Repair", price: 121 }] } },
      { ...base, request: { ...base.request, expected_updated_at: "2026-09-07T11:00:00Z" } },
      { ...base, actorId: "actor-2" },
      { ...base, storeId: "store-2" },
      { ...base, orderId: "order-2" },
      { ...base, mode: "patch" },
    ])
      expect(orderMutationIdentity(changed).requestHash).not.toBe(
        orderMutationIdentity(base).requestHash,
      );
  });

  it("keeps an explicit key but still detects changed payload via its fingerprint", () => {
    const idempotency_key = "00000000-0000-4000-8000-000000007700";
    const first = orderMutationIdentity({ ...base, request: { ...base.request, idempotency_key } });
    const second = orderMutationIdentity({
      ...base,
      request: { ...base.request, idempotency_key, expected_updated_at: "2026-09-07T11:00:00Z" },
    });
    expect(first.operationId).toBe(second.operationId);
    expect(first.requestHash).not.toBe(second.requestHash);
    expect(first.requestHash).toBe(orderMutationIdentity(base).requestHash);
  });
});

describe("atomic order mutation transport", () => {
  it("sends the originally observed customer version and exposes both committed versions", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        updated_at: "2026-09-17T09:00:00Z",
        customer_updated_at: "2026-09-17T09:00:00Z",
      },
      error: null,
    });
    const result = await mutateOrderAtomic({
      ...base,
      request: { ...base.request, expected_customer_updated_at: "2026-09-17T08:00:00Z" },
      supabase: { rpc } as unknown as Parameters<typeof mutateOrderAtomic>[0]["supabase"],
      orderChanges: {},
      customerChanges: { contact_phones: [] },
    });
    expect(rpc).toHaveBeenCalledWith(
      "repairdesk_mutate_order_v4",
      expect.objectContaining({
        p_expected_customer_updated_at: "2026-09-17T08:00:00Z",
        p_customer_changes: { contact_phones: [] },
      }),
    );
    expect(result).toEqual({
      ok: true,
      updated_at: "2026-09-17T09:00:00Z",
      customer_updated_at: "2026-09-17T09:00:00Z",
    });
  });
  function setup(response: { data: unknown; error: unknown }) {
    const rpc = vi.fn().mockResolvedValue(response);
    const from = vi.fn();
    const args = {
      ...base,
      supabase: { rpc, from } as unknown as Parameters<typeof mutateOrderAtomic>[0]["supabase"],
      orderChanges: {
        fault_prices: [{ line_id: crypto.randomUUID(), name: "Repair", price: 120 }],
        quotation_amount: 120,
      },
    };
    return { args, rpc, from };
  }

  it("uses one RPC and excludes normalized/generated fields from retry identity", async () => {
    const { args, rpc, from } = setup({
      data: { ok: true, updated_at: "2026-09-07T12:00:00Z" },
      error: null,
    });
    await expect(mutateOrderAtomic(args)).resolves.toEqual({
      ok: true,
      updated_at: "2026-09-07T12:00:00Z",
    });
    await mutateOrderAtomic({
      ...args,
      orderChanges: {
        ...args.orderChanges,
        fault_prices: [{ line_id: crypto.randomUUID(), name: "Repair", price: 120 }],
      },
    });
    expect(rpc.mock.calls[0]?.[0]).toBe("repairdesk_mutate_order_v4");
    expect(rpc.mock.calls[0]?.[1].p_operation_id).toBe(rpc.mock.calls[1]?.[1].p_operation_id);
    expect(rpc.mock.calls[0]?.[1].p_request_hash).toBe(rpc.mock.calls[1]?.[1].p_request_hash);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(["PGRST202", "42883"])("fails closed when migration is missing (%s)", async (code) => {
    const { args, from } = setup({ data: null, error: { code, message: "private db context" } });
    await expect(mutateOrderAtomic(args)).rejects.toMatchObject({
      code: "ORDER_MUTATION_MIGRATION_REQUIRED",
      status: 503,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a safe retryable failure after a transaction exception", async () => {
    const { args } = setup({
      data: null,
      error: { code: "P0001", message: "private phone and unlock" },
    });
    await expect(mutateOrderAtomic(args)).rejects.toMatchObject({
      code: "ORDER_MUTATION_TRANSACTION_FAILED",
      status: 503,
    });
    await expect(mutateOrderAtomic(args)).rejects.not.toThrow("private");
  });

  it.each([
    "quote_below_received_amount",
    "deposit_correction_required",
    "stale_version",
    "customer_stale_version",
    "customer_version_required",
    "idempotency_conflict",
  ])("preserves domain failure %s", async (code) => {
    const { args } = setup({ data: { ok: false, code }, error: null });
    await expect(mutateOrderAtomic(args)).rejects.toMatchObject({ code, status: 409 });
  });
});
