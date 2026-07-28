import { describe, expect, it } from "vitest";

import { assertNewOrderExpectedStore } from "./new-order-store-session";

describe("new-order server store fence", () => {
  it("keeps old clients compatible and rejects a stale intake session", () => {
    expect(() => assertNewOrderExpectedStore(undefined, "store-b")).not.toThrow();
    expect(() => assertNewOrderExpectedStore("store-a", "store-a")).not.toThrow();
    expect(() => assertNewOrderExpectedStore("store-a", "store-b")).toThrow("店铺上下文已变化");
  });
});
