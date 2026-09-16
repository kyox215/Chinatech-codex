import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCustomerDetail } from "./customer.repository";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));

const actor = {
  id: "owner",
  displayName: "Synthetic owner",
  storeId: "current-store",
  storeRole: "owner" as const,
};
function arrange(error: { code: string; message: string } | null) {
  const scopedQueries: Array<{ table: string; filters: unknown[][] }> = [];
  mocks.from.mockImplementation((table: string) => {
    const filters: unknown[][] = [];
    scopedQueries.push({ table, filters });
    const result = Promise.resolve({
      data: table === "customers" ? null : [],
      error: table === "customers" ? error : null,
    });
    const query: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "neq",
      "is",
      "not",
      "in",
      "order",
      "range",
      "limit",
      "single",
      "maybeSingle",
    ]) {
      query[method] = (...args: unknown[]) => {
        if (method === "eq") filters.push(args);
        return query;
      };
    }
    query.then = result.then.bind(result);
    return query;
  });
  return scopedQueries;
}

describe("customer detail missing records", () => {
  beforeEach(() => mocks.from.mockReset());

  it.each([null, { code: "PGRST116", message: "The result contains 0 rows" }])(
    "returns the same safe 404 for an absent or foreign-store record (%j)",
    async (error) => {
      const queries = arrange(error);
      await expect(getCustomerDetail("foreign-or-missing-id", actor)).rejects.toMatchObject({
        status: 404,
        code: "CUSTOMER_ENTITY_NOT_FOUND",
        message: "客户不存在",
      });
      expect(queries.find(({ table }) => table === "customers")?.filters).toEqual([
        ["store_id", "current-store"],
        ["id", "foreign-or-missing-id"],
      ]);
    },
  );

  it("does not disguise a database failure as a missing customer", async () => {
    arrange({ code: "57014", message: "query timeout" });
    await expect(getCustomerDetail("id", actor)).rejects.toThrow("读取客户详情失败: query timeout");
  });
});
