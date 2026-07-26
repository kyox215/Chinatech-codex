import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertInventoryV2AtomicSaleReadiness,
  completeInventorySaleV2,
} from "./inventory-v2-sale.repository";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn() }));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: mocks.maybeSingle }),
        }),
      }),
    }),
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

describe("completeInventorySaleV2", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.maybeSingle.mockReset();
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
