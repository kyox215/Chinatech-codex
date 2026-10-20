import {procurementListQuery,type ProcurementListQuery} from "./backend/procurement-list-contract";
export function procurementListLocation(query:ProcurementListQuery,anchor="",offset=0) {
 const params=new URLSearchParams(query);if(anchor&&anchor.length<=100)params.set("anchor",anchor);
 if(Number.isFinite(offset))params.set("offset",String(Math.max(-2000,Math.min(2000,Math.round(offset)))));
 return "/app/procurement?"+params;
}
export function safeProcurementListLocation(raw:string|null) {
 try{if(!raw||raw.length>3000)return "/app/procurement";const url=new URL(raw,"https://local.invalid");if(url.origin!=="https://local.invalid"||url.pathname!=="/app/procurement"||[...url.searchParams.keys()].some(key=>!["q","filter","repairId","groupBy","anchor","offset"].includes(key)))return "/app/procurement";
 const query=procurementListQuery(Object.fromEntries([...url.searchParams].filter(([key])=>!["anchor","offset"].includes(key))));return procurementListLocation(query,url.searchParams.get("anchor")??"",Number(url.searchParams.get("offset")??0));}catch{return "/app/procurement";}
}
let position:{scope:string;id:string;location:string}|null=null,bound=false;
export function rememberProcurementListPosition(scope:string,id:string,location:string){position={scope,id,location:safeProcurementListLocation(location)};}
export function procurementListReturnPosition(scope:string,id:string){return position?.scope===scope&&position.id===id?position.location:null;}
export function bindProcurementListPosition(readScope:()=>string|null,subscribe:(notify:()=>void)=>()=>void){if(bound||typeof window==="undefined")return;bound=true;subscribe(()=>{if(position&&position.scope!==readScope())position=null;});}
