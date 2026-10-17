import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend/database";
import { backendCustomerListsEnabled, getV2Access, loadCustomerListPage } from "@/lib/backend/page-state";
import { isSupabaseMode } from "@/lib/supabase/config";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const started=performance.now();
  function response(data:unknown,status=200) {const body=JSON.stringify(data);return new NextResponse(body,{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store","Vary":"Cookie, x-ct-store-id","X-Content-Type-Options":"nosniff","X-CT-Body-Bytes":String(Buffer.byteLength(body)),"Server-Timing":`total;dur=${(performance.now()-started).toFixed(1)}`}});}
  if(!isSupabaseMode() || !backendCustomerListsEnabled())return response({message:"正式后台未启用。"},404);
  try {
    const params=new URL(request.url).searchParams;
    if([...params.keys()].some(key=>!["q","cursor","known","mode","anchor","seek"].includes(key)))throw new BackendError("请求资料无效。",400);
    const q=params.get("q")??"";if(q.length>160)throw new BackendError("请求资料无效。",400);
    const mode=params.get("mode")??"directory";if(mode!=="directory"&&mode!=="phone"&&mode!=="exact")throw new BackendError("请求资料无效。",400);
    const seek=params.has("seek")?Number(params.get("seek")):undefined;if(seek!==undefined&&(!/^\d+$/.test(params.get("seek")!)||!Number.isSafeInteger(seek)||seek>1000000))throw new BackendError("请求资料无效。",400);
    const access=await getV2Access(request);
    return response(await loadCustomerListPage(access,q,params.get("cursor")??undefined,params.get("known")??undefined,request.headers.get("x-ct-read-scope")??undefined,mode,params.get("anchor")??undefined,seek));
  } catch(error) {return response({message:error instanceof BackendError?error.message:"后台暂时不可用，请稍后重试。",code:error instanceof BackendError?error.code:undefined},error instanceof BackendError?error.status:503);}
}
