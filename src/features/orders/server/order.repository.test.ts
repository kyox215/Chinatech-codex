import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmCancelledOrderReturn,
  isOrderAttachmentStorageScoped,
  isOrderInActorScope,
  getOrder,
  getOrderStats,
  listOrdersPage,
  patchOrder,
  projectOrderDetailForActor,
  projectOrderListItemForActor,
  recordPayment,
  sendNotification,
  transitionOrder,
  uploadOrderAttachment,
} from "@/features/orders/server/order.repository";
import type { AuditActor, OrderDetail, OrderListItem } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

const scopedOrderAttachment = {
  store_id: "store_1",
  order_id: "ord_1",
  storage_bucket: "repairdesk-order-attachments",
  storage_path: "store_1/ord_1/photo.jpg",
};

describe("order repository tenant storage boundaries", () => {
  it("allows signing only for the active store and order path", () => {
    expect(isOrderAttachmentStorageScoped(scopedOrderAttachment, "store_1", "ord_1")).toBe(true);
  });

  it("rejects attachment metadata pointing to another store path", () => {
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          storage_path: "store_2/ord_1/photo.jpg",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
  });

  it("rejects attachment metadata for another order or bucket", () => {
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          order_id: "ord_2",
          storage_path: "store_1/ord_2/photo.jpg",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          storage_bucket: "public",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
  });
});

describe("order repository role projection", () => {
  it("keeps full order fields for owner", () => {
    const projected = projectOrderListItemForActor(order(), actor("owner"));

    expect(projected.customer_phone).toBe("+39 333 000 0000");
    expect(projected.quotation_amount).toBe(120);
    expect(projected.device_unlock_method).toBe("pin");
    expect(projected.device_unlock_value).toBeUndefined();
    expect(projected.supplier_id).toBe("supplier_1");
    expect(projected.finance_redacted).toBeUndefined();
  });

  it("returns unlock values only inside an authorized detail projection", () => {
    const projected = projectOrderDetailForActor(detail(), actor("owner"));

    expect(projected.order.device_unlock_method).toBe("pin");
    expect(projected.order.device_unlock_value).toBe("1234");
  });

  it("redacts finance and other sensitive fields from technician list rows", () => {
    const projected = projectOrderListItemForActor(order(), actor("technician"));

    expect(projected.customer_phone).toBe("***0000");
    expect(projected.contact_phones).toEqual(["***0000"]);
    expect(Object.hasOwn(projected, "quotation_amount")).toBe(false);
    expect(Object.hasOwn(projected, "deposit_amount")).toBe(false);
    expect(Object.hasOwn(projected, "balance_amount")).toBe(false);
    expect(projected.fault_prices).toEqual([]);
    expect(projected.device_unlock_method).toBeUndefined();
    expect(projected.device_unlock_value).toBeUndefined();
    expect(projected.supplier_id).toBeUndefined();
    expect(projected.supplier_name).toBeUndefined();
    expect(projected.finance_redacted).toBe(true);
    expect(projected.customer_contact_redacted).toBe(true);
    expect(projected.sensitive_redacted).toBe(true);
  });

  it("reveals only the opened order amount to technicians", () => {
    const projected = projectOrderDetailForActor(detail(), actor("technician"));

    expect(projected.order.quotation_amount).toBe(120);
    expect(projected.order.deposit_amount).toBe(20);
    expect(projected.order.balance_amount).toBe(100);
    expect(projected.order.finance_redacted).toBeUndefined();
  });

  it.each(["manager", "sales"] as const)(
    "keeps %s list rows non-aggregatable while preserving single-order detail amounts",
    (role) => {
      const listItem = projectOrderListItemForActor(order(), actor(role));
      const orderDetail = projectOrderDetailForActor(detail(), actor(role));

      expect(Object.hasOwn(listItem, "quotation_amount")).toBe(false);
      expect(listItem.finance_redacted).toBe(true);
      expect(orderDetail.order.quotation_amount).toBe(120);
    },
  );

  it("requires a stable matching membership for technician order access", () => {
    const technician = actor("technician");
    expect(
      isOrderInActorScope({ assignee_membership_id: "membership_technician" }, technician),
    ).toBe(true);
    expect(isOrderInActorScope({ assignee_membership_id: "membership_other" }, technician)).toBe(
      false,
    );
    expect(isOrderInActorScope({ assignee_membership_id: undefined }, technician)).toBe(false);
    expect(isOrderInActorScope({ assignee_membership_id: undefined }, actor("manager"))).toBe(true);
  });

  it("redacts detail customer contact, messages, event payloads, and attachment links", () => {
    const projected = projectOrderDetailForActor(detail(), actor("viewer"));

    expect(Object.hasOwn(projected.order, "quotation_amount")).toBe(false);
    expect(Object.hasOwn(projected.order, "deposit_amount")).toBe(false);
    expect(Object.hasOwn(projected.order, "balance_amount")).toBe(false);
    expect(projected.order.finance_redacted).toBe(true);
    expect(projected.customer?.phone_e164).toBe("***0000");
    expect(projected.customer?.email).toBeUndefined();
    expect(projected.customer?.notes).toBeUndefined();
    expect(projected.messages).toEqual([]);
    expect(projected.events[0]?.payload).toEqual({});
    expect(projected.attachments[0]).toMatchObject({
      public_url: undefined,
      signed_url: undefined,
      storage_path: "",
    });
  });
});

