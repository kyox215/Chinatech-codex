import { describe, expect, it } from "vitest";

import { CACHE_TIMES } from "@/lib/query-performance";

import { ordersKeys } from "./query-keys";
import { orderListPageQueryOptions, orderOptionsQueryOptions } from "./query-options";

describe("order query options", () => {
  it("keys list pages independently from stable order options", () => {
    const input = { queueGroups: ["ordered" as const], page: 2, pageSize: 50 };
    const page = orderListPageQueryOptions(input, "store_1");
    const options = orderOptionsQueryOptions("store_1");

    expect(page.queryKey).toEqual(ordersKeys.page({ queueGroups: ["ordered"] }, 2, 50, "store_1"));
    expect(page.staleTime).toBe(CACHE_TIMES.hotList);
    expect(options.queryKey).toEqual(ordersKeys.options("store_1"));
    expect(options.staleTime).toBe(CACHE_TIMES.options);
  });
});
