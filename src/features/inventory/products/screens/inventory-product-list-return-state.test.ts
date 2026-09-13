import { describe, expect, it } from "vitest";
import {
  saveInventoryListReturnState,
  takeInventoryListReturnState,
} from "./inventory-product-list-return-state";

const scope = {
  storeId: "synthetic-store",
  userId: "synthetic-user",
  authorityFingerprint: "scope-v1",
};
const state = {
  search: "SYNTHETIC-IMEI-SEARCH",
  filters: { brands: ["Synthetic"] },
  lifecycleStatuses: [],
  salesQueue: "all" as const,
  salesOffset: 30,
  scrollY: 620,
};

describe("inventory list return checkpoint", () => {
  it("restores a detached one-use same-tab snapshot", () => {
    saveInventoryListReturnState(scope, state, 100);
    const result = takeInventoryListReturnState(scope, 200);
    expect(result).toEqual(state);
    expect(result?.filters).not.toBe(state.filters);
    expect(takeInventoryListReturnState(scope, 201)).toBeUndefined();
  });
  it("rejects another store, user, authority or an expired checkpoint", () => {
    for (const other of [
      { ...scope, storeId: "other" },
      { ...scope, userId: "other" },
      { ...scope, authorityFingerprint: "changed" },
    ]) {
      saveInventoryListReturnState(scope, state, 100);
      expect(takeInventoryListReturnState(other, 200)).toBeUndefined();
      expect(takeInventoryListReturnState(scope, 201)).toBeUndefined();
    }
    saveInventoryListReturnState(scope, state, 100);
    expect(takeInventoryListReturnState(scope, 100 + 30 * 60 * 1000 + 1)).toBeUndefined();
  });
});
