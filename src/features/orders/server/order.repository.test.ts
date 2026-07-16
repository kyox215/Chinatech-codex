import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmCancelledOrderReturn,
  correctTerminalOrder,
  isOrderAttachmentStorageScoped,
  isOrderInActorScope,
  getOrder,
  getOrderStats,
  listOrdersPage,
  patchOrder,
  projectOrderDetailForActor,
  projectOrderCapabilities,
  projectOrderListItemForActor,
  recordPayment,
  reopenOrder,
  sendNotification,
  sendWhatsappNotification,
  transitionOrder,
  updateOrderCustody,
  uploadOrderAttachment,
  voidOrder,
} from "@/features/orders/server/order.repository";
import type { AuditActor, OrderDetail, OrderListItem } from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";

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

  it.each(["with_customer", null] as const)(
    "never sends unlock secrets when device custody is %s",
    (device_custody_status) => {
      const source = detail();
      const projected = projectOrderDetailForActor(
        { ...source, order: { ...source.order, device_custody_status } },
        actor("owner"),
      );

      expect(projected.order.device_unlock_method).toBeUndefined();
      expect(projected.order.device_unlock_value).toBeUndefined();
      expect(projected.order.device_unlock_pattern).toBeUndefined();
      expect(projected.order.sensitive_redacted).toBe(true);
    },
  );

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

  it("uses a configured custom bucket ahead of a stale canonical closed value", () => {
    const customActive = projectOrderCapabilities(
      order({ status: "repairing", workflow_status: "closed", workflow_bucket: "custom" }),
      actor("owner"),
    );
    const customDone = projectOrderCapabilities(
      order({ status: "repairing", workflow_status: "repair", workflow_bucket: "done" }),
      actor("owner"),
    );

    expect(customActive).toMatchObject({ canEditIntake: true, canTransition: true });
    expect(customActive.canCorrect).toBe(false);
    expect(customDone).toMatchObject({
      canEditIntake: false,
      canTransition: false,
      canCorrect: true,
      canCollectPayment: true,
    });
  });

  it.each([
    { label: "legacy cancelled", changes: { status: "cancelled" as const } },
    {
      label: "exception cancelled",
      changes: { status: "repairing" as const, exception_status: "cancelled" as const },
    },
    {
      label: "custom cancelled",
      changes: { status: "repairing" as const, workflow_bucket: "cancelled" as const },
    },
    {
      label: "voided",
      changes: { status: "completed" as const, record_state: "voided" as const },
    },
    {
      label: "soft deleted",
      changes: { status: "completed" as const, deleted_at: "2026-07-16T20:00:00.000Z" },
    },
  ])("closes payment capability for $label orders", ({ changes }) => {
    expect(projectOrderCapabilities(order(changes), actor("owner")).canCollectPayment).toBe(false);
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
    expect(queries[0]?.eq).toHaveBeenCalledWith("record_state", "active");
    expect(queries[0]?.is).toHaveBeenCalledWith("deleted_at", null);
    expect(queries[0]?.not).toHaveBeenCalledWith("status", "in", "(completed,cancelled)");
    expect(queries[0]?.or).toHaveBeenCalledWith(
      "exception_status.neq.cancelled,exception_status.is.null",
    );
    const indexSelect = (queries[0]?.select.mock.calls as unknown[][])[0]?.[0];
    expect(String(indexSelect)).not.toContain("customer:customers(*)");
    expect(queries[2]?.in).toHaveBeenCalledWith(
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
    const detailInCalls = queries[2]?.in.mock.calls as unknown[][];

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

  it("keeps technician assignment scope when only lifecycle columns are not deployed", async () => {
    const legacyRow = orderRow({ technician_name: "Technician" });
    const statuses = createSupabaseQuery({
      data: [{ code: "new", bucket: "active" }],
      error: null,
      count: 1,
    });
    mocks.supabase.from
      .mockReturnValueOnce(
        createSupabaseQuery({
          data: null,
          error: { message: "column repair_orders.record_state does not exist" },
          count: 0,
        }),
      )
      .mockReturnValueOnce(
        createSupabaseQuery({
          data: [legacyRow],
          error: null,
          count: 1,
        }),
      )
      .mockReturnValueOnce(statuses)
      .mockReturnValueOnce(
        createSupabaseQuery({
          data: [legacyRow],
          error: null,
          count: 1,
        }),
      )
      .mockReturnValueOnce(statuses);

    const result = await listOrdersPage({}, actor("technician"));

    expect(result.items).toHaveLength(1);
    expect(mocks.supabase.from).toHaveBeenCalledTimes(5);
    const retrySelect = (
      (mocks.supabase.from.mock.results[1]?.value.select.mock.calls as unknown[][])[0]?.[0] ?? ""
    ).toString();
    expect(retrySelect).toContain("assignee_membership_id");
    expect(retrySelect).not.toContain("record_state");
    expect(mocks.supabase.from.mock.results[1]?.value.eq).toHaveBeenCalledWith(
      "assignee_membership_id",
      "membership_technician",
    );
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
    expect(queries).toHaveLength(4);
    expect(queries[0]?.eq).toHaveBeenCalledWith("assignee_membership_id", "membership_technician");
    expect(queries[2]?.eq).toHaveBeenCalledWith("assignee_membership_id", "membership_technician");
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

  it("fails closed for status transitions when the custody migration is unavailable", async () => {
    mocks.supabase.from.mockReturnValueOnce(
      createSupabaseQuery({
        data: null,
        error: { message: "column repair_orders.device_custody_status does not exist" },
        count: 0,
      }),
    );

    await expect(
      transitionOrder("order_1", "repairing", { operator: actor("technician") }),
    ).rejects.toThrow("设备保管功能尚未完成数据库迁移");
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
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

  it("maps the voided-order payment guard without any fallback write", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: { ok: false, code: "order_voided" },
      error: null,
    });

    await expect(
      recordPayment(
        "order_1",
        25,
        "现金",
        actor("owner"),
        "2026-07-10T14:00:00.000Z",
        "00000000-0000-4000-8000-000000000508",
      ),
    ).rejects.toThrow("已作废或删除的工单不能登记收款");
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
      data: { code: "repairing", label: "维修中", bucket: "repair", enabled: true },
      error: null,
      count: 1,
    });
    const currentBucketQuery = createSupabaseQuery({
      data: { bucket: "intake" },
      error: null,
      count: 1,
    });
    mocks.supabase.rpc.mockResolvedValueOnce({
      data: { ok: true, code: "updated", updated_at: "2026-07-09T10:01:00.000Z" },
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(readQuery)
      .mockReturnValueOnce(currentBucketQuery)
      .mockReturnValueOnce(targetQuery);

    await transitionOrder("order_1", "repairing", {
      operator: actor("owner"),
      expectedUpdatedAt: "2026-07-09T10:00:00.000Z",
      idempotencyKey: "00000000-0000-4000-8000-000000000600",
    });

    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "repairdesk_apply_order_atomic_mutation",
      expect.objectContaining({
        p_store_id: "store_1",
        p_order_id: "order_1",
        p_expected_updated_at: "2026-07-09T10:00:00.000Z",
        p_idempotency_key: "00000000-0000-4000-8000-000000000600",
        p_update: expect.objectContaining({ status: "repairing", workflow_status: "repair" }),
        p_event_type: "status_changed",
        p_event_payload: expect.objectContaining({ from: "new", to: "repairing" }),
      }),
    );
  });

  it("requires a reason for a configured custom cancelled target", async () => {
    const readQuery = createSupabaseQuery({
      data: orderRow({ status: "repairing", workflow_status: "repair" }),
      error: null,
      count: 1,
    });
    const currentBucketQuery = createSupabaseQuery({
      data: { bucket: "repair" },
      error: null,
      count: 1,
    });
    const targetQuery = createSupabaseQuery({
      data: { code: "customer_cancelled", label: "客户取消", bucket: "cancelled", enabled: true },
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(readQuery)
      .mockReturnValueOnce(currentBucketQuery)
      .mockReturnValueOnce(targetQuery);

    await expect(
      transitionOrder("order_1", "customer_cancelled" as RepairOrderStatus, {
        operator: actor("owner"),
      }),
    ).rejects.toThrow("需要填写原因");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(3);
  });

  it("confirms a cancelled return without mutating finance fields", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: {
        ok: true,
        already_confirmed: false,
        delivered_at: "2026-07-09T10:01:00.000Z",
      },
      error: null,
    });

    const result = await confirmCancelledOrderReturn("order_1", {
      expectedUpdatedAt: "2026-07-09T10:00:00.000Z",
      idempotencyKey: "00000000-0000-4000-8000-000000000601",
      operator: actor("owner"),
    });

    expect(mocks.supabase.rpc).toHaveBeenCalledWith("repairdesk_confirm_cancelled_order_return", {
      p_store_id: "store_1",
      p_order_id: "order_1",
      p_actor_id: "staff_owner",
      p_expected_updated_at: "2026-07-09T10:00:00.000Z",
      p_idempotency_key: "00000000-0000-4000-8000-000000000601",
    });
    const rpcPayload = mocks.supabase.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcPayload).not.toHaveProperty("quotation_amount");
    expect(rpcPayload).not.toHaveProperty("deposit_amount");
    expect(rpcPayload).not.toHaveProperty("balance_amount");
    expect(rpcPayload).not.toHaveProperty("is_paid");
    expect(result).toMatchObject({ ok: true, alreadyConfirmed: false });
  });

  it("returns an idempotent cancelled-return replay", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: {
        ok: true,
        already_confirmed: true,
        delivered_at: "2026-07-09T10:01:00.000Z",
      },
      error: null,
    });

    await expect(
      confirmCancelledOrderReturn("order_1", {
        expectedUpdatedAt: "2026-07-09T10:00:00.000Z",
        idempotencyKey: "00000000-0000-4000-8000-000000000602",
        operator: actor("owner"),
      }),
    ).resolves.toMatchObject({ ok: true, alreadyConfirmed: true });
  });

  it.each([
    ["actor_forbidden", "没有确认设备退还的权限"],
    ["invalid_state", "只有未作废的已取消工单"],
    ["stale_version", "已被其他操作更新"],
  ])("maps cancelled-return RPC code %s", async (code, message) => {
    mocks.supabase.rpc.mockResolvedValue({ data: { ok: false, code }, error: null });

    await expect(
      confirmCancelledOrderReturn("order_1", {
        expectedUpdatedAt: "2026-07-09T10:00:00.000Z",
        idempotencyKey: "00000000-0000-4000-8000-000000000603",
        operator: actor("owner"),
      }),
    ).rejects.toThrow(message);
  });

  it("fails closed on a malformed cancelled-return RPC response", async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      confirmCancelledOrderReturn("order_1", {
        expectedUpdatedAt: "2026-07-09T10:00:00.000Z",
        idempotencyKey: "00000000-0000-4000-8000-000000000604",
        operator: actor("owner"),
      }),
    ).rejects.toThrow("数据库返回无效");
  });
});

