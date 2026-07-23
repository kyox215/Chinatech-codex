import type { OrderListFilters, OrderQueueGroup } from "@/lib/repairdesk/types";

export const ORDER_LIST_ROUTE_STATE_TTL_MS = 30 * 60 * 1000;

const inMemoryRouteState = new Map<string, string>();
const orderRouteStatusGroups = new Set([
  "all",
  "processing",
  "ordered",
  "arrived",
  "arrived_notified",
  "repaired",
  "repaired_notified",
]);

export type OrderListRouteStateV1 = {
  version: 1;
  storeId: string;
  userId: string;
  savedAt: number;
  statusGroup: "all" | OrderQueueGroup;
  statusCode: string;
  filters: OrderListFilters;
  page: number;
  pageSize: number;
  scrollY: number;
  anchorOrderId?: string;
};

export function orderListRouteStateKey(storeId: string, userId: string) {
  return `repairdesk:orders:list-context:v1:${storeId}:${userId}`;
}

export function writeOrderListRouteState(
  storage: Pick<Storage, "setItem"> | undefined,
  state: OrderListRouteStateV1,
) {
  const key = orderListRouteStateKey(state.storeId, state.userId);
  const serialized = JSON.stringify(state);
  inMemoryRouteState.set(key, serialized);
  try {
    storage?.setItem(key, serialized);
  } catch {
    // Some embedded/private browser contexts can deny sessionStorage. The
    // identity-scoped in-memory copy still preserves same-tab navigation.
  }
}

export function readOrderListRouteState(
  storage: Pick<Storage, "getItem" | "removeItem"> | undefined,
  identity: { storeId: string; userId: string },
  now = Date.now(),
): OrderListRouteStateV1 | null {
  const key = orderListRouteStateKey(identity.storeId, identity.userId);
  let raw: string | null = null;
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    // Fall through to the same-tab copy.
  }
  raw ??= inMemoryRouteState.get(key) ?? null;
  if (!raw) return null;
  try {
    if (raw.length > 32_768) throw new Error("订单列表返回状态过大");
    const value = JSON.parse(raw) as Partial<OrderListRouteStateV1>;
    const valid =
      value.version === 1 &&
      value.storeId === identity.storeId &&
      value.userId === identity.userId &&
      Number.isFinite(value.savedAt) &&
      value.savedAt! <= now + 60_000 &&
      now >= value.savedAt! &&
      now - value.savedAt! <= ORDER_LIST_ROUTE_STATE_TTL_MS &&
      Number.isInteger(value.page) &&
      value.page! >= 1 &&
      value.page! <= 10_000 &&
      (value.pageSize === 20 || value.pageSize === 50) &&
      typeof value.statusGroup === "string" &&
      orderRouteStatusGroups.has(value.statusGroup) &&
      typeof value.statusCode === "string" &&
      value.statusCode.length <= 64 &&
      Number.isFinite(value.scrollY) &&
      value.scrollY! >= 0 &&
      value.scrollY! <= 10_000_000 &&
      (value.anchorOrderId === undefined ||
        (typeof value.anchorOrderId === "string" && value.anchorOrderId.length <= 128)) &&
      typeof value.filters === "object" &&
      value.filters !== null &&
      !Array.isArray(value.filters) &&
      JSON.stringify(value.filters).length <= 16_384;
    if (!valid) {
      inMemoryRouteState.delete(key);
      try {
        storage?.removeItem(key);
      } catch {
        // Storage cleanup is best effort only.
      }
      return null;
    }
    return value as OrderListRouteStateV1;
  } catch {
    inMemoryRouteState.delete(key);
    try {
      storage?.removeItem(key);
    } catch {
      // Storage cleanup is best effort only.
    }
    return null;
  }
}
