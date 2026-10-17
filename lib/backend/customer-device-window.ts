import{backendScopeKey}from'./read-plan';
import{customerDeviceCursor,type CustomerDevicePage}from'./customer-device-contract';
import{mergeSummaryBatches}from'./summary-window';
export function mergeCustomerDeviceWindow<T extends{id:string}>(current:CustomerDevicePage<T>,incoming:CustomerDevicePage<T>,direction:'before'|'after'):CustomerDevicePage<T>{
 if(current.formatVersion!==incoming.formatVersion||current.stateToken!==incoming.stateToken||backendScopeKey(current.scope)!==backendScopeKey(incoming.scope)||JSON.stringify(current.query)!==JSON.stringify(incoming.query))throw new Error('资料已更新，请刷新后重试。');
 const window=mergeSummaryBatches(current,incoming,direction),first=window.items[0],last=window.items.at(-1);
 return{...incoming,...window,previousCursor:window.startIndex>0&&first?customerDeviceCursor(incoming.stateToken,first.id,'before'):null,nextCursor:window.startIndex+window.items.length<incoming.total&&last?customerDeviceCursor(incoming.stateToken,last.id,'after'):null};
}
