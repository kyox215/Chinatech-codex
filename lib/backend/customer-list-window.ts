import { customerCursor, type CustomerListPage } from "./customer-list-contract";
import { backendScopeKey } from "./read-plan";
import {mergeSummaryBatches} from "./summary-window";
/** A window contains at most ten actual responses from one authorized generation. */
export function mergeCustomerWindow(current: CustomerListPage, incoming: CustomerListPage, direction: "before"|"after"): CustomerListPage {
  if (current.formatVersion!==incoming.formatVersion||current.stateToken !== incoming.stateToken || backendScopeKey(current.scope) !== backendScopeKey(incoming.scope) || JSON.stringify(current.query) !== JSON.stringify(incoming.query)) throw new Error("资料已更新，请刷新后重试。");
  const window=mergeSummaryBatches(current,incoming,direction),{items,startIndex}=window;
  const first=items[0],last=items.at(-1);
  return {...incoming,...window,previousCursor:startIndex>0&&first?customerCursor(incoming.stateToken,first,"before"):null,nextCursor:startIndex+items.length<incoming.total&&last?customerCursor(incoming.stateToken,last,"after"):null};
}
