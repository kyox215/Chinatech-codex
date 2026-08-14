import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import { escapeIlikePattern, searchInventoryCatalog } from "./inventory-catalog.repository";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin }));

const actor = { displayName: "Tester", storeId: "store-a" } as AuditActor;

function setupQuery(data: unknown, error: { message: string } | null = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data, error });
  getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

describe("searchInventoryCatalog", () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReset();
  });

  it("derives the store from the actor, applies active/category bounds, and minimizes output", async () => {
    const query = setupQuery([
      {
        id: "secret-id",
        store_id: "other-store",
        category: "phone",
        brand: "Apple",
        model: "iPhone 17",
        cost_amount: 999,
      },
      { category: "phone", brand: "Apple", model: "iPhone 17" },
      { category: "phone", brand: "Apple", model: "iPhone 16" },
    ]);

    const result = await searchInventoryCatalog({ category: "phone", limit: 2 }, actor);

    expect(query.eq).toHaveBeenNthCalledWith(1, "store_id", "store-a");
    expect(query.eq).toHaveBeenNthCalledWith(2, "active", true);
    expect(query.eq).toHaveBeenNthCalledWith(3, "category", "phone");
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(result).toEqual({
      items: [
        { category: "phone", brand: "Apple", model: "iPhone 17", source: "learned" },
        { category: "phone", brand: "Apple", model: "iPhone 16", source: "learned" },
      ],
    });
    expect(result.items[0]).not.toHaveProperty("id");
    expect(result.items[0]).not.toHaveProperty("cost_amount");
  });

  it("filters optional brand/query safely and deduplicates normalized rows", async () => {
    const query = setupQuery([
      { category: "phone", brand: "Apple", model: "iPhone 17" },
      { category: "phone", brand: "apple", model: "iPhone 17" },
      { category: "phone", brand: "Apple", model: "iPhone 16" },
      { category: "phone", brand: "Samsung", model: "Galaxy S25" },
    ]);

    await expect(
      searchInventoryCatalog({ category: "phone", brand: " APPLE ", query: "17" }, actor),
    ).resolves.toEqual({
      items: [{ category: "phone", brand: "Apple", model: "iPhone 17", source: "learned" }],
    });
    expect(query.ilike).toHaveBeenNthCalledWith(1, "brand", "APPLE");
    expect(query.ilike).toHaveBeenNthCalledWith(2, "model", "%17%");
    expect(query.ilike.mock.invocationCallOrder[0]).toBeLessThan(
      query.limit.mock.invocationCallOrder[0],
    );
  });

  it("applies a literal brand filter before the database row limit", async () => {
    const noise = Array.from({ length: 100 }, (_, index) => ({
      category: "phone",
      brand: "Other",
      model: `Noise ${index}`,
    }));
    const query = setupQuery([
      ...noise,
      { category: "phone", brand: "A%_\\B", model: "Target 17" },
    ]);

    await expect(
      searchInventoryCatalog({ category: "phone", brand: " A%_\\B ", query: "Target" }, actor),
    ).resolves.toEqual({
      items: [{ category: "phone", brand: "A%_\\B", model: "Target 17", source: "learned" }],
    });
    expect(query.ilike).toHaveBeenNthCalledWith(1, "brand", "A\\%\\_\\\\B");
    expect(query.ilike).toHaveBeenNthCalledWith(2, "model", "%Target%");
    expect(query.ilike.mock.invocationCallOrder[1]).toBeLessThan(
      query.limit.mock.invocationCallOrder[0],
    );
  });

  it("fails closed when actor store context or the read is unavailable", async () => {
    setupQuery([], { message: "database unavailable" });
    await expect(searchInventoryCatalog({ category: "phone" }, actor)).rejects.toThrow(
      "读取设备目录失败: database unavailable",
    );
    await expect(
      searchInventoryCatalog({ category: "phone" }, { displayName: "No store" } as AuditActor),
    ).rejects.toThrow("读取设备目录缺少店铺上下文");
  });

  it("keeps normal patterns plain and rejects PostgREST star aliases", () => {
    expect(escapeIlikePattern("Target")).toBe("Target");
    expect(escapeIlikePattern("Needle", true)).toBe("%Needle%");
    expect(escapeIlikePattern("A%_\\B")).toBe("A\\%\\_\\\\B");
    expect(() => escapeIlikePattern("Star*Brand")).toThrow("不支持通配符");
    expect(() => escapeIlikePattern("Model*Target", true)).toThrow("不支持通配符");
  });

  it("fails closed for direct star input before opening the repository", async () => {
    await expect(
      searchInventoryCatalog({ category: "phone", brand: "Star*Brand" }, actor),
    ).rejects.toThrow("不支持通配符");
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});
