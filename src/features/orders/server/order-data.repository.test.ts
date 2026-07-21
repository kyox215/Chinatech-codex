import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import { OrderDataApplyRepositoryError } from "@/features/orders/model/order-data-errors";

import { applyImportBatch, listOrderDataBatchSummaries } from "./order-data.repository";

const storeId = "00000000-0000-0000-0000-000000000001";

describe("order data batch repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only store-scoped, numeric summary fields and resolves actor labels", async () => {
    const batchRows = Array.from({ length: 21 }, (_value, index) => ({
      id: `batch-${index + 1}`,
      store_id: storeId,
      actor_id: "actor-1",
      kind: "import",
      mode: "update_only",
      status: "previewed",
      summary: {
        total: 12,
        ready: "10",
        failed: -1,
        customer_name: "Mario Rossi",
        rows: [{ phone: "+39 333 123 4567" }],
        before: { issue_description: "private" },
      },
      created_at: "2026-07-13T08:00:00.000Z",
      previewed_at: "2026-07-13T08:01:00.000Z",
      applied_at: null,
      expires_at: "2026-07-14T08:00:00.000Z",
    }));
    const batchesQuery = fluentQuery({ data: batchRows, error: null }, "limit");
    const actorsQuery = fluentQuery(
      { data: [{ id: "actor-1", display_name: "Primary Owner" }], error: null },
      "in",
    );
    const from = vi.fn((table: string) => {
      if (table === "order_data_batches") return batchesQuery;
      if (table === "staff_profiles") return actorsQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.getSupabaseAdmin.mockReturnValue({ from });

    const result = await listOrderDataBatchSummaries({ storeId, limit: 20 });

    expect(result).toMatchObject({ hasMore: true });
    expect(result.items).toHaveLength(20);
    expect(batchesQuery.eq).toHaveBeenCalledWith("store_id", storeId);
    expect(batchesQuery.limit).toHaveBeenCalledWith(21);
    expect(result.items[0]).toMatchObject({
      storeId,
      actorDisplayName: "Primary Owner",
      summary: { total: 12, ready: 10 },
    });
    expect(result.items[0].summary).not.toHaveProperty("failed");
    expect(result.items[0].summary).not.toHaveProperty("customer_name");
    expect(result.items[0].summary).not.toHaveProperty("before");
    expect(result.items[0].summary.rows).toBeUndefined();
  });

  it("logs internal database details but exposes only the stable public error", async () => {
    const batchesQuery = fluentQuery(
      {
        data: null,
        error: { code: "42P01", message: "relation private_schema.secret_table is missing" },
      },
      "limit",
    );
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => batchesQuery) });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const error = await listOrderDataBatchSummaries({ storeId }).catch((caught: unknown) => caught);

    expect(error).toEqual(new Error("读取工单数据批次失败"));
    expect(String(error)).not.toContain("secret_table");
    expect(consoleError).toHaveBeenCalledWith(
      "[order-data] 读取工单数据批次失败",
      expect.objectContaining({ code: "42P01" }),
    );
    consoleError.mockRestore();
  });

  it("keeps allowlisted Apply recovery codes structured without exposing RPC details", async () => {
    const batchQuery = fluentQuery(
      { data: { template_version: "repairdesk-order-data-v2" }, error: null },
      "maybeSingle",
    );
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "batch_not_applicable: private schema and row details",
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => batchQuery), rpc });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const error = await applyImportBatch({
      batchId: "batch-1",
      storeId,
      actor: {
        id: "actor-1",
        displayName: "Owner",
        storeId,
        storeRole: "owner",
      },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OrderDataApplyRepositoryError);
    expect(error).toMatchObject({ code: "batch_not_applicable", message: "应用工单导入失败" });
    expect(String(error)).not.toContain("private schema");
    expect(rpc).toHaveBeenCalledWith(
      "repairdesk_apply_order_data_batch",
      expect.objectContaining({ p_batch_id: "batch-1", p_store_id: storeId }),
    );
    consoleError.mockRestore();
  });
});

function fluentQuery(result: unknown, terminal: "limit" | "in" | "maybeSingle") {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.maybeSingle.mockReturnValue(query);
  query[terminal].mockResolvedValue(result);
  return query;
}
