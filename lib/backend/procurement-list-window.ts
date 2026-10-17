import { procurementCursor, type ProcurementListPage } from "./procurement-list-contract";
import { backendScopeKey } from "./read-plan";
import {mergeSummaryBatches} from "./summary-window";
/** A window contains at most ten actual responses, including smaller UTF8
 * budget pages. Internal numeric boundaries never contain canonical records. */
export function mergeProcurementWindow(current: ProcurementListPage, incoming: ProcurementListPage, direction: "before"|"after"): ProcurementListPage {
  if (current.formatVersion!==incoming.formatVersion||current.stateToken !== incoming.stateToken || backendScopeKey(current.scope) !== backendScopeKey(incoming.scope) || JSON.stringify(current.query) !== JSON.stringify(incoming.query)) throw new Error("资料已更新，请刷新后重试。");
  const window=mergeSummaryBatches(current,incoming,direction),{items,startIndex}=window;
  const first=items[0],last=items.at(-1);
  return {...incoming,...window,previousCursor:startIndex>0&&first?procurementCursor(incoming.stateToken,first,"before"):null,nextCursor:startIndex+items.length<incoming.total&&last?procurementCursor(incoming.stateToken,last,"after"):null};
}
