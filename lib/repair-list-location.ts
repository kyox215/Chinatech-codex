import {repairListQuery,type RepairListQuery} from "./backend/repair-list-contract";
const fields=["q","status","view","partsFilter","noticeFilter","groupBy","sort"];
export function repairListLocation(query:RepairListQuery,group="",anchor="",offset=0) {
 const params=new URLSearchParams(query);if(group)params.set("group",group);if(anchor&&anchor.length<=100)params.set("anchor",anchor);
 if(Number.isFinite(offset))params.set("offset",String(Math.max(-2000,Math.min(2000,Math.round(offset)))));
 return "/app/repairs?"+params;
}
export function safeRepairListLocation(raw:string|null) {
 try{if(!raw||raw.length>4000)return "/app/repairs";const url=new URL(raw,"https://local.invalid");if(url.origin!=="https://local.invalid"||url.pathname!=="/app/repairs"||[...url.searchParams.keys()].some(key=>![...fields,"group","anchor","offset"].includes(key)))return "/app/repairs";
 const query=repairListQuery(Object.fromEntries([...url.searchParams].filter(([key])=>fields.includes(key)))),group=url.searchParams.get("group")??"",anchor=url.searchParams.get("anchor")??"";
 if(group&&!["all","history","rework","processing","purchase","ready","draft","cart","mixed","ordered","complete","unrecorded"].includes(group)||anchor.length>100)return "/app/repairs";
 return repairListLocation(query,group,anchor,Number(url.searchParams.get("offset")??0));}catch{return "/app/repairs";}
}
let position:{scope:string;id:string;location:string}|null=null,bound=false;
export function rememberRepairListPosition(scope:string,id:string,location:string){position={scope,id,location:safeRepairListLocation(location)};}
export function repairListReturnPosition(scope:string,id:string){return position?.scope===scope&&position.id===id?position.location:null;}
export function bindRepairListPosition(readScope:()=>string|null,subscribe:(listener:()=>void)=>()=>void){if(bound||typeof window==="undefined")return;bound=true;subscribe(()=>{if(position&&position.scope!==readScope())position=null;});}
