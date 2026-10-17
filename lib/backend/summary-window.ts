export type SummaryWindow<T>={items:T[];startIndex:number;windowBatches?:{startIndex:number;size:number}[];windowExtent?:number};
/** Numeric placement and ten actual response boundaries only. No canonical
 * records, draft ownership, permissions or domain cursor rules belong here. */
export function mergeSummaryBatches<T extends{id:string}>(current:SummaryWindow<T>,incoming:SummaryWindow<T>,direction:"before"|"after"):SummaryWindow<T>{
 const previous=current.windowBatches??[{startIndex:current.startIndex,size:current.items.length}],batch={startIndex:incoming.startIndex,size:incoming.items.length};
 const batches=(direction==="before"?[batch,...previous]:[...previous,batch]).filter((page,index,all)=>page.size>0&&all.findIndex(other=>other.startIndex===page.startIndex&&other.size===page.size)===index),retained=direction==="before"?batches.slice(0,10):batches.slice(-10);
 const startIndex=retained.length?Math.min(...retained.map(page=>page.startIndex)):incoming.startIndex,end=retained.length?Math.max(...retained.map(page=>page.startIndex+page.size)):startIndex;
 const combined=[...new Map((direction==="before"?[...incoming.items,...current.items]:[...current.items,...incoming.items]).map(row=>[row.id,row])).values()],combinedStart=direction==="before"?incoming.startIndex:current.startIndex;
 return{items:combined.slice(startIndex-combinedStart,end-combinedStart),startIndex,windowBatches:retained,windowExtent:Math.max(current.windowExtent??current.startIndex+current.items.length,incoming.startIndex+incoming.items.length)};
}
