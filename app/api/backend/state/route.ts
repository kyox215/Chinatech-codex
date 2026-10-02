import { NextResponse } from "next/server";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { loadState, projectState } from "@/lib/backend/state";
import { isSupabaseMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export async function GET() {
  if(!isSupabaseMode()) return NextResponse.json({message:"正式后台未启用。"},{status:404});
  try {
    const access=await getServerAccess();if(!access) throw new BackendError("当前账号尚未获得门店授权。",403);
    const snapshot=await withDatabase(access.identity,access.storeId,async tx=>{const fresh=await memberInTransaction(tx,access.storeId,access.identity.userId);return projectState(await loadState(tx,access.storeId,fresh),fresh);});
    return NextResponse.json(snapshot,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {return NextResponse.json({message:error instanceof BackendError?error.message:"后台暂时不可用，请稍后重试。"},{status:error instanceof BackendError?error.status:503,headers:{"Cache-Control":"private, no-store"}});}
}
