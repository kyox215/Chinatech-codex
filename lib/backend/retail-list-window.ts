import{backendScopeKey}from'./read-plan';
import{retailListCursor,type RetailListPage}from'./retail-list-contract';
import{mergeSummaryBatches}from'./summary-window';
export function mergeRetailWindow(current:RetailListPage,incoming:RetailListPage,direction:'before'|'after'):RetailListPage{
 if(current.formatVersion!==incoming.formatVersion||current.stateToken!==incoming.stateToken||backendScopeKey(current.scope)!==backendScopeKey(incoming.scope)||JSON.stringify(current.query)!==JSON.stringify(incoming.query))throw new Error('资料已更新，请刷新后重试。');
 // A history row and an independent unit can share the same external ID.
 // Their source-qualified key remains the list identity; neither is swallowed.
 const window=mergeSummaryBatches(current,incoming,direction,row=>row.key),first=window.items[0],last=window.items.at(-1);
 return{...incoming,...window,previousCursor:window.startIndex>0&&first?retailListCursor(incoming.stateToken,first.key,'before'):null,nextCursor:window.startIndex+window.items.length<incoming.total&&last?retailListCursor(incoming.stateToken,last.key,'after'):null};
}
