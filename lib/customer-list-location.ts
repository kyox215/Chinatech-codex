/** A return location contains only the search condition, row identity and pixel
 * offset. Every return still performs a fresh authorized bounded server read. */
export function customerListLocation(query: string, phone: string, offset = 0) {
  const params=new URLSearchParams();if(query)params.set("q",query.slice(0,160));
  if(/^\+[1-9]\d{6,14}$/.test(phone))params.set("anchor",phone);
  if(Number.isFinite(offset))params.set("offset",String(Math.max(-2000,Math.min(2000,Math.round(offset)))));
  return `/app/customers${params.size?"?"+params:""}`;
}
export function safeCustomerListLocation(raw: string|null) {
  if(!raw||raw.length>2000)return "/app/customers";
  try {const url=new URL(raw,"https://local.invalid");if(url.origin!=="https://local.invalid"||url.pathname!=="/app/customers"||[...url.searchParams.keys()].some(key=>!["q","anchor","offset"].includes(key)))return "/app/customers";return customerListLocation(url.searchParams.get("q")??"",url.searchParams.get("anchor")??"",Number(url.searchParams.get("offset")??0));}catch{return "/app/customers";}
}

let position: {scope:string;query:string;phone:string;offset:number}|null=null;
let bound=false;
export function rememberCustomerListPosition(scope:string,query:string,phone:string,offset:number) {
  if(typeof window==="undefined")return;
  position={scope,query:query.slice(0,160),phone,offset:Math.max(-2000,Math.min(2000,offset))};
}
export function customerListReturnPosition(scope:string,id:string) {
  if(typeof window==="undefined")return null;
  if(position?.scope!==scope)return null;
  return position&&id==="PHONE-"+position.phone.slice(1)?customerListLocation(position.query,position.phone,position.offset):null;
}
// One document-level listener contains no component closure or business records.
// It clears the single lightweight return location even after the list unmounts.
export function bindCustomerListPosition(readScope:()=>string|null,subscribe:(notify:()=>void)=>()=>void) {
  if(bound||typeof window==="undefined")return;
  bound=true;subscribe(()=>{if(position&&position.scope!==readScope())position=null;});
}