describe("order repository database pagination", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  it("reads stable chunks before applying status and oldest-created-first page order", async () => {
    const queries: ReturnType<typeof createSupabaseQuery>[] = [];
    mocks.supabase.from.mockImplementation(() => {
      const query = createSupabaseQuery({
        data: Array.from({ length: 101 }, (_, index) =>
          orderRow({
            id: `order_${index}`,
            created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
            updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
          }),
        ),
        error: null,
        count: 101,
      });
      queries.push(query);
      return query;
    });

    const result = await listOrdersPage({ page: 2, pageSize: 50 }, actor("owner"));

    expect(result.items).toHaveLength(50);
    expect(result.items[0]?.id).toBe("order_50");
    expect(result.total).toBe(101);
    expect(queries[0]?.order).toHaveBeenNthCalledWith(1, "updated_at", { ascending: false });
    expect(queries[0]?.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(queries[0]?.range).toHaveBeenCalledWith(0, 999);
    expect(queries[0]?.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(queries[0]?.neq).toHaveBeenNthCalledWith(1, "status", "completed");
    expect(queries[0]?.neq).toHaveBeenNthCalledWith(2, "status", "cancelled");
    expect(queries[0]?.or).toHaveBeenCalledWith(
      "exception_status.is.null,exception_status.neq.cancelled",
    );
    const indexSelect = (queries[0]?.select.mock.calls as unknown[][])[0]?.[0];
    expect(String(indexSelect)).not.toContain("customer:customers(*)");
    expect(queries[1]?.in).toHaveBeenCalledWith(
      "id",
      Array.from({ length: 50 }, (_, index) => `order_${index + 50}`),
    );
  });

  it("clamps direct repository callers to at most 50 detail rows", async () => {
    const queries: ReturnType<typeof createSupabaseQuery>[] = [];
    mocks.supabase.from.mockImplementation(() => {
      const query = createSupabaseQuery({
        data: Array.from({ length: 80 }, (_, index) =>
          orderRow({
            id: `order_${index}`,
            created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
            updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
          }),
        ),
        error: null,
        count: 80,
      });
      queries.push(query);
      return query;
    });

    const result = await listOrdersPage({ page: 1, pageSize: 100 }, actor("owner"));
    const detailInCalls = queries[1]?.in.mock.calls as unknown[][];

    expect(result.pageSize).toBe(50);
    expect(result.items).toHaveLength(50);
    expect(detailInCalls[0]?.[1]).toHaveLength(50);
  });

  it("filters terminal rows before pending totals, group counts, and pagination", async () => {
    mocks.supabase.from.mockImplementation(() =>
      createSupabaseQuery({
        data: [
          ...Array.from({ length: 55 }, (_, index) =>
            orderRow({ id: `active_${index}`, public_no: `R-ACTIVE-${index}` }),
          ),
          ...Array.from({ length: 70 }, (_, index) =>
            orderRow({
              id: `terminal_${index}`,
              public_no: `R-TERMINAL-${index}`,
              status: index % 2 === 0 ? "completed" : "cancelled",
              workflow_status: "closed",
              is_paid: false,
              payment_status: "unpaid",
              balance_amount: 80,
            }),
          ),
        ],
        error: null,
        count: 125,
      }),
    );

    const result = await listOrdersPage({ page: 2, pageSize: 50 }, actor("owner"));

    expect(result.total).toBe(55);
    expect(result.pageCount).toBe(2);
    expect(result.items).toHaveLength(5);
    expect(result.queueCounts.all).toBe(55);
    expect(
      Object.entries(result.queueCounts)
        .filter(([key]) => key !== "all")
        .reduce((sum, [, count]) => sum + count, 0),
    ).toBe(55);
    expect(result.resultGroupCounts.processing).toBe(55);
  });

  it("defaults to nonterminal work and keeps every completed or cancelled order in history", async () => {
    mocks.supabase.from.mockImplementation(() =>
      createSupabaseQuery({
        data: [
          orderRow({ id: "paid_active", public_no: "R-ACTIVE", is_paid: true }),
          orderRow({
            id: "paid_closed",
            public_no: "R-ARCHIVE",
            status: "completed",
            workflow_status: "closed",
            is_paid: true,
            payment_status: "paid",
            balance_amount: 0,
            delivered_at: "2026-07-09T11:00:00.000Z",
          }),
          orderRow({
            id: "unpaid_closed",
            public_no: "R-UNPAID",
            status: "completed",
            workflow_status: "closed",
            is_paid: false,
          }),
          orderRow({
            id: "cancelled",
            public_no: "R-CANCELLED",
            status: "cancelled",
            workflow_status: "closed",
            is_paid: false,
          }),
        ],
        error: null,
        count: 4,
      }),
    );

    const active = await listOrdersPage({}, actor("owner"));
    expect(active.items.map((item) => item.id)).toEqual(["paid_active"]);
    expect(active.total).toBe(1);
    expect(active.queueCounts).toEqual({
      all: 1,
      processing: 1,
      ordered: 0,
      arrived: 0,
      arrived_notified: 0,
      repaired: 0,
      repaired_notified: 0,
    });
    expect(active.resultGroupCounts).toMatchObject({ processing: 1, completed: 0, cancelled: 0 });

    const archive = await listOrdersPage({ view: "archive" }, actor("owner"));
    expect(archive.items.map((item) => item.id).sort()).toEqual([
      "cancelled",
      "paid_closed",
      "unpaid_closed",
    ]);
    expect(archive.resultGroupCounts).toMatchObject({ completed: 2, cancelled: 1 });

    const stats = await getOrderStats(actor("owner"));
    expect(stats).toMatchObject({ total: 1, unpaid: 0 });
  });

  it("allows technicians to search archived orders without granting archive browsing", async () => {
    mocks.supabase.from.mockImplementation(() =>
      createSupabaseQuery({
        data: [
          orderRow({
            id: "unpaid_closed",
            public_no: "R-ARCHIVE",
            status: "completed",
            workflow_status: "closed",
            is_paid: false,
            payment_status: "partial",
            balance_amount: 35,
          }),
        ],
        error: null,
        count: 1,
      }),
    );

    const search = await listOrdersPage({ search: "R-ARCHIVE" }, actor("technician"));
    expect(search.items).toHaveLength(1);
    expect(search.resultGroupCounts.completed).toBe(1);
    expect(Object.hasOwn(search.items[0] ?? {}, "quotation_amount")).toBe(false);
    expect(search.items[0]?.finance_redacted).toBe(true);
    const groupedSearch = await listOrdersPage(
      { search: "R-ARCHIVE", queueGroups: ["processing"] },
      actor("technician"),
    );
    expect(groupedSearch.items).toEqual([]);
    await expect(listOrdersPage({ view: "archive" }, actor("technician"))).rejects.toThrow(
      "无权浏览历史归档",
    );
  });

  it("does not let short or fuzzy technician searches enumerate archived orders", async () => {
    mocks.supabase.from.mockImplementation(() =>
      createSupabaseQuery({
        data: [
          orderRow({
            id: "paid_closed",
            public_no: "R-ARCHIVE",
            status: "completed",
            workflow_status: "closed",
            is_paid: true,
            payment_status: "paid",
            balance_amount: 0,
            delivered_at: "2026-07-09T11:00:00.000Z",
          }),
        ],
        error: null,
        count: 1,
      }),
    );

    const shortSearch = await listOrdersPage({ search: "R" }, actor("technician"));
    const fuzzySearch = await listOrdersPage({ search: "iPhone" }, actor("technician"));

    expect(shortSearch.items).toEqual([]);
    expect(fuzzySearch.items).toEqual([]);
  });

  it("keeps explicit archive searches inside the archive view", async () => {
    mocks.supabase.from.mockImplementation(() =>
      createSupabaseQuery({
        data: [
          orderRow({
            id: "paid_closed",
            public_no: "R-ARCHIVE",
            status: "completed",
            workflow_status: "closed",
            is_paid: true,
            payment_status: "paid",
            balance_amount: 0,
            delivered_at: "2026-07-09T11:00:00.000Z",
          }),
          orderRow({
            id: "active_match",
            public_no: "R-ARCHIVE-ACTIVE",
            status: "repairing",
            workflow_status: "repair",
          }),
        ],
        error: null,
        count: 2,
      }),
    );

    const result = await listOrdersPage({ view: "archive", search: "R-ARCHIVE" }, actor("owner"));

    expect(result.items.map((item) => item.id)).toEqual(["paid_closed"]);
  });

  it("fails closed for technician lists before the assignment migration", async () => {
    const legacyRow = orderRow({ technician_name: "Technician" });
    Reflect.deleteProperty(legacyRow, "assignee_membership_id");
    mocks.supabase.from
      .mockReturnValueOnce(
        createSupabaseQuery({
          data: null,
          error: { message: "column repair_orders.assignee_membership_id does not exist" },
          count: 0,
        }),
      )
      .mockReturnValueOnce(
        createSupabaseQuery({
          data: [legacyRow],
          error: null,
          count: 1,
        }),
      );

    const result = await listOrdersPage({}, actor("technician"));

    expect(result.items).toEqual([]);
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("pushes the technician membership boundary into both list queries", async () => {
    const queries: ReturnType<typeof createSupabaseQuery>[] = [];
    mocks.supabase.from.mockImplementation(() => {
      const query = createSupabaseQuery({ data: [orderRow()], error: null, count: 1 });
      queries.push(query);
      return query;
    });

    const result = await listOrdersPage({}, actor("technician"));

    expect(result.items).toHaveLength(1);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.eq).toHaveBeenCalledWith("assignee_membership_id", "membership_technician");
    expect(queries[1]?.eq).toHaveBeenCalledWith("assignee_membership_id", "membership_technician");
  });

  it("rejects a renamed technician opening a legacy order before loading child data", async () => {
    const legacyRow = orderRow({ technician_name: "Technician B" });
    Reflect.deleteProperty(legacyRow, "assignee_membership_id");
    mocks.supabase.from.mockReturnValueOnce(
      createSupabaseQuery({ data: legacyRow, error: null, count: 1 }),
    );

    await expect(
      getOrder("order_1", { ...actor("technician"), displayName: "Technician B" }),
    ).rejects.toThrow("当前工单未分配给你");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "patch",
      () =>
        patchOrder(
          "order_1",
          {
            expected_updated_at: "2026-07-09T10:00:00.000Z",
            changes: { diagnosis_result: "Replace screen" },
          },
          { ...actor("technician"), displayName: "Technician B" },
        ),
    ],
    [
      "transition",
      () =>
        transitionOrder("order_1", "repairing", {
          operator: { ...actor("technician"), displayName: "Technician B" },
        }),
    ],
    [
      "attachment",
      () =>
        uploadOrderAttachment(
          "order_1",
          {
            kind: "fault_photo",
            file_name: "photo.jpg",
            mime_type: "image/jpeg",
            file_size: 1,
            data_base64: "AA==",
          },
          { ...actor("technician"), displayName: "Technician B" },
        ),
    ],
    [
      "message",
      () =>
        sendNotification("order_1", "Ready", "whatsapp", {
          ...actor("technician"),
          displayName: "Technician B",
        }),
    ],
  ])("rejects a renamed technician before a legacy %s write", async (_operation, run) => {
    mockLegacyAssignmentLookup();

    await expect(run()).rejects.toThrow("当前工单未分配给你");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
  });

  it("rejects a technician opening another member's order before loading child data", async () => {
    mocks.supabase.from.mockReturnValueOnce(
      createSupabaseQuery({
        data: orderRow({ assignee_membership_id: "membership_other" }),
        error: null,
        count: 1,
      }),
    );

    await expect(getOrder("order_1", actor("technician"))).rejects.toThrow("当前工单未分配给你");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });
});

describe("order repository atomic payment adapter", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  it("sends the store, actor, expected version, and idempotency key to the payment RPC", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "recorded",
        payment_id: "00000000-0000-4000-8000-000000000501",
        balance: 75,
        is_paid: false,
        updated_at: "2026-07-10T15:00:00.000Z",
      },
      error: null,
    });
    const owner = actor("owner");

    const result = await recordPayment(
      "order_1",
      25,
      "现金",
      owner,
      "2026-07-10T14:00:00.000Z",
      "00000000-0000-4000-8000-000000000502",
    );

    expect(mocks.supabase.rpc).toHaveBeenCalledWith("repairdesk_record_order_payment", {
      p_store_id: "store_1",
      p_order_id: "order_1",
      p_actor_id: "staff_owner",
      p_amount: 25,
      p_method: "现金",
      p_expected_updated_at: "2026-07-10T14:00:00.000Z",
      p_idempotency_key: "00000000-0000-4000-8000-000000000502",
    });
    expect(result).toMatchObject({ ok: true, code: "recorded", balance: 75, is_paid: false });
  });

  it("maps stable database failure codes without falling back to the old multi-write path", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: { ok: false, code: "stale_version" },
      error: null,
    });

    await expect(
      recordPayment(
        "order_1",
        25,
        "现金",
        actor("owner"),
        "2026-07-10T14:00:00.000Z",
        "00000000-0000-4000-8000-000000000503",
      ),
    ).rejects.toThrow("工单已被更新");
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("maps the cancelled-order payment guard without any fallback write", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: { ok: false, code: "order_cancelled" },
      error: null,
    });

    await expect(
      recordPayment(
        "order_1",
        25,
        "现金",
        actor("owner"),
        "2026-07-10T14:00:00.000Z",
        "00000000-0000-4000-8000-000000000507",
      ),
    ).rejects.toThrow("已取消工单不能登记收款");
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it.each([0.29, 0.57])("accepts a valid cent amount of %s", async (amount) => {
    mocks.supabase.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "recorded",
        payment_id: "00000000-0000-4000-8000-000000000504",
        balance: 75,
        is_paid: false,
        updated_at: "2026-07-10T15:00:00.000Z",
      },
      error: null,
    });

    await recordPayment(
      "order_1",
      amount,
      "现金",
      actor("owner"),
      "2026-07-10T14:00:00.000Z",
      "00000000-0000-4000-8000-000000000505",
    );

    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "repairdesk_record_order_payment",
      expect.objectContaining({ p_amount: amount }),
    );
  });

  it("rejects sub-cent payment amounts before the RPC", async () => {
    await expect(
      recordPayment(
        "order_1",
        25.555,
        "现金",
        actor("owner"),
        "2026-07-10T14:00:00.000Z",
        "00000000-0000-4000-8000-000000000506",
      ),
    ).rejects.toThrow("最多保留两位小数");
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("order repository custody writes", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  it("version-locks normal status transitions before writing the event", async () => {
    const readQuery = createSupabaseQuery({
      data: orderRow({ status: "new", workflow_status: "intake" }),
      error: null,
      count: 1,
    });
    const targetQuery = createSupabaseQuery({
      data: { code: "repairing", label: "维修中", enabled: true },
      error: null,
      count: 1,
    });
    const updateQuery = createSupabaseQuery({
      data: { updated_at: "2026-07-09T10:01:00.000Z" },
      error: null,
      count: 1,
    });
    const eventQuery = createSupabaseQuery({ data: null, error: null, count: 1 });
    mocks.supabase.from
      .mockReturnValueOnce(readQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(eventQuery);

    await transitionOrder("order_1", "repairing", { operator: actor("owner") });

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "repairing", workflow_status: "repair" }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith("updated_at", "2026-07-09T10:00:00.000Z");
    expect(eventQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_1",
        order_id: "order_1",
        event_type: "status_changed",
      }),
    );
  });

  it("confirms a cancelled return without mutating finance fields", async () => {
    const readQuery = createSupabaseQuery({
      data: orderRow({
        status: "cancelled",
        workflow_status: "closed",
        completed_at: null,
        delivered_at: null,
      }),
      error: null,
      count: 1,
    });
    const updateQuery = createSupabaseQuery({
      data: { updated_at: "2026-07-09T10:01:00.000Z" },
      error: null,
      count: 1,
    });
    const eventQuery = createSupabaseQuery({ data: null, error: null, count: 1 });
    mocks.supabase.from
      .mockReturnValueOnce(readQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(eventQuery);

    const result = await confirmCancelledOrderReturn("order_1", {
      expectedUpdatedAt: "2026-07-09T10:00:00.000Z",
      idempotencyKey: "00000000-0000-4000-8000-000000000601",
      operator: actor("owner"),
    });

    const update = updateQuery.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(update).toMatchObject({
      completed_at: expect.any(String),
      delivered_at: expect.any(String),
    });
    expect(update).not.toHaveProperty("quotation_amount");
    expect(update).not.toHaveProperty("deposit_amount");
    expect(update).not.toHaveProperty("balance_amount");
    expect(update).not.toHaveProperty("is_paid");
    expect(eventQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          action: "custody_return_confirmed",
          handover_confirmed: true,
          custody_outcome: "returned",
        }),
      }),
    );
    expect(result).toMatchObject({ ok: true, alreadyConfirmed: false });
  });
});

