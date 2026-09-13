import type {
  InventoryLifecycleProjectionStatus,
  InventoryProductListFilters,
} from "@/lib/repairdesk/types";
import type { InventorySalesListInput } from "../../sales/model/contracts";

export type InventoryListReturnScope = {
  storeId: string;
  userId: string;
  authorityFingerprint: string;
};

export type InventoryListReturnState = {
  search: string;
  filters: InventoryProductListFilters;
  lifecycleStatuses: InventoryLifecycleProjectionStatus[];
  salesQueue: InventorySalesListInput["queue"];
  salesOffset: number;
  scrollY: number;
};

const returnStateTtl = 30 * 60 * 1000;
let pendingReturn:
  | { scope: InventoryListReturnScope; state: InventoryListReturnState; savedAt: number }
  | undefined;

// A single same-tab, one-use return checkpoint. Search never enters a URL,
// localStorage or sessionStorage, and no product draft is stored here.
export function saveInventoryListReturnState(
  scope: InventoryListReturnScope,
  state: InventoryListReturnState,
  now = Date.now(),
) {
  pendingReturn = { scope: { ...scope }, state: structuredClone(state), savedAt: now };
}

export function takeInventoryListReturnState(scope: InventoryListReturnScope, now = Date.now()) {
  const saved = pendingReturn;
  pendingReturn = undefined;
  if (
    !saved ||
    saved.scope.storeId !== scope.storeId ||
    saved.scope.userId !== scope.userId ||
    saved.scope.authorityFingerprint !== scope.authorityFingerprint ||
    now < saved.savedAt ||
    now - saved.savedAt > returnStateTtl
  ) {
    return undefined;
  }
  return saved.state;
}
