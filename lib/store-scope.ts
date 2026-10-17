/** Explicit document scope. Cookie preference must never retarget a live tab. */
export function scopedStoreUrl(href:string,storeId:string|undefined|null){
 if(!storeId||!href.startsWith('/app/'))return href;
 const url=new URL(href,'http://scope.invalid');
 if(!url.searchParams.has('storeId'))url.searchParams.set('storeId',storeId);
 return url.pathname+url.search+url.hash;
}

/** A display/read epoch includes both membership revision and exact privileges. */
export function storeViewScope(snapshot:{storeId:string;staff:{currentId:string;members:{id:string;revision:number;permissions:readonly string[]}[]}}|null){
 if(!snapshot)return '';
 const member=snapshot.staff.members.find(row=>row.id===snapshot.staff.currentId);
 return JSON.stringify([snapshot.storeId,member?.id,member?.revision,[...(member?.permissions??[])].sort()]);
}
