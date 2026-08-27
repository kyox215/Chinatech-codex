import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";
import { getStorePurgeConfirmationPhrase } from "@/entities/store/model/store-purge-confirmation";

import {
  cancelStorePurgeRequest,
  confirmStorePurgeRequest,
  createStoreLifecyclePreflight,
  getStorePurgeRequest,
  getStoreLifecycleOperationStatus,
  issueStoreLifecycleChallenge,
  renameStoreWorkspace,
  requestStorePurge,
  projectStorePurgeRequestState,
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
  assertPrimaryStoreOwnerForStore: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  storageList: vi.fn(),
  setActiveStoreCookie: vi.fn(),
  clearActiveStoreCookie: vi.fn(),
  operationKind: "rename" as "rename" | "request_close" | "restore",
}));

vi.mock("@/features/stores/server/primary-store-owner", () => ({
  assertPrimaryStoreOwner: mocks.assertPrimaryStoreOwner,
  assertPrimaryStoreOwnerForStore: mocks.assertPrimaryStoreOwnerForStore,
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: () => ({ list: mocks.storageList }) },
  }),
}));

vi.mock("@/features/stores/server/store.repository", () => ({
  setActiveStoreCookie: mocks.setActiveStoreCookie,
  clearActiveStoreCookie: mocks.clearActiveStoreCookie,
}));

