import { describe, expect, it } from "vitest";

import { runInventoryV2Dependency } from "./inventory-v2-errors";

describe("inventory V2 dependency errors", () => {
  it("maps rejected dependencies to a stable public error", async () => {
    await expect(
      runInventoryV2Dependency(
        () => Promise.reject(new Error("SECRET thrown connection detail")),
        "库存服务暂时不可用",
      ),
    ).rejects.toMatchObject({
      code: "INVENTORY_V2_DEPENDENCY_UNAVAILABLE",
      status: 503,
      message: "库存服务暂时不可用",
    });
  });
});