function actor(role: NonNullable<AuditActor["storeRole"]>): AuditActor {
  return {
    id: `staff_${role}`,
    displayName: String(role),
    role,
    storeRole: role,
    storeId: "store_1",
    activeMembershipId: `membership_${role}`,
  };
}

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order_1",
    public_no: "R2026001",
    order_type: "quick_repair",
    status: "new",
    customer_id: "customer_1",
    device_id: "device_1",
    issue_description: "Screen cracked",
    diagnosis_result: "Replace screen",
    quotation_amount: 120,
    deposit_amount: 20,
    balance_amount: 100,
    currency_code: "EUR",
    is_paid: false,
    approval_status: "pending",
    technician_name: "Marco",
    assignee_membership_id: "membership_technician",
    supplier_id: "supplier_1",
    parts_supplier_id: "supplier_1",
    contact_phones: ["+39 333 000 0000"],
    fault_prices: [{ name: "Screen", price: 120 }],
    device_unlock_method: "pin",
    device_unlock_value: "1234",
    customer_signature: "signature-data",
    created_at: "2026-07-09T10:00:00.000Z",
    updated_at: "2026-07-09T10:00:00.000Z",
    customer_name: "Cliente",
    customer_phone: "+39 333 000 0000",
    device_label: "Apple iPhone 13",
    device_imei: "490154203237518",
    supplier_name: "Alessio",
    supplier_color: "#2563eb",
    approval_overdue: false,
    pickup_overdue: false,
    ...overrides,
  };
}

