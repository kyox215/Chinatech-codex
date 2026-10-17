import { customerCursor, type CustomerListPage } from "./customer-list-contract";
import { backendScopeKey } from "./read-plan";
/** A window contains at most ten 50-row batches from one authorized generation. */
export function mergeCustomerWindow(current: CustomerListPage, incoming: CustomerListPage, direction: "before"|"after"): CustomerListPage {
  if (current.stateToken !== incoming.stateToken || backendScopeKey(current.scope) !== backendScopeKey(incoming.scope) || JSON.stringify(current.query) !== JSON.stringify(incoming.query)) throw new Error("资料已更新，请刷新后重试。");
  const combined = [...new Map((direction === "before" ? [...incoming.items,...current.items] : [...current.items,...incoming.items]).map(row=>[row.id,row])).values()];
  const dropped = Math.max(0,combined.length-500);
  const items = direction === "before" ? combined.slice(0,500) : combined.slice(-500);
  const startIndex = direction === "before" ? incoming.startIndex : current.startIndex + dropped;
  const first=items[0],last=items.at(-1);
  return {...incoming,items,startIndex,previousCursor:startIndex>0&&first?customerCursor(incoming.stateToken,first,"before"):null,nextCursor:startIndex+items.length<incoming.total&&last?customerCursor(incoming.stateToken,last,"after"):null};
}
