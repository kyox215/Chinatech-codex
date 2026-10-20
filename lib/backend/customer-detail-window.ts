import{backendScopeKey}from'./read-plan';import{customerRecordCursor,type CustomerDetailPage}from'./customer-detail-contract';import{mergeSummaryBatches}from'./summary-window';
export function mergeCustomerRecordWindow(current:CustomerDetailPage,incoming:CustomerDetailPage,direction:'before'|'after'):CustomerDetailPage{
 if(current.formatVersion!==incoming.formatVersion||current.stateToken!==incoming.stateToken||backendScopeKey(current.scope)!==backendScopeKey(incoming.scope)||JSON.stringify(current.query)!==JSON.stringify(incoming.query))throw new Error('资料已更新，请刷新后重试。');
 const window=mergeSummaryBatches(current,incoming,direction,row=>row.key),first=window.items[0],last=window.items.at(-1);return{...incoming,...window,previousCursor:window.startIndex>0&&first?customerRecordCursor(incoming.stateToken,first.key,'before'):null,nextCursor:window.startIndex+window.items.length<incoming.total&&last?customerRecordCursor(incoming.stateToken,last.key,'after'):null};
}
