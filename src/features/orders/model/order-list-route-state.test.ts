import { describe, expect, it } from "vitest";

import {
  ORDER_LIST_ROUTE_STATE_TTL_MS,
  orderListRouteStateKey,
  readOrderListRouteState,
  writeOrderListRouteState,
  type OrderListRouteStateV1,
} from "./order-list-route-state";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

const state: OrderListRouteStateV1 = {
  version: 1,
  storeId: "store-1",
  userId: "user-1",
  savedAt: 1_000,
  statusGroup: "ordered",
  statusCode: "all",
  filters: { search: "+39 333 5719865", searchScope: "current" },
  page: 2,
  pageSize: 20,
  scrollY: 480,
  anchorOrderId: "order-9",
};

describe("order list route state", () => {
  it("restores scoped state without putting customer search data in the URL", () => {
    const storage = memoryStorage();
    writeOrderListRouteState(storage, state);
    expect(
      readOrderListRouteState(storage, { storeId: "store-1", userId: "user-1" }, 1_001),
    ).toEqual(state);
  });

  it("rejects expired, damaged and cross-identity state", () => {
    const storage = memoryStorage();
    writeOrderListRouteState(storage, state);
    expect(
      readOrderListRouteState(storage, { storeId: "store-2", userId: "user-1" }, 1_001),
    ).toBeNull();
    expect(
      readOrderListRouteState(
        storage,
        { storeId: "store-1", userId: "user-1" },
        state.savedAt + ORDER_LIST_ROUTE_STATE_TTL_MS + 1,
      ),
    ).toBeNull();

    writeOrderListRouteState(storage, { ...state, page: -1, scrollY: -20 });
    expect(
      readOrderListRouteState(storage, { storeId: "store-1", userId: "user-1" }, 1_001),
    ).toBeNull();
  });

  it("keeps same-tab navigation recoverable when sessionStorage is unavailable", () => {
    const privateState: OrderListRouteStateV1 = {
      ...state,
      userId: "offline-private-user",
      filters: { search: "R2026123", searchScope: "current" },
    };

    writeOrderListRouteState(undefined, privateState);

    expect(
      readOrderListRouteState(
        undefined,
        {
          storeId: privateState.storeId,
          userId: privateState.userId,
        },
        1_001,
      ),
    ).toEqual(privateState);
  });

  it("never persists or restores a customer status bearer as an order search", () => {
    const storage = memoryStorage();
    const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
    const legacyToken = "L".repeat(43);

    for (const search of [`https://www.chinatech.in/r#${token}`, token, legacyToken]) {
      const leakedState: OrderListRouteStateV1 = {
        ...state,
        filters: { search, searchScope: "current" },
      };

      const safeState = writeOrderListRouteState(storage, leakedState);
      const restored = readOrderListRouteState(
        storage,
        { storeId: "store-1", userId: "user-1" },
        1_001,
      );

      expect(safeState.filters.search).toBeUndefined();
      expect(restored?.filters.search).toBeUndefined();
      expect(restored?.page).toBe(1);
      expect(storage.getItem(orderListRouteStateKey("store-1", "user-1"))).not.toContain(search);
    }
  });
});
