import { NextResponse } from "next/server";
import { getAuthIdentity } from "@/lib/backend/context";
import { queryOperation, cancelOperation } from "@/lib/backend/commands";
import { BackendError } from "@/lib/backend/database";
import { isSupabaseMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!isSupabaseMode()) return NextResponse.json({message:"正式后台未启用。"},{status:404,headers});
  try {
    const params = new URL(request.url).searchParams;
    const result = await queryOperation(await getAuthIdentity(),params.get("storeId")??"",params.get("memberId")??"",params.get("requestId")??"");
    return NextResponse.json(result,{headers});
  } catch (error) {
    return NextResponse.json({message:error instanceof BackendError?error.message:"暂时无法核对提交结果。",code:error instanceof BackendError?error.code:undefined},{status:error instanceof BackendError?error.status:503,headers});
  }
}

export async function POST(request: Request) {
  const headers = {"Cache-Control":"private, no-store"};
  if(!isSupabaseMode()) return NextResponse.json({message:"正式后台未启用。"},{status:404,headers});
  try {
    const origin=process.env.APP_ORIGIN || (process.env.NODE_ENV!=="production"?new URL(request.url).origin:"");
    if(!origin || request.headers.get("origin")!==origin) throw new BackendError("请求来源无效。",403);
    if(!request.headers.get("content-type")?.startsWith("application/json"))throw new BackendError("请求格式无效。",415);
    const reader=request.body?.getReader();if(!reader)throw new BackendError("请求为空。");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();throw new BackendError("请求过大。",413);}chunks.push(value);}
    const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if(!body || typeof body!=="object" || Object.keys(body).some(key=>!["storeId","memberId","requestId"].includes(key)))throw new BackendError("请求格式无效。");
    return NextResponse.json(await cancelOperation(await getAuthIdentity(),body.storeId,body.memberId,body.requestId),{headers});
  } catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:"撤销尚未确认，请继续核对原提交。",code:error instanceof BackendError?error.code:undefined},{status:error instanceof BackendError?error.status:503,headers});}
}
