export type CustomerListReturnScope = {
  storeId: string;
  userId: string;
  authorityFingerprint: string;
};
type CustomerListReturnState = CustomerListReturnScope & {
  customerId: string;
  href: string;
  scrollY: number;
};

// Same-tab, memory-only view context. It never contains an editor draft and is
// unavailable after reload, logout/store switch, or navigation to another entity.
let current:
  | (Omit<CustomerListReturnState, "href"> & { href: CustomerListHref; savedAt: number })
  | null = null;
const ttl = 10 * 60 * 1000;

export function saveCustomerListReturnState(state: CustomerListReturnState, now = Date.now()) {
  current = null;
  if (
    !state.storeId ||
    !state.userId ||
    !state.authorityFingerprint ||
    !state.customerId ||
    !isCustomerListHref(state.href)
  )
    return;
  current = { ...state, href: state.href, scrollY: Math.max(0, state.scrollY), savedAt: now };
}

export function readCustomerListReturnState(
  scope: CustomerListReturnScope,
  customerId?: string,
  now = Date.now(),
) {
  if (
    !current ||
    !scope.userId ||
    current.storeId !== scope.storeId ||
    current.userId !== scope.userId ||
    current.authorityFingerprint !== scope.authorityFingerprint ||
    now < current.savedAt ||
    now - current.savedAt > ttl
  ) {
    current = null;
    return null;
  }
  return !customerId || current.customerId === customerId ? current : null;
}

export function clearCustomerListReturnState() {
  current = null;
}
import { isCustomerListHref, type CustomerListHref } from "@/shared/config/entity-context-routes";