function detail(): OrderDetail {
  return {
    order: order(),
    customer: {
      id: "customer_1",
      name: "Cliente",
      phone_e164: "+39 333 000 0000",
      phone_raw: "+39 333 000 0000",
      contact_phones: ["+39 333 000 0000"],
      consent_marketing: true,
      consent_sms: true,
      email: "cliente@example.com",
      notes: "private note",
      marketing_notes: "marketing note",
    },
    device: {
      id: "device_1",
      customer_id: "customer_1",
      brand: "Apple",
      model: "iPhone 13",
      serial_or_imei: "490154203237518",
    },
    supplier: {
      id: "supplier_1",
      name: "Alessio Parts",
      short_name: "Alessio",
      color: "#2563eb",
    },
    parts_supplier: {
      id: "supplier_1",
      name: "Alessio Parts",
      short_name: "Alessio",
      color: "#2563eb",
    },
    events: [
      {
        id: "event_1",
        order_id: "order_1",
        event_type: "payment",
        payload: { amount: 20 },
        operator_name: "Owner",
        created_at: "2026-07-09T10:00:00.000Z",
      },
    ],
    messages: [
      {
        id: "message_1",
        order_id: "order_1",
        channel: "whatsapp",
        message_body: "private message",
        status: "sent",
        sent_at: "2026-07-09T10:00:00.000Z",
      },
    ],
    attachments: [
      {
        id: "attachment_1",
        store_id: "store_1",
        order_id: "order_1",
        kind: "signature",
        file_name: "signature.png",
        mime_type: "image/png",
        file_size: 100,
        storage_bucket: "repairdesk-order-attachments",
        storage_path: "store_1/order_1/signature.png",
        public_url: "https://example.com/public.png",
        signed_url: "https://example.com/signed.png",
        created_at: "2026-07-09T10:00:00.000Z",
        updated_at: "2026-07-09T10:00:00.000Z",
      },
    ],
  };
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_1",
    public_no: "R2026001",
    order_type: "quick_repair",
    status: "new",
    customer_id: "customer_1",
    device_id: "device_1",
    issue_description: "Screen cracked",
    quotation_amount: 120,
    deposit_amount: 20,
    balance_amount: 100,
    is_paid: false,
    approval_status: "pending",
    technician_name: "Marco",
    assignee_membership_id: "membership_technician",
    customer_phone: "+39 333 000 0000",
    contact_phones: [],
    fault_prices: [],
    created_at: "2026-07-09T10:00:00.000Z",
    updated_at: "2026-07-09T10:00:00.000Z",
    customer: {
      id: "customer_1",
      name: "Cliente",
      phone_e164: "+39 333 000 0000",
      phone_raw: "393330000000",
      contact_phones: [],
    },
    device: {
      id: "device_1",
      customer_id: "customer_1",
      brand: "Apple",
      model: "iPhone 13",
      serial_or_imei: "490154203237518",
    },
    ...overrides,
  };
}

function createSupabaseQuery(result: { data: unknown; error: unknown; count: number }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    update: vi.fn((_value: unknown) => query),
    insert: vi.fn((_value: unknown) => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    neq: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    single: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
  };
  return query;
}

function mockLegacyAssignmentLookup() {
  const legacyRow = orderRow({ technician_name: "Technician B" });
  Reflect.deleteProperty(legacyRow, "assignee_membership_id");
  mocks.supabase.from
    .mockReturnValueOnce(
      createSupabaseQuery({
        data: null,
        error: { message: "column repair_orders.assignee_membership_id does not exist" },
        count: 0,
      }),
    )
    .mockReturnValueOnce(
      createSupabaseQuery({
        data: legacyRow,
        error: null,
        count: 1,
      }),
    );
}
