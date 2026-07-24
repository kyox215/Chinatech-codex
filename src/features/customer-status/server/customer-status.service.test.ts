import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin }));

import {
  CustomerStatusRateLimitError,
  CustomerStatusUnavailableError,
  issueCustomerStatusLinks,
  resolveCustomerStatusForStaff,
  resolveCustomerStatusPublic,
} from "./customer-status.service";
import { createStableCustomerStatusToken } from "./customer-status-token";

type QueryResult = { data: unknown; error: null };
type Filter = { table: string; field: string; value: unknown };

describe("customer status service", () => {
  beforeEach(() => {
    vi.stubEnv("CUSTOMER_STATUS_QR_ENABLED", "1");
    vi.stubEnv("CUSTOMER_STATUS_RATE_LIMIT_SECRET", "test-rate-limit-secret");
    vi.stubEnv("CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION", "1");
    vi.stubEnv(
      "CUSTOMER_STATUS_QR_HMAC_KEYS",
      JSON.stringify({ 1: Buffer.alloc(32, 11).toString("base64url") }),
    );
    getSupabaseAdmin.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("short-circuits malformed or request-limited traffic before token lookup", async () => {
    await expect(resolveCustomerStatusPublic("invalid", "198.51.100.1")).rejects.toBeInstanceOf(
      CustomerStatusUnavailableError,
    );
    expect(getSupabaseAdmin).not.toHaveBeenCalled();

    const events: string[] = [];
    const admin = createPublicAdmin(events, {
      rateLimitResults: [{ allowed: false, retry_after_seconds: 120 }],
    });
    getSupabaseAdmin.mockReturnValue(admin);

    await expect(
      resolveCustomerStatusPublic("A".repeat(43), "198.51.100.1"),
    ).rejects.toBeInstanceOf(CustomerStatusRateLimitError);
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc.mock.calls[0]?.[0]).toBe(
      "repairdesk_consume_customer_status_public_request_v1",
    );
    expect(admin.rpc.mock.calls[0]?.[1]?.p_ip_scope_key).toMatch(/^ip:/);
    expect(admin.rpc.mock.calls[0]?.[1]?.p_global_scope_key).toMatch(/^global:/);
    expect(events).not.toContain("from:repair_order_customer_status_links");
  });

  it("uses the combined public limiter, validates a live token, and maps repaired by status code", async () => {
    const events: string[] = [];
    const filters: Filter[] = [];
    const admin = createPublicAdmin(events, { filters });
    getSupabaseAdmin.mockReturnValue(admin);

    const result = await resolveCustomerStatusPublic("B".repeat(43), "198.51.100.2");

    expect(admin.rpc).toHaveBeenCalledTimes(2);
    expect(admin.rpc.mock.calls[0]?.[0]).toBe(
      "repairdesk_consume_customer_status_public_request_v1",
    );
    expect(admin.rpc.mock.calls[1]?.[1]?.p_scope_key).toMatch(/^token:/);
    expect(events.indexOf("rpc:request")).toBeLessThan(
      events.indexOf("from:repair_order_customer_status_links"),
    );
    expect(events.indexOf("from:repair_order_customer_status_links")).toBeLessThan(
      events.indexOf("rpc:token"),
    );
    expect(filters).toContainEqual({
      table: "order_workflow_statuses",
      field: "code",
      value: "repaired",
    });
    expect(result.store.name).toBe("ZYG HOME Riparazioni");
    expect(result.order).toMatchObject({ stage: "pickup", progress_percent: 90 });
  });

  it("keeps staff resolution same-store and technician-assignment scoped", async () => {
    const admin = createPublicAdmin([]);
    getSupabaseAdmin.mockReturnValue(admin);
    const token = "C".repeat(43);

    await expect(
      resolveCustomerStatusForStaff(token, {
        id: "owner-1",
        displayName: "Owner",
        storeId: "store-2",
        storeRole: "owner",
      }),
    ).rejects.toBeInstanceOf(CustomerStatusUnavailableError);

    await expect(
      resolveCustomerStatusForStaff(token, {
        id: "tech-1",
        displayName: "Technician",
        storeId: "store-1",
        storeRole: "technician",
        activeMembershipId: "membership-2",
      }),
    ).rejects.toBeInstanceOf(CustomerStatusUnavailableError);

    await expect(
      resolveCustomerStatusForStaff(token, {
        id: "tech-1",
        displayName: "Technician",
        storeId: "store-1",
        storeRole: "technician",
        activeMembershipId: "membership-1",
      }),
    ).resolves.toBe("/orders/order-1?from=orders");
  });

  it("keeps pre-close links invalid after a store lifecycle revision changes", async () => {
    getSupabaseAdmin.mockReturnValue(createPublicAdmin([], { lifecycleRevision: 4 }));

    await expect(
      resolveCustomerStatusPublic("E".repeat(43), "198.51.100.5"),
    ).rejects.toBeInstanceOf(CustomerStatusUnavailableError);
  });

  it("resolves the stable token by opaque public identity and keeps the public DTO safe", async () => {
    const token = createStableCustomerStatusToken({
      publicId: "9e5b9bd0-f497-4ee7-8609-37cd23d19cc9",
      generation: 1,
      keyVersion: 1,
    });
    getSupabaseAdmin.mockReturnValue(createPublicAdmin([], { stableIdentity: true }));

    const result = await resolveCustomerStatusPublic(token, "198.51.100.8");

    expect(result.order).toMatchObject({ public_no: "R2027001", stage: "pickup" });
    expect(JSON.stringify(result)).not.toMatch(/order-1|membership-1|device-1/);
  });

  it("uses one stable identity RPC and never sends bearer material to the database", async () => {
    const admin = createIssueAdmin();
    getSupabaseAdmin.mockReturnValue(admin);

    const links = await issueCustomerStatusLinks(["order-1"], {
      id: "owner-1",
      displayName: "Owner",
      storeId: "store-1",
      storeRole: "owner",
    });

    const [rpcName, rpcInput] = admin.rpc.mock.calls[0] as unknown as [
      string,
      { p_order_ids: string[]; p_key_version: number },
    ];
    expect(rpcName).toBe("repairdesk_ensure_customer_status_identities_v2");
    expect(rpcInput.p_order_ids).toEqual(["order-1"]);
    expect(rpcInput.p_key_version).toBe(1);
    expect(links[0]?.url).toMatch(/^https:\/\/www\.chinatech\.in\/r#v2\./);
    expect(links[0]?.expires_at).toBeNull();
    expect(JSON.stringify(admin.rpc.mock.calls)).not.toContain(String(links[0]?.url));
    expect(JSON.stringify(admin.rpc.mock.calls)).not.toContain(String(links[0]?.url).split("#")[1]);
  });

  it.each([
    ["voided", null],
    ["active", "2026-07-16T20:00:00.000Z"],
  ])("prepares the fixed QR for historical record state %s", async (recordState, deletedAt) => {
    getSupabaseAdmin.mockReturnValue(createIssueAdmin({ recordState, deletedAt }));

    const links = await issueCustomerStatusLinks(["order-1"], {
      id: "owner-1",
      displayName: "Owner",
      storeId: "store-1",
      storeRole: "owner",
    });

    expect(links).toHaveLength(1);
    expect(links[0]?.url).toMatch(/\/r#v2\./);
  });
});

function createPublicAdmin(
  events: string[],
  options: {
    filters?: Filter[];
    rateLimitResults?: Array<Record<string, unknown>>;
    lifecycleRevision?: number;
    stableIdentity?: boolean;
  } = {},
) {
  const rateLimitResults = [...(options.rateLimitResults ?? [])];
  const rpc = vi.fn(
    async (
      name: string,
      input: { p_scope_key?: string; p_ip_scope_key?: string; p_global_scope_key?: string },
    ) => {
      const kind =
        name === "repairdesk_consume_customer_status_public_request_v1"
          ? "request"
          : String(input.p_scope_key || "").split(":", 1)[0];
      events.push(`rpc:${kind}`);
      return {
        data: rateLimitResults.shift() ?? { allowed: true, retry_after_seconds: 0 },
        error: null,
      };
    },
  );

  return {
    rpc,
    from(table: string) {
      events.push(`from:${table}`);
      const filters: Filter[] = [];
      const builder = {
        select() {
          return builder;
        },
        eq(field: string, value: unknown) {
          const filter = { table, field, value };
          filters.push(filter);
          options.filters?.push(filter);
          return builder;
        },
        is(field: string, value: unknown) {
          const filter = { table, field, value };
          filters.push(filter);
          options.filters?.push(filter);
          return builder;
        },
        gt(field: string, value: unknown) {
          const filter = { table, field, value };
          filters.push(filter);
          options.filters?.push(filter);
          return builder;
        },
        maybeSingle: async (): Promise<QueryResult> => ({
          data: rowFor(table, filters, options.lifecycleRevision, options.stableIdentity),
          error: null,
        }),
      };
      return builder;
    },
  };
}

function rowFor(table: string, filters: Filter[], lifecycleRevision = 3, stableIdentity = false) {
  if (table === "repair_order_customer_status_identities" && stableIdentity) {
    return {
      order_id: "order-1",
      store_id: "store-1",
      public_id: "9e5b9bd0-f497-4ee7-8609-37cd23d19cc9",
      generation: 1,
      key_version: 1,
      lifecycle_revision: 3,
      public_access_state: "enabled",
    };
  }
  if (table === "repair_order_customer_status_links") {
    return {
      id: "link-1",
      store_id: "store-1",
      order_id: "order-1",
      expires_at: "2027-12-31T23:59:59.000Z",
      revoked_at: null,
      lifecycle_revision: 3,
    };
  }
  if (table === "stores") return { id: "store-1", name: "ZYG", status: "active" };
  if (table === "store_lifecycles") {
    return { store_id: "store-1", phase: "active", revision: lifecycleRevision };
  }
  if (table === "store_settings") {
    return { store_name: "ZYG HOME Riparazioni", store_phone: "+39 0931 000000" };
  }
  if (table === "devices") return { brand: "Apple", model: "iPhone" };
  if (table === "order_workflow_statuses") return { bucket: "pickup" };
  if (table === "repair_orders") {
    const internalProjection = filters.some((filter) => filter.field === "id");
    return internalProjection
      ? {
          id: "order-1",
          public_no: "R2027001",
          device_id: "device-1",
          workflow_status: "repair",
          status: "repaired",
          updated_at: "2026-07-20T12:00:00.000Z",
          record_state: "active",
          deleted_at: null,
          assignee_membership_id: "membership-1",
        }
      : null;
  }
  return null;
}

function createIssueAdmin(options: { recordState?: string; deletedAt?: string | null } = {}) {
  const rpc = vi.fn(async () => ({
    data: {
      identities: [
        {
          order_id: "order-1",
          public_id: "9e5b9bd0-f497-4ee7-8609-37cd23d19cc9",
          generation: 1,
          key_version: 1,
          lifecycle_revision: 3,
          public_access_state: "enabled",
        },
      ],
    },
    error: null,
  }));
  return {
    rpc,
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return builder;
        },
        is() {
          return builder;
        },
        maybeSingle: async (): Promise<QueryResult> => ({
          data:
            table === "stores"
              ? { id: "store-1", status: "active" }
              : { store_id: "store-1", phase: "active", revision: 3 },
          error: null,
        }),
        then(onFulfilled: (value: QueryResult) => unknown) {
          let result: QueryResult;
          if (table === "repair_orders") {
            result = {
              data: [
                {
                  id: "order-1",
                  store_id: "store-1",
                  record_state: options.recordState ?? "active",
                  deleted_at: options.deletedAt ?? null,
                  assignee_membership_id: "membership-1",
                },
              ],
              error: null,
            };
          } else {
            result = { data: null, error: null };
          }
          return Promise.resolve(result).then(onFulfilled);
        },
      };
      return builder;
    },
  };
}
