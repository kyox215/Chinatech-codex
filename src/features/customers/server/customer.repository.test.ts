import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import {
  createCustomerFollowup,
  fetchCustomerRows,
  listCustomers,
  listCustomersPage,
  searchCustomerIntakeCandidates,
  sendCustomerMessage,
  upsertCustomerDevice,
} from "./customer.repository";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

const storeActor: AuditActor = {
  id: "staff_1",
  email: "staff@example.com",
  displayName: "Staff",
  storeId: "store_1",
  storeName: "ChinaTech",
  storeRole: "technician",
};

describe("customer repository tenant write boundaries", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  it("uses the v3 historical/valid contract without re-summing cancelled balances", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: {
        items: [
          {
            id: "customer_1",
            name: "Mario",
            phone_e164: "+39333",
            phone_raw: "39333",
            contact_phones: [],
            consent_marketing: true,
            tags: [],
            device_count: 1,
            order_count: 2,
            valid_order_count: 1,
            active_order_count: 1,
            lifetime_quoted_amount: 70,
            outstanding_amount: 70,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        pageCount: 1,
        tags: [],
        stats: {
          total: 1,
          repeat: 0,
          activeRepairs: 1,
          unpaid: 1,
          withDevices: 1,
          dueFollowups: 0,
          marketable: 1,
        },
      },
      error: null,
    });

    const result = await listCustomersPage(
      { page: 1, pageSize: 10 },
      { ...storeActor, storeRole: "owner" },
    );

    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "repairdesk_customer_list_page_v3",
      expect.any(Object),
    );
    expect(result.items[0]).toMatchObject({
      order_count: 2,
      valid_order_count: 1,
      total_spent: 70,
      unpaid_amount: 70,
    });
    expect(result.items[0]).not.toHaveProperty("phone_raw");
    expect(result.items[0]).not.toHaveProperty("contact_phones");
    expect(result.items[0]).not.toHaveProperty("consent_marketing");
    expect(result.items[0]).not.toHaveProperty("notes");
    expect(result.items[0]).not.toHaveProperty("marketing_notes");
    expect(result.items[0]).not.toHaveProperty("device_search_text");
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("fails closed on a real v3 error instead of reviving the known-wrong v2 path", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "aggregate query failed" },
    });

    await expect(listCustomersPage({ pageSize: 10 }, storeActor)).rejects.toThrow(
      "aggregate query failed",
    );
    expect(mocks.supabase.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("blocks device upsert when the customer is outside the active store", async () => {
    const customerQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(customerQuery);

    await expect(
      upsertCustomerDevice("customer_2", { brand: "Apple", model: "iPhone 15 Pro" }, storeActor),
    ).rejects.toThrow("客户不存在");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("customers");
    expect(customerQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(customerQuery.eq).toHaveBeenCalledWith("id", "customer_2");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("devices");
  });

  it("blocks followup creation when the linked order is not in the same store and customer", async () => {
    const customerQuery = createSupabaseQuery({ data: { id: "customer_1" }, error: null });
    const orderQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(customerQuery).mockReturnValueOnce(orderQuery);

    await expect(
      createCustomerFollowup(
        "customer_1",
        {
          order_id: "ord_2",
          title: "回访报价",
          due_at: "2026-07-05T10:00:00.000Z",
        },
        storeActor,
      ),
    ).rejects.toThrow("关联工单不存在或不属于当前客户");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(1, "customers");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(2, "repair_orders");
    expect(orderQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(orderQuery.eq).toHaveBeenCalledWith("customer_id", "customer_1");
    expect(orderQuery.eq).toHaveBeenCalledWith("id", "ord_2");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customer_followups");
  });

  it("blocks outbound customer messages before writing interactions for another store", async () => {
    const customerQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(customerQuery);

    await expect(
      sendCustomerMessage(
        "customer_2",
        { channel: "whatsapp", body: "您的维修报价已更新" },
        storeActor,
      ),
    ).rejects.toThrow("客户不存在");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("customers");
    expect(customerQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(customerQuery.eq).toHaveBeenCalledWith("id", "customer_2");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customer_interactions");
  });

  it("fails closed when customer child tables lack store_id instead of falling back unscoped", async () => {
    const customerQuery = createSupabaseQuery({
      data: [
        {
          id: "customer_1",
          name: "Zhang",
          phone_e164: "+39000000000",
          phone_raw: "39000000000",
          contact_phones: [],
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const devicesQuery = createSupabaseQuery({ data: [], error: null });
    const followupsQuery = createSupabaseQuery({
      data: null,
      error: {
        code: "42703",
        message: "Could not find the 'store_id' column of 'customer_followups'",
      },
    });
    mocks.supabase.from
      .mockReturnValueOnce(customerQuery)
      .mockReturnValueOnce(devicesQuery)
      .mockReturnValueOnce(followupsQuery);

    await expect(listCustomers({}, storeActor)).rejects.toThrow("读取客户待办失败");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(3);
    expect(followupsQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(followupsQuery.in).toHaveBeenCalledWith("customer_id", ["customer_1"]);
  });

  it("reads customer fallback rows beyond the first 1000 with stable ranges", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `customer_${index}` }));
    const firstQuery = createSupabaseQuery({ data: firstPage, error: null });
    const secondQuery = createSupabaseQuery({ data: [{ id: "customer_1000" }], error: null });
    mocks.supabase.from.mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery);

    const rows = await fetchCustomerRows("store_1");

    expect(rows).toHaveLength(1001);
    expect(firstQuery.range).toHaveBeenCalledWith(0, 999);
    expect(secondQuery.range).toHaveBeenCalledWith(1000, 1999);
    expect(firstQuery.order).toHaveBeenNthCalledWith(1, "updated_at", { ascending: false });
    expect(firstQuery.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });
});

describe("customer intake structured search", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  it("never adds a name query when a phone is present", async () => {
    const queries: ReturnType<typeof createSupabaseQuery>[] = [];
    mocks.supabase.from.mockImplementation(() => {
      const query = createSupabaseQuery({ data: [], error: null });
      queries.push(query);
      return query;
    });

    await expect(
      searchCustomerIntakeCandidates(
        { phone: "3335719865", name: "Alessio", phoneMatchMode: "progressive" },
        ownerActor(),
      ),
    ).resolves.toEqual([]);

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.flatMap((query) => query.ilike.mock.calls)).not.toContainEqual([
      "name",
      expect.any(String),
    ]);
    expect(
      queries.every((query) => query.eq.mock.calls.some((call) => call[0] === "store_id")),
    ).toBe(true);
  });
});

describe("customer v3 pagination compatibility", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  it("falls back to v2 only when the v3 function is absent", async () => {
    mocks.supabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.repairdesk_customer_list_page_v3 in the schema cache",
        },
      })
      .mockResolvedValueOnce({ data: customerPageResult(), error: null });

    await expect(listCustomersPage({}, ownerActor())).resolves.toMatchObject({ total: 1 });
    expect(mocks.supabase.rpc).toHaveBeenNthCalledWith(
      2,
      "repairdesk_customer_list_page_v2",
      expect.objectContaining({ p_store_id: "store_1" }),
    );
  });

  it("fails closed when the v3 function reports a runtime error", async () => {
    mocks.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "v3 aggregate invariant failed" },
    });

    await expect(listCustomersPage({}, ownerActor())).rejects.toThrow(
      "v3 aggregate invariant failed",
    );
    expect(mocks.supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the v3 response violates its contract", async () => {
    mocks.supabase.rpc.mockResolvedValueOnce({ data: { items: [] }, error: null });

    await expect(listCustomersPage({}, ownerActor())).rejects.toThrow("v3 数据契约无效");
    expect(mocks.supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("ignores a forged unpaid aggregate filter and redacts finance for technicians", async () => {
    mocks.supabase.rpc.mockResolvedValueOnce({ data: customerPageResult(), error: null });

    const result = await listCustomersPage({ work: "unpaid" }, storeActor);

    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "repairdesk_customer_list_page_v3",
      expect.objectContaining({ p_work_filter: "all" }),
    );
    expect(result.stats.unpaid).toBe(0);
    expect(result.stats.financeRedacted).toBe(true);
    expect(result.items[0]).toMatchObject({ finance_redacted: true });
    expect(result.items[0]).not.toHaveProperty("lifetime_quoted_amount");
    expect(result.items[0]).not.toHaveProperty("outstanding_amount");
  });
});

