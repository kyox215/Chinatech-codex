import { NextResponse } from "next/server";
import { getAuthIdentity } from "@/lib/backend/context";
import { BackendError } from "@/lib/backend/database";
import { executeCommand } from "@/lib/backend/commands";
import { isSupabaseMode } from "@/lib/supabase/config";
import type { BackendCommand } from "@/lib/backend/contracts";

export const dynamic = "force-dynamic";
export async function POST(request:Request) {
  if(!isSupabaseMode()) return NextResponse.json({message:"正式后台未启用。"},{status:404});
  try {
    const origin=process.env.APP_ORIGIN || (process.env.NODE_ENV!=="production"?new URL(request.url).origin:"");
    if(!origin || request.headers.get("origin")!==origin) throw new BackendError("请求来源无效。",403);
    if(!request.headers.get("content-type")?.startsWith("application/json")) throw new BackendError("请求格式无效。",415);
    const reader=request.body?.getReader();if(!reader) throw new BackendError("请求资料为空。");
    const chunks:Uint8Array[]=[];let size=0;
    while(true) {const {done,value}=await reader.read();if(done) break;size+=value.byteLength;if(size>3*1024*1024){await reader.cancel();throw new BackendError("提交资料过大。",413);}chunks.push(value);}
    const body=Buffer.concat(chunks).toString("utf8");let command:BackendCommand;
    try {command=JSON.parse(body);} catch {throw new BackendError("请求资料无效。");}
    if(!command || Object.keys(command).some(key=>!["kind","payload","storeId","requestId"].includes(key))) throw new BackendError("请求字段无效。");
    const identity=await getAuthIdentity();const state=await executeCommand(identity,command);
    return NextResponse.json(state,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    const conflict=typeof error==="object" && error!==null && "code" in error && error.code==="40001";
    return NextResponse.json({message:error instanceof BackendError?error.message:conflict?"资料同时被另一位成员修改，请刷新后重新核对。":error instanceof Error && !('code' in error)?error.message:"保存失败，请重试。"},{status:error instanceof BackendError?error.status:conflict?409:400,headers:{"Cache-Control":"private, no-store"}});
  }
}
