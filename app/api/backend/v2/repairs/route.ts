import {observeRoute} from "@/lib/backend/request-observation";
import {NextResponse} from "next/server";
import {BackendError} from "@/lib/backend/database";
import {backendRepairListsEnabled,getV2Access,loadRepairListPage} from "@/lib/backend/page-state";
import {repairListQuery,type RepairListQuery} from "@/lib/backend/repair-list-contract";
import {isSupabaseMode} from "@/lib/supabase/config";
export const dynamic="force-dynamic";
async function read(request:Request) {
 const started=performance.now();let accessMs=0,readMs=0;
 function response(value:unknown,status=200){const serializing=performance.now(),body=JSON.stringify(value);return new NextResponse(body,{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store","Vary":"Cookie, x-ct-store-id","X-Content-Type-Options":"nosniff","X-CT-Body-Bytes":String(Buffer.byteLength(body)),"Server-Timing":`access;dur=${accessMs.toFixed(1)}, read;dur=${readMs.toFixed(1)}, serialize;dur=${(performance.now()-serializing).toFixed(1)}, total;dur=${(performance.now()-started).toFixed(1)}`}});}
 if(!isSupabaseMode()||!backendRepairListsEnabled())return response({message:"正式后台未启用。"},404);
 try{
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(key=>!["q","status","view","partsFilter","noticeFilter","groupBy","sort","cursor","known","anchor","seek","group"].includes(key)))throw new BackendError("请求资料无效。",400);
  let query:RepairListQuery;try{query=repairListQuery(Object.fromEntries([...params].filter(([key])=>["q","status","view","partsFilter","noticeFilter","groupBy","sort"].includes(key))) as Partial<RepairListQuery>);}catch{throw new BackendError("请求资料无效。",400);}
  const seek=params.has("seek")?Number(params.get("seek")):undefined;if(seek!==undefined&&(!/^\d+$/.test(params.get("seek")!)||!Number.isSafeInteger(seek)||seek>1000000))throw new BackendError("请求资料无效。",400);
  const accessing=performance.now();let access;
  try{access=await getV2Access(request);}finally{accessMs=performance.now()-accessing;}
  const reading=performance.now();let value;
  try{value=await loadRepairListPage(access,query,{group:params.get("group")??undefined,cursor:params.get("cursor")??undefined,known:params.get("known")??undefined,anchor:params.get("anchor")??undefined,seek,expectedScope:request.headers.get("x-ct-read-scope")??undefined});}finally{readMs=performance.now()-reading;}
  return response(value);
 }catch(error){return response({message:error instanceof BackendError?error.message:"后台暂时不可用，请稍后重试。",code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}

export async function GET(request:Request){return observeRoute(request,read);}