function ownerActor(): AuditActor {
  return {
    ...storeActor,
    id: "staff_owner",
    storeRole: "owner",
    role: "owner",
  };
}

function customerPageResult() {
  return {
    items: [
      {
        id: "customer_1",
        name: "Cliente",
        phone_e164: "+39000000000",
        phone_raw: "39000000000",
        contact_phones: [],
        order_count: 1,
        valid_order_count: 1,
        active_order_count: 1,
        lifetime_quoted_amount: 90,
        outstanding_amount: 90,
        total_spent: 90,
        unpaid_amount: 90,
        devices: [],
        tags: [],
        next_followup_at: null,
        consent_marketing: false,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    pageSize: 50,
    pageCount: 1,
    tags: [],
    stats: {
      total: 1,
      repeat: 0,
      activeRepairs: 1,
      unpaid: 1,
      withDevices: 0,
      dueFollowups: 0,
      marketable: 0,
    },
  };
}

function createSupabaseQuery(result: { data: unknown; error: unknown }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn((_column: string, _value: unknown) => query),
    in: vi.fn(() => query),
    ilike: vi.fn((_column: string, _value: unknown) => query),
    order: vi.fn(() => query),
    range: vi.fn(() => result),
    limit: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
    insert: vi.fn(() => result),
    update: vi.fn(() => query),
  };
  return query;
}