describe("order repository terminal operation RPCs", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
  });

  const recorded = {
    ok: true,
    code: "recorded",
    operation_id: "00000000-0000-4000-8000-000000000801",
    order_id: "order_1",
    status: "completed",
    record_state: "active",
    updated_at: "2026-07-16T20:01:00.000Z",
  };

  it("sends a manager correction through the atomic RPC", async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: recorded, error: null });

    await expect(
      correctTerminalOrder(
        "order_1",
        {
          expected_updated_at: "2026-07-16T20:00:00.000Z",
          idempotency_key: "00000000-0000-4000-8000-000000000802",
          reason: " 修正诊断记录 ",
          changes: { diagnosis_result: "已更换屏幕" },
        },
        actor("manager"),
      ),
    ).resolves.toMatchObject({ ok: true, code: "recorded", replayed: false });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("repairdesk_correct_terminal_order", {
      p_store_id: "store_1",
      p_order_id: "order_1",
      p_actor_id: "staff_manager",
      p_expected_updated_at: "2026-07-16T20:00:00.000Z",
      p_idempotency_key: "00000000-0000-4000-8000-000000000802",
      p_changes: { diagnosis_result: "已更换屏幕" },
      p_reason: "修正诊断记录",
    });
  });

  it("maps stale reopen responses to a conflict error", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: { ok: false, code: "stale_version" },
      error: null,
    });

    await expect(
      reopenOrder(
        "order_1",
        {
          expected_updated_at: "2026-07-16T20:00:00.000Z",
          idempotency_key: "00000000-0000-4000-8000-000000000803",
          reason: "重新进入检测流程",
          to_status: "diagnosing",
        },
        actor("manager"),
      ),
    ).rejects.toMatchObject({ code: "STALE_VERSION", status: 409 });
  });

  it("returns an idempotent Owner void replay and preserves confirmation", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: { ...recorded, code: "idempotent_replay", record_state: "voided" },
      error: null,
    });

    await expect(
      voidOrder(
        "order_1",
        {
          expected_updated_at: "2026-07-16T20:00:00.000Z",
          idempotency_key: "00000000-0000-4000-8000-000000000804",
          reason: "重复录入需安全作废",
          confirm_public_no: " R2026001 ",
        },
        actor("owner"),
      ),
    ).resolves.toMatchObject({ code: "idempotent_replay", replayed: true, record_state: "voided" });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "repairdesk_void_order",
      expect.objectContaining({ p_confirm_public_no: "R2026001", p_actor_id: "staff_owner" }),
    );
  });

  it("fails closed on an invalid terminal RPC response", async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      correctTerminalOrder(
        "order_1",
        {
          expected_updated_at: "2026-07-16T20:00:00.000Z",
          idempotency_key: "00000000-0000-4000-8000-000000000805",
          reason: "修正诊断记录",
          changes: { diagnosis_result: "已更换屏幕" },
        },
        actor("manager"),
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 500 });
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
    device_custody_status: overrides.device_custody_status ?? "with_shop",
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
    device_custody_status: "with_shop",
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
    is: vi.fn(() => query),
    not: vi.fn(() => query),
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
