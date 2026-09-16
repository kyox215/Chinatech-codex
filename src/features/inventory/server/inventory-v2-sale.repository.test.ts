import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertInventoryV2AtomicSaleReadiness,
  completeInventorySaleV2,
} from "./inventory-v2-sale.repository";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  ledgerMaybeSingle: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      let projection = "";
      const filters: Record<string, unknown> = {};
      const query = {
        select: (columns: string) => {
          projection = columns;
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: () =>
          table === "inventory_sale_command_ledger"
            ? mocks.ledgerMaybeSingle({ projection, filters })
            : mocks.maybeSingle(),
      };
      return query;
    },
  }),
}));

vi.mock("./inventory-v2-access", () => ({
  assertInventoryV2SaleAccess: vi.fn(),
}));

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  storeId: "00000000-0000-4000-8000-000000000010",
  displayName: "Owner",
};

const input = {
  expected_updated_at: "2026-07-18T17:00:00.000Z",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  sale_price: 399,
  payment_amount: 399,
  payment_method: "card",
  sale_channel: "store",
  warranty_months: 12,
  warranty_snapshot: {
    version: "inventory-sale-v2-it-1",
    language: "it" as const,
    terms: ["Garanzia legale applicabile."],
  },
  fiscal_status: "pending" as const,
  sold_at: "2026-07-18T17:01:00.000Z",
};

const replayResponse = {
  ok: true,
  code: "idempotent_replay",
  sale_id: "sale-1",
  payment_id: "payment-1",
  item_id: "item-1",
  updated_at: "2026-07-18T17:01:00.000Z",
  fiscal_status: "pending",
};

const soldItem = {
  id: "item-1",
  updated_at: replayResponse.updated_at,
  status: "sold",
  legacy_payload: { inventory_v2_intake: true },
};

