import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchInventoryRows,
  fetchInventoryTransactionSummaries,
  isInventoryAttachmentStorageScoped,
} from "@/features/inventory/server/inventory.repository";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

const scopedInventoryAttachment = {
  store_id: "store_1",
  item_id: "item_1",
  storage_bucket: "repairdesk-inventory-attachments",
  storage_path: "store_1/item_1/photo.jpg",
};

describe("inventory repository tenant storage boundaries", () => {
  it("allows signing only for the active store and inventory item path", () => {
    expect(isInventoryAttachmentStorageScoped(scopedInventoryAttachment, "store_1", "item_1")).toBe(
      true,
    );
  });

  it("rejects attachment metadata pointing to another store path", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_path: "store_2/item_1/photo.jpg",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
  });

  it("rejects attachment metadata for another inventory item or bucket", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          item_id: "item_2",
          storage_path: "store_1/item_2/photo.jpg",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_bucket: "public",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
  });
});

describe("inventory repository pagination", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
  });

  it("reads filtered inventory rows beyond the first 1000 with a stable tie-breaker", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `item_${index}` }));
    const firstQuery = createSupabaseQuery({ data: firstPage, error: null });
    const secondQuery = createSupabaseQuery({ data: [{ id: "item_1000" }], error: null });
    mocks.supabase.from.mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery);

    const rows = await fetchInventoryRows("store_1", {
      statuses: ["listed"],
      sourceTypes: ["trade_in"],
      categories: ["phone"],
    });

    expect(rows).toHaveLength(1001);
    expect(firstQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(firstQuery.in).toHaveBeenCalledWith("status", ["listed"]);
    expect(firstQuery.in).toHaveBeenCalledWith("source_type", ["trade_in"]);
    expect(firstQuery.in).toHaveBeenCalledWith("category", ["phone"]);
    expect(firstQuery.order).toHaveBeenNthCalledWith(1, "updated_at", { ascending: false });
    expect(firstQuery.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(firstQuery.range).toHaveBeenCalledWith(0, 999);
    expect(secondQuery.range).toHaveBeenCalledWith(1000, 1999);
  });

  it("reads more than 1000 transaction rows before calculating item profit", async () => {
    const firstPage = Array.from({ length: 1000 }, () => ({
      item_id: "item_1",
      transaction_type: "repair_cost",
      amount: 1,
    }));
    const firstQuery = createSupabaseQuery({ data: firstPage, error: null });
    const secondQuery = createSupabaseQuery({
      data: [{ item_id: "item_1", transaction_type: "repair_cost", amount: 2 }],
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery);

    const result = await fetchInventoryTransactionSummaries("store_1", ["item_1"]);

    expect(result.get("item_1")).toHaveLength(1001);
    expect(firstQuery.in).toHaveBeenCalledWith("item_id", ["item_1"]);
    expect(firstQuery.range).toHaveBeenCalledWith(0, 999);
    expect(secondQuery.range).toHaveBeenCalledWith(1000, 1999);
  });
});

function createSupabaseQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => result),
  };
  return query;
}