describe("store lifecycle preflight", () => {
  beforeEach(() => {
    mocks.assertPrimaryStoreOwner.mockReset();
    mocks.assertPrimaryStoreOwner.mockResolvedValue({ actorId: actor.id, storeId });
    mocks.assertPrimaryStoreOwnerForStore.mockReset();
    mocks.assertPrimaryStoreOwnerForStore.mockResolvedValue({ actorId: actor.id, storeId });
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => new PreflightQuery(table));
    mocks.rpc.mockReset();
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "repairdesk_store_lifecycle_contract_version"
        ? { data: 3, error: null }
        : { data: null, error: null },
    );
    mocks.storageList.mockReset();
    mocks.storageList.mockResolvedValue({ data: [], error: null });
    mocks.setActiveStoreCookie.mockReset();
    mocks.clearActiveStoreCookie.mockReset();
    mocks.operationKind = "rename";
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
    expect(result.automatic_effects).toEqual({
      pending_invitations: 0,
      open_kiosk_sessions: 0,
    });
    expect(mocks.storageList).not.toHaveBeenCalled();
  });

  it("rejects a body store id that differs from the authenticated active store", async () => {
    await expect(
      createStoreLifecyclePreflight("00000000-0000-4000-8000-000000000099", actor),
    ).rejects.toThrow("店铺上下文已经变化");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("issues a revision-bound one-use rename challenge only after recent AAL2", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
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

  it("fails closed when mutations are enabled before lifecycle enforcement", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "0");

    await expect(
      issueStoreLifecycleChallenge(
        { expectedStoreId: storeId, expectedRevision: 7, operationKind: "rename" },
        {
          ...actor,
          authAssuranceLevel: "aal2",
          recentAuthAt: new Date().toISOString(),
        },
      ),
    ).rejects.toThrow("店铺保护尚未准备完成");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the atomic rename RPC with the authenticated primary owner and exact revision", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "repairdesk_store_lifecycle_contract_version"
        ? { data: 2, error: null }
        : {
            data: {
              operation_id: "00000000-0000-4000-8000-000000000401",
              store_name: "Chinatech Floridia",
              replayed: false,
            },
            error: null,
          },
    );

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

  it("rejects a request when the displayed phrase is changed by even one space", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED", "1");

    await expect(
      requestStorePurge(
        {
          ...purgeInput(),
          confirmationPhrase: `${getStorePurgeConfirmationPhrase(storeId, "request_purge")} `,
        },
        actor,
      ),
    ).rejects.toThrow("删除确认提示词不正确");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("validates the request phrase before calling the legacy RPC with authoritative identity", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED", "1");
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "repairdesk_store_lifecycle_contract_version") return { data: 3, error: null };
      return {
        data: {
          request_id: "00000000-0000-4000-8000-000000000501",
          store_id: storeId,
          state: "cooling",
          requested_at: "2026-08-27T10:00:00.000Z",
          cooling_until: "2026-08-28T10:00:00.000Z",
          export_job_id: "00000000-0000-4000-8000-000000000502",
        },
        error: null,
      };
    });

    const result = await requestStorePurge(
      {
        ...purgeInput(),
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
      },
      actor,
    );

    expect(result.state).toBe("cooling");
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_request_store_purge_rpc", {
      p_store_id: storeId,
      p_actor_id: actor.id,
      p_expected_revision: 7,
      p_challenge_id: "00000000-0000-4000-8000-000000000503",
      p_preflight_snapshot_hash: "a".repeat(64),
      p_confirmation_store_name: "ChinaTech",
      p_confirmation_store_id_suffix: "00000001",
    });
  });

  it("requires the distinct final phrase and still derives RPC identity from the store row", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED", "1");
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "repairdesk_store_lifecycle_contract_version") return { data: 3, error: null };
      return {
        data: {
          request_id: "00000000-0000-4000-8000-000000000501",
          store_id: storeId,
          state: "scheduled",
          requested_at: "2026-08-27T10:00:00.000Z",
          cooling_until: "2026-08-28T10:00:00.000Z",
          export_job_id: "00000000-0000-4000-8000-000000000502",
          purge_job_id: "00000000-0000-4000-8000-000000000504",
          purge_after: "2026-08-28T10:05:00.000Z",
        },
        error: null,
      };
    });

    await expect(
      confirmStorePurgeRequest(
        {
          ...purgeInput(),
          requestId: "00000000-0000-4000-8000-000000000501",
          confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
        },
        actor,
      ),
    ).rejects.toThrow("删除确认提示词不正确");
    expect(mocks.rpc).not.toHaveBeenCalled();

    const result = await confirmStorePurgeRequest(
      {
        ...purgeInput(),
        requestId: "00000000-0000-4000-8000-000000000501",
        confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "confirm_purge"),
      },
      actor,
    );

    expect(result.state).toBe("scheduled");
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_confirm_store_purge_request_rpc", {
      p_store_id: storeId,
      p_actor_id: actor.id,
      p_request_id: "00000000-0000-4000-8000-000000000501",
      p_expected_revision: 7,
      p_challenge_id: "00000000-0000-4000-8000-000000000503",
      p_preflight_snapshot_hash: "a".repeat(64),
      p_confirmation_store_name: "ChinaTech",
      p_confirmation_store_id_suffix: "00000001",
    });
  });

  it("does not read or call purge RPCs for a non-owner", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED", "1");
    mocks.assertPrimaryStoreOwnerForStore.mockRejectedValue(
      new Error("只有当前店铺的主店主可以执行此操作"),
    );

    await expect(
      requestStorePurge(
        {
          ...purgeInput(),
          confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
        },
        actor,
      ),
    ).rejects.toThrow("只有当前店铺的主店主");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns no purge status and never reads v3 tables when the purge contract is unavailable", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "repairdesk_store_lifecycle_contract_version"
        ? { data: 2, error: null }
        : { data: null, error: null },
    );

    await expect(getStorePurgeRequest(storeId, actor)).resolves.toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_store_lifecycle_contract_version");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects request, cancel, and final confirmation before any purge RPC below contract v3", async () => {
    vi.stubEnv("STORE_LIFECYCLE_MUTATIONS_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_ENFORCEMENT_ENABLED", "1");
    vi.stubEnv("STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED", "1");
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "repairdesk_store_lifecycle_contract_version"
        ? { data: 2, error: null }
        : { data: null, error: null },
    );

    await expect(
      requestStorePurge(
        {
          ...purgeInput(),
          confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "request_purge"),
        },
        actor,
      ),
    ).rejects.toThrow("店铺保护尚未安装完成");
    await expect(
      cancelStorePurgeRequest(
        { expectedStoreId: storeId, requestId: "00000000-0000-4000-8000-000000000501" },
        actor,
      ),
    ).rejects.toThrow("店铺保护尚未安装完成");
    await expect(
      confirmStorePurgeRequest(
        {
          ...purgeInput(),
          requestId: "00000000-0000-4000-8000-000000000501",
          confirmationPhrase: getStorePurgeConfirmationPhrase(storeId, "confirm_purge"),
        },
        actor,
      ),
    ).rejects.toThrow("店铺保护尚未安装完成");

    expect(
      mocks.rpc.mock.calls.some(([name]) => name !== "repairdesk_store_lifecycle_contract_version"),
    ).toBe(false);
  });

  it("projects purge job states without claiming queued work is completed", () => {
    const base = {
      storedState: "scheduled" as const,
      exportState: "restore_verified" as const,
      coolingComplete: true,
    };
    expect(projectStorePurgeRequestState({ ...base, purgeJobState: "queued" })).toBe("scheduled");
    expect(projectStorePurgeRequestState({ ...base, purgeJobState: "running" })).toBe("purging");
    expect(projectStorePurgeRequestState({ ...base, purgeJobState: "retry" })).toBe("failed");
    expect(projectStorePurgeRequestState({ ...base, purgeJobState: "failed" })).toBe("failed");
    expect(projectStorePurgeRequestState({ ...base, purgeJobState: "completed" })).toBe(
      "completed",
    );
  });

  it("projects only the original lifecycle operation status and current phase", async () => {
    const result = await getStoreLifecycleOperationStatus(
      storeId,
      "00000000-0000-4000-8000-000000000401",
      actor,
    );

    expect(mocks.assertPrimaryStoreOwnerForStore).toHaveBeenCalledWith(storeId, actor);
    expect(result).toEqual({
      operation_id: "00000000-0000-4000-8000-000000000401",
      store_id: storeId,
      kind: "rename",
      state: "completed",
      result_revision: 8,
      lifecycle: { store_id: storeId, phase: "active", revision: 7 },
    });
  });

  it("repairs the active-store cookie when a completed close status is reconciled", async () => {
    const nextStoreId = "00000000-0000-4000-8000-000000000002";
    mocks.operationKind = "request_close";

    const result = await getStoreLifecycleOperationStatus(
      storeId,
      "00000000-0000-4000-8000-000000000401",
      {
        ...actor,
        stores: [
          { id: storeId, name: "ChinaTech", slug: "chinatech", role: "owner", status: "active" },
          {
            id: nextStoreId,
            name: "ChinaTech Siracusa",
            slug: "siracusa",
            role: "owner",
            status: "active",
          },
        ],
      },
    );

    expect(mocks.setActiveStoreCookie).toHaveBeenCalledWith(nextStoreId);
    expect(result.next_active_store_id).toBe(nextStoreId);
    expect(result.active_store_cleared).toBeUndefined();
  });

  it("repairs the active-store cookie when a completed restore status is reconciled", async () => {
    mocks.operationKind = "restore";

    const result = await getStoreLifecycleOperationStatus(
      storeId,
      "00000000-0000-4000-8000-000000000401",
      actor,
    );

    expect(mocks.setActiveStoreCookie).toHaveBeenCalledWith(storeId);
    expect(result.next_active_store_id).toBe(storeId);
  });
});

function purgeInput() {
  return {
    expectedStoreId: storeId,
    expectedRevision: 7,
    reauthChallengeId: "00000000-0000-4000-8000-000000000503",
    preflightSnapshotHash: "a".repeat(64),
    confirmationPhrase: "unused",
  };
}

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
    if (this.table === "store_lifecycle_operations") {
      return {
        data: {
          operation_id: "00000000-0000-4000-8000-000000000401",
          store_id: storeId,
          kind: mocks.operationKind,
          state: "completed",
          result_revision: 8,
        },
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
