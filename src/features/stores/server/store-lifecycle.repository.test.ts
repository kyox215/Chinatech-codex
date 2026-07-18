import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import {
  createStoreLifecyclePreflight,
  issueStoreLifecycleChallenge,
  renameStoreWorkspace,
} from "./store-lifecycle.repository";

const storeId = "00000000-0000-4000-8000-000000000001";
const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Owner",
  storeId,
  storeRole: "owner",
  activeStoreExplicit: true,
};

const mocks = vi.hoisted(() => ({
  assertPrimaryStoreOwner: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  storageList: vi.fn(),
}));

vi.mock("@/features/stores/server/primary-store-owner", () => ({
  assertPrimaryStoreOwner: mocks.assertPrimaryStoreOwner,
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: () => ({ list: mocks.storageList }) },
  }),
}));

describe("store lifecycle preflight", () => {
  beforeEach(() => {
    mocks.assertPrimaryStoreOwner.mockReset();
    mocks.assertPrimaryStoreOwner.mockResolvedValue({ actorId: actor.id, storeId });
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => new PreflightQuery(table));
    mocks.rpc.mockReset();
    mocks.storageList.mockReset();
    mocks.storageList.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns only PII-free counts, totals, blockers, and a revision-bound hash", async () => {
    const result = await createStoreLifecyclePreflight(storeId, actor);

    expect(result).toMatchObject({
      store_id: storeId,
      store_name: "ChinaTech",
      lifecycle: { phase: "active", revision: 7 },
      state: "blocked",
      counts: {
        repair_orders: 2,
        customers: 2,
        open_orders: 2,
        devices_in_custody: 1,
      },
      blockers: expect.arrayContaining([
        { code: "open_orders", count: 2 },
        { code: "unsettled_balance", count: 1, amount: 20 },
        { code: "device_in_custody", count: 1 },
      ]),
    });
    expect(result.snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toMatch(/phone|email|customer_name|order_id/i);
    expect(mocks.storageList).toHaveBeenCalledTimes(3);
  });

  it("rejects a body store id that differs from the authenticated active store", async () => {
    await expect(
      createStoreLifecyclePreflight("00000000-0000-4000-8000-000000000099", actor),
    ).rejects.toThrow("店铺上下文已经变化");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("issues a revision-bound one-use rename challenge only after recent AAL2", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    const result = await issueStoreLifecycleChallenge(
      { expectedStoreId: storeId, expectedRevision: 7, operationKind: "rename" },
      {
        ...actor,
        authAssuranceLevel: "aal2",
        recentAuthAt: new Date().toISOString(),
      },
    );

    expect(result).toMatchObject({
      store_id: storeId,
      operation_kind: "rename",
      lifecycle_revision: 7,
      assurance_level: "aal2",
    });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("calls the atomic rename RPC with the authenticated primary owner and exact revision", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    mocks.rpc.mockResolvedValue({
      data: {
        operation_id: "00000000-0000-4000-8000-000000000401",
        store_name: "Chinatech Floridia",
        replayed: false,
      },
      error: null,
    });

    const result = await renameStoreWorkspace(
      {
        expectedStoreId: storeId,
        expectedRevision: 7,
        operationId: "00000000-0000-4000-8000-000000000401",
        reauthChallengeId: "00000000-0000-4000-8000-000000000402",
        name: "Chinatech Floridia",
        syncCustomerFacingName: true,
      },
      actor,
    );

    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_rename_store_rpc", {
      p_store_id: storeId,
      p_actor_id: actor.id,
      p_operation_id: "00000000-0000-4000-8000-000000000401",
      p_expected_revision: 7,
      p_challenge_id: "00000000-0000-4000-8000-000000000402",
      p_new_name: "Chinatech Floridia",
      p_sync_customer_facing_name: true,
    });
    expect(result).toMatchObject({
      replayed: false,
      lifecycle: { store_id: storeId, phase: "active", revision: 7 },
      store: { id: storeId, name: "Chinatech Floridia" },
    });
  });
});

class PreflightQuery implements PromiseLike<QueryResult> {
  private filters = new Map<string, unknown>();
  private head = false;
  private operation = "select";

  constructor(private readonly table: string) {}

  select(_columns?: string, options?: { head?: boolean }) {
    this.head = options?.head === true;
    return this;
  }

  insert(_value: unknown) {
    this.operation = "insert";
    return this;
  }

  update(_value: unknown) {
    this.operation = "update";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.set(`${column}:gt`, value);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.set(`${column}:not:${operator}`, value);
    return this;
  }

  or(value: string) {
    this.filters.set("or", value);
    return this;
  }

  in(column: string, value: readonly unknown[]) {
    this.filters.set(`${column}:in`, value);
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve(): QueryResult {
    if (this.operation === "insert" || this.operation === "update") {
      return { data: null, count: null, error: null };
    }
    if (this.table === "store_lifecycles") {
      return {
        data: { store_id: storeId, phase: "active", revision: 7 },
        count: null,
        error: null,
      };
    }
    if (this.table === "stores") {
      return {
        data: { id: storeId, name: "ChinaTech", status: "active" },
        count: null,
        error: null,
      };
    }
    if (this.table === "repair_orders" && this.filters.has("balance_amount:gt")) {
      return { data: [{ balance_amount: 20 }], count: null, error: null };
    }
    if (
      this.table === "repair_orders" &&
      this.filters.get("device_custody_status") === "with_shop"
    ) {
      return { data: null, count: 1, error: null };
    }
    if (this.table === "repair_orders" && this.filters.has("status:not:in")) {
      return { data: null, count: 2, error: null };
    }
    if (this.table === "customer_kiosk_sessions") {
      return { data: null, count: 0, error: null };
    }
    if (this.table === "store_invitations" || this.table === "store_invite_links") {
      return { data: null, count: 0, error: null };
    }
    if (this.head) {
      const counts: Record<string, number> = {
        repair_orders: 2,
        customers: 2,
        devices: 2,
        inventory_items: 0,
        suppliers: 0,
        store_memberships: 1,
      };
      return { data: null, count: counts[this.table] ?? 0, error: null };
    }
    return { data: null, count: null, error: null };
  }
}

interface QueryResult {
  data: unknown;
  count: number | null;
  error: null;
}