describe("completeInventorySaleV2", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.ledgerMaybeSingle.mockReset();
    mocks.ledgerMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "item-1",
        updated_at: input.expected_updated_at,
        status: "listed",
        legacy_payload: {},
      },
      error: null,
    });
  });

  it("injects store and actor from the authenticated context", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "completed",
        sale_id: "sale-1",
        payment_id: "payment-1",
        item_id: "item-1",
        updated_at: "2026-07-18T17:01:00.000Z",
        fiscal_status: "pending",
      },
      error: null,
    });

    await expect(completeInventorySaleV2("item-1", input, actor)).resolves.toMatchObject({
      code: "completed",
      sale_id: "sale-1",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_complete_inventory_sale_v2",
      expect.objectContaining({
        p_store_id: actor.storeId,
        p_actor_id: actor.id,
        p_item_id: "item-1",
      }),
    );
    expect(mocks.ledgerMaybeSingle).not.toHaveBeenCalled();
  });

  it("replays the original sale and payment after a committed response is lost", async () => {
    mocks.rpc
      .mockRejectedValueOnce(new Error("response lost after commit"))
      .mockResolvedValueOnce({ data: replayResponse, error: null });
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        ...soldItem,
        updated_at: input.expected_updated_at,
        status: "listed",
        serial_or_imei: "356938035643809",
        imei_check_status: "pass",
        activation_lock_status: "pass",
        data_wipe_status: "pass",
        functional_grade: "passed",
        cosmetic_grade: "good",
        list_price: 399,
      },
      error: null,
    });
    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.ledgerMaybeSingle).not.toHaveBeenCalled();

    mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });
    mocks.ledgerMaybeSingle.mockResolvedValue({ data: { id: "sale-1" }, error: null });
    await expect(completeInventorySaleV2("item-1", input, actor)).resolves.toEqual(replayResponse);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
    expect(mocks.ledgerMaybeSingle).toHaveBeenCalledWith({
      projection: "id",
      filters: {
        store_id: actor.storeId,
        inventory_item_id: "item-1",
        idempotency_key: input.idempotency_key,
        actor_id: actor.id,
      },
    });
  });

  it("keeps a stale version rejected when no completed ledger exists", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });

    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(/其他人更新/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["store_id", "actor_id", "inventory_item_id", "idempotency_key"] as const)(
    "cannot use a completed ledger with a different %s",
    async (mismatchedField) => {
      const ledger = {
        store_id: actor.storeId,
        actor_id: actor.id,
        inventory_item_id: "item-1",
        idempotency_key: input.idempotency_key,
        [mismatchedField]: "different-ledger-value",
      };
      mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });
      mocks.ledgerMaybeSingle.mockImplementation(
        ({ filters }: { filters: Record<string, unknown> }) => ({
          data: Object.entries(filters).every(
            ([key, value]) => ledger[key as keyof typeof ledger] === value,
          )
            ? { id: "sale-1" }
            : null,
          error: null,
        }),
      );

      await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(/其他人更新/);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("lets the RPC reject a changed payload under the original completed key", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });
    mocks.ledgerMaybeSingle.mockResolvedValue({ data: { id: "sale-1" }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "idempotency_conflict" }, error: null });

    await expect(
      completeInventorySaleV2("item-1", { ...input, sale_price: 400, payment_amount: 400 }, actor),
    ).rejects.toThrow(/已用于不同请求/);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_complete_inventory_sale_v2",
      expect.objectContaining({
        p_expected_updated_at: input.expected_updated_at,
        p_idempotency_key: input.idempotency_key,
        p_sale_price: 400,
        p_payment_amount: 400,
      }),
    );
  });

  it("still applies the RPC current-actor check before returning a replay", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });
    mocks.ledgerMaybeSingle.mockResolvedValue({ data: { id: "sale-1" }, error: null });
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "actor_forbidden" }, error: null });

    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(
      /没有确认库存销售/,
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not treat ledger existence or an incomplete replay response as success", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });
    mocks.ledgerMaybeSingle.mockResolvedValue({ data: { id: "sale-1" }, error: null });
    mocks.rpc.mockResolvedValue({
      data: { ok: true, code: "idempotent_replay", sale_id: "sale-1" },
      error: null,
    });

    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(/结果不完整/);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each(["response", "rejection"])("sanitizes a ledger dependency %s to 503", async (failure) => {
    mocks.maybeSingle.mockResolvedValue({ data: soldItem, error: null });
    if (failure === "response") {
      mocks.ledgerMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "SECRET ledger schema detail" },
      });
    } else {
      mocks.ledgerMaybeSingle.mockRejectedValue(new Error("SECRET ledger schema detail"));
    }

    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toMatchObject({
      status: 503,
      code: "INVENTORY_V2_DEPENDENCY_UNAVAILABLE",
      message: "库存销售重试服务暂时不可用",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves the first-sale intake inspection gate when there is no completed ledger", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        ...soldItem,
        updated_at: input.expected_updated_at,
        status: "listed",
        serial_or_imei: "356938035643809",
        imei_check_status: "unchecked",
      },
      error: null,
    });

    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(/IMEI/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed on an RPC business error or incomplete response", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "stale_version" }, error: null });
    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(/其他人更新/);

    mocks.rpc.mockResolvedValue({ data: { ok: true, code: "completed" }, error: null });
    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toThrow(/结果不完整/);
  });

  it("does not expose Supabase details when the dependency fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "SECRET database schema detail" },
    });
    await expect(completeInventorySaleV2("item-1", input, actor)).rejects.toMatchObject({
      code: "INVENTORY_V2_DEPENDENCY_UNAVAILABLE",
      status: 503,
      message: "确认库存销售服务暂时不可用",
    });
  });
});

describe("assertInventoryV2AtomicSaleReadiness", () => {
  const readyItem = {
    updated_at: input.expected_updated_at,
    status: "listed",
    legacy_payload: { inventory_v2_intake: true },
    serial_or_imei: "356938035643809",
    imei_check_status: "pass",
    activation_lock_status: "pass",
    data_wipe_status: "pass",
    functional_grade: "passed",
    cosmetic_grade: "good",
    list_price: 399,
  };

  it("accepts a fully inspected V2 phone", () => {
    expect(() => assertInventoryV2AtomicSaleReadiness(readyItem, input)).not.toThrow();
  });

  it.each([
    ["imei_check_status", "unchecked", /IMEI/],
    ["activation_lock_status", "fail", /账号锁/],
    ["data_wipe_status", "unchecked", /资料/],
    ["functional_grade", "untested", /功能检测/],
    ["cosmetic_grade", "unknown", /外观等级/],
    ["list_price", 0, /挂牌价/],
  ])("rejects an incomplete %s gate", (field, value, message) => {
    expect(() =>
      assertInventoryV2AtomicSaleReadiness({ ...readyItem, [field]: value }, input),
    ).toThrow(message);
  });

  it("rejects stale versions before the RPC", () => {
    expect(() =>
      assertInventoryV2AtomicSaleReadiness(
        { ...readyItem, updated_at: "2026-07-18T17:00:01.000Z" },
        input,
      ),
    ).toThrow(/其他人更新/);
  });
});
