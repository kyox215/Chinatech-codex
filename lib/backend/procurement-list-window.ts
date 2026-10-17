import { procurementCursor, type ProcurementListPage } from "./procurement-list-contract";
import { backendScopeKey } from "./read-plan";
/** A window contains at most ten actual responses, including smaller UTF8
 * budget pages. Internal numeric boundaries never contain canonical records. */
export function mergeProcurementWindow(current: ProcurementListPage, incoming: ProcurementListPage, direction: "before"|"after"): ProcurementListPage {
  if (current.formatVersion!==incoming.formatVersion||current.stateToken !== incoming.stateToken || backendScopeKey(current.scope) !== backendScopeKey(incoming.scope) || JSON.stringify(current.query) !== JSON.stringify(incoming.query)) throw new Error("资料已更新，请刷新后重试。");
  const previous=current.windowBatches??[{startIndex:current.startIndex,size:current.items.length}],batch={startIndex:incoming.startIndex,size:incoming.items.length};
  const batches=(direction==="before"?[batch,...previous]:[...previous,batch]).filter((page,index,all)=>page.size>0&&all.findIndex(other=>other.startIndex===page.startIndex&&other.size===page.size)===index);
  const retained=direction==="before"?batches.slice(0,10):batches.slice(-10);
  const startIndex=Math.min(...retained.map(page=>page.startIndex)),end=Math.max(...retained.map(page=>page.startIndex+page.size));
  const combined = [...new Map((direction === "before" ? [...incoming.items,...current.items] : [...current.items,...incoming.items]).map(row=>[row.id,row])).values()];
  const combinedStart=direction==="before"?incoming.startIndex:current.startIndex;
  const items=combined.slice(startIndex-combinedStart,end-combinedStart);
  const first=items[0],last=items.at(-1);
  return {...incoming,items,startIndex,windowBatches:retained,windowExtent:Math.max(current.windowExtent??current.startIndex+current.items.length,incoming.startIndex+incoming.items.length),previousCursor:startIndex>0&&first?procurementCursor(incoming.stateToken,first,"before"):null,nextCursor:startIndex+items.length<incoming.total&&last?procurementCursor(incoming.stateToken,last,"after"):null};
}
