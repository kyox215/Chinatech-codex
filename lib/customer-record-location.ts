import type{CustomerRecordKind}from'./backend/customer-detail-contract';import{safeCustomerListLocation}from'./customer-list-location';
export function customerRecordLocation(id:string,kind:CustomerRecordKind,q='',anchor='',offset=0,returnTo?:string){
 const params=new URLSearchParams({records:kind});if(q&&q.length<=160)params.set('q',q);if(anchor&&anchor.length<=1024)params.set('anchor',anchor);if(anchor&&Number.isFinite(offset))params.set('offset',String(Math.max(-2000,Math.min(2000,Math.round(offset)))));if(returnTo)params.set('returnTo',safeCustomerListLocation(returnTo));return`/app/customers/${encodeURIComponent(id)}?${params}`;
}
export function safeCustomerRecordLocation(raw:string|null){
 if(!raw||raw.length>14000)return null;try{const url=new URL(raw,'https://local.invalid'),id=decodeURIComponent(url.pathname.slice('/app/customers/'.length)),kind=url.searchParams.get('records')??'repairs',q=url.searchParams.get('q')??'',anchor=url.searchParams.get('anchor')??'';if(url.origin!=='https://local.invalid'||url.hash||!/^\/app\/customers\/PHONE-[1-9]\d{6,14}$/.test(url.pathname)||!['repairs','sales','history'].includes(kind)||q.length>160||anchor.length>1024||[...url.searchParams.keys()].some(key=>!['records','q','anchor','offset','returnTo'].includes(key)))return null;return customerRecordLocation(id,kind as CustomerRecordKind,q,anchor,Number(url.searchParams.get('offset')??0),url.searchParams.get('returnTo')??undefined);}catch{return null;}
}
let position:{scope:string;targetPath:string;location:string}|null=null,bound=false;
export function rememberCustomerRecordPosition(scope:string,targetPath:string,location:string){const safe=safeCustomerRecordLocation(location);if(safe)position={scope,targetPath,location:safe};}
export function customerRecordReturnPosition(scope:string,targetPath:string){return position?.scope===scope&&position.targetPath===targetPath?position.location:null;}
export function bindCustomerRecordPosition(readScope:()=>string|null,subscribe:(notify:()=>void)=>()=>void){if(bound||typeof window==='undefined')return;bound=true;subscribe(()=>{if(position&&position.scope!==readScope())position=null;});}
