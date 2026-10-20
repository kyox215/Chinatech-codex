import {repairCursor,repairReadVersionRelation,type RepairReadVersion,type RepairListPage,type RepairListSummary} from "./repair-list-contract";
export type RepairCachedPage={group:string;items:RepairListSummary[];startIndex:number;used:number};
export type RepairWindowCache={token:string;version:RepairReadVersion|null;pages:RepairCachedPage[];heads:Record<string,number>;extents:Record<string,number>};
export function emptyRepairWindowCache(token=""):RepairWindowCache{return{token,version:null,pages:[],heads:{},extents:{}};}
/** Ten bounded responses shared across ALL groups. An already focused page can
 * remain in the cache; it still consumes one of those ten slots. */
export function acceptRepairWindow(current:RepairWindowCache,page:RepairListPage,pinnedId?:string):RepairWindowCache {
 const relation=current.version?repairReadVersionRelation(current.version,page):"newer";if(relation==="stale"||relation==="inconsistent")return current;
 const same=current.token===page.stateToken,version={generation:page.generation,stateToken:page.stateToken,observedRevision:same&&current.version&&BigInt(current.version.observedRevision)>BigInt(page.observedRevision)?current.version.observedRevision:page.observedRevision},cache=same?{...current,version}:{...emptyRepairWindowCache(page.stateToken),version,extents:current.extents};
 if(!page.group||!page.items.length)return cache;
 const group=page.group,end=page.startIndex+page.items.length;
 let pages=cache.pages.filter(value=>value.group!==group||value.startIndex+value.items.length<=page.startIndex||value.startIndex>=end);
 pages.push({group,items:page.items,startIndex:page.startIndex,used:Math.max(0,...pages.map(value=>value.used))+1});
 while(pages.length>10||pages.reduce((sum,value)=>sum+value.items.length,0)>500){
  const candidates=pages.filter(value=>!pinnedId||!value.items.some(row=>row.id===pinnedId)).sort((a,b)=>a.used-b.used);
  const remove=candidates[0]??pages.toSorted((a,b)=>a.used-b.used)[0];pages=pages.filter(value=>value!==remove);
 }
 return{token:page.stateToken,version,pages,heads:{...cache.heads,[group]:page.startIndex},extents:{...cache.extents,[group]:Math.max(cache.extents[group]??0,end)}};
}
/** A multi-group refresh may await several reads. Preserve batches accepted by
 * other groups in that interval, with their latest heads and the same budget. */
export function mergeRepairWindows(built:RepairWindowCache,latest:RepairWindowCache,pinnedId?:string):RepairWindowCache {
 if(built.token!==latest.token||!built.version||!latest.version)return built;
 let pages=[...built.pages];
 for(const page of latest.pages.toSorted((a,b)=>a.used-b.used)){
  const end=page.startIndex+page.items.length;
  pages=pages.filter(value=>value.group!==page.group||value.startIndex+value.items.length<=page.startIndex||value.startIndex>=end);
  pages.push({...page,used:Math.max(0,...pages.map(value=>value.used))+1});
  while(pages.length>10||pages.reduce((sum,value)=>sum+value.items.length,0)>500){const candidates=pages.filter(value=>!pinnedId||!value.items.some(row=>row.id===pinnedId)).toSorted((a,b)=>a.used-b.used);const remove=candidates[0]??pages.toSorted((a,b)=>a.used-b.used)[0];pages=pages.filter(value=>value!==remove);}
 }
 const extents={...built.extents};for(const[group,value]of Object.entries(latest.extents))extents[group]=Math.max(extents[group]??0,value);
 return{...built,pages,heads:{...built.heads,...latest.heads},extents,version:{...built.version,observedRevision:BigInt(latest.version.observedRevision)>BigInt(built.version.observedRevision)?latest.version.observedRevision:built.version.observedRevision}};
}
export function repairGroupWindow(cache:RepairWindowCache,page:RepairListPage,group:string) {
 const count=page.groups.find(value=>value.key===group)?.visibleCount??0,extent=Math.min(count,cache.extents[group]??0),pages=cache.pages.filter(value=>value.group===group).sort((a,b)=>a.startIndex-b.startIndex);
 if(!pages.length)return{items:[] as RepairListSummary[],startIndex:extent,extent,hasMore:extent<count,nextCursor:null,previousCursor:null,version:cache.token};
 const chunks:{startIndex:number;items:RepairListSummary[]}[]=[];
 for(const value of pages){const previous=chunks.at(-1);if(previous&&previous.startIndex+previous.items.length===value.startIndex)previous.items.push(...value.items);else chunks.push({startIndex:value.startIndex,items:[...value.items]});}
 const head=cache.heads[group]??pages.at(-1)!.startIndex,selected=chunks.find(value=>head>=value.startIndex&&head<value.startIndex+value.items.length)??chunks.at(-1)!,{items,startIndex}=selected;
 return{items,startIndex,extent,hasMore:startIndex+items.length<count,previousCursor:startIndex&&items[0]?repairCursor(page.stateToken,group,items[0].id,"before"):null,nextCursor:startIndex+items.length<count&&items.at(-1)?repairCursor(page.stateToken,group,items.at(-1)!.id,"after"):null,version:cache.token};
}
