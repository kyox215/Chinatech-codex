import { NextResponse } from "next/server";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { loadState, loadStateHeader, projectState } from "@/lib/backend/state";
import { isSupabaseMode } from "@/lib/supabase/config";
import { loadPageState, validatePageScope } from "@/lib/backend/page-state";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if(!isSupabaseMode()) return NextResponse.json({message:"正式后台未启用。"},{status:404});
  const started = performance.now();
  let accessTime = 0;
  let readTime = 0;
  function respond(data: unknown, status = 200) {
    const serializationStart = performance.now();
    const body = JSON.stringify(data);
    return new NextResponse(body,{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","Server-Timing":`access;dur=${accessTime.toFixed(1)}, read;dur=${readTime.toFixed(1)}, serialize;dur=${(performance.now()-serializationStart).toFixed(1)}`}});
  }
  try {
    const access=await getServerAccess();if(!access) throw new BackendError("当前账号尚未获得门店授权。",403);
    accessTime = performance.now() - started;
    const params=new URL(request.url).searchParams;const known = params.get("known");const scope=params.get("scope");if(scope)validatePageScope(scope);
    const readStarted = performance.now();
    const snapshot=await withDatabase(access.identity,access.storeId,async tx=>{
      const fresh=await memberInTransaction(tx,access.storeId,access.identity.userId);
      const header=await loadStateHeader(tx,access.storeId,fresh);
      if(known && /^[a-f0-9]{64}$/.test(known) && known===header.stateToken) return {unchanged:true as const,stateToken:header.stateToken,storeId:access.storeId,memberId:fresh.id,revision:header.revision};
      if(scope)return loadPageState(tx,access.storeId,fresh,scope);
      return projectState(await loadState(tx,access.storeId,fresh,header),fresh);
    });
    readTime = performance.now() - readStarted;
    return respond(snapshot);
  } catch(error) {return respond({message:error instanceof BackendError?error.message:"后台暂时不可用，请稍后重试。"},error instanceof BackendError?error.status:503);}
}
