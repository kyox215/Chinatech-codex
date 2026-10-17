import {NextResponse} from "next/server";
import {BackendError} from "@/lib/backend/database";
import {backendRepairListsEnabled,getV2Access,loadRepairScanPage} from "@/lib/backend/page-state";
import {isSupabaseMode} from "@/lib/supabase/config";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const started=performance.now();let accessMs=0,readMs=0;
 const response=(value:unknown,status=200)=>{const body=JSON.stringify(value);return new NextResponse(body,{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store","Vary":"Cookie, x-ct-store-id","X-Content-Type-Options":"nosniff","X-CT-Body-Bytes":String(Buffer.byteLength(body)),"Server-Timing":`access;dur=${accessMs.toFixed(1)}, read;dur=${readMs.toFixed(1)}, total;dur=${(performance.now()-started).toFixed(1)}`}});};
 if(!isSupabaseMode()||!backendRepairListsEnabled())return response({message:"正式后台未启用。"},404);
 try{
  const url=new URL(request.url),params=url.searchParams;
  if([...params.keys()].some(key=>!["raw","cursor","seek"].includes(key))||!params.has("raw"))throw new BackendError("请求资料无效。",400);
  const seek=params.has("seek")?Number(params.get("seek")):undefined;
  if(seek!==undefined&&!/^\d+$/.test(params.get("seek")!))throw new BackendError("请求资料无效。",400);
  const beforeAccess=performance.now();let access;try{access=await getV2Access(request);}finally{accessMs=performance.now()-beforeAccess;}
  const beforeRead=performance.now();let page;try{page=await loadRepairScanPage(access,params.get("raw")!,new URL(process.env.APP_ORIGIN||request.url).origin,{cursor:params.get("cursor")??undefined,seek,expectedScope:request.headers.get("x-ct-read-scope")??undefined});}finally{readMs=performance.now()-beforeRead;}
  return response(page);
 }catch(error){return response({message:error instanceof BackendError?error.message:"后台暂时不可用，请稍后重试。",code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}
