import { NextResponse } from "next/server";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { loadLookup } from "@/lib/backend/page-state";
import { isSupabaseMode } from "@/lib/supabase/config";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const headers={"Cache-Control":"private, no-store"};
  try {
    if(!isSupabaseMode())throw new BackendError("正式后台未启用。",404);
    const url=new URL(request.url);const p=url.searchParams;const access=await getServerAccess();if(!access)throw new BackendError("当前账号尚未获得门店授权。",403);
    const result=await withDatabase(access.identity,access.storeId,async tx=>loadLookup(tx,access.storeId,await memberInTransaction(tx,access.storeId,access.identity.userId),p.get("kind")||"",p.get("q")||"",process.env.APP_ORIGIN||url.origin,p.get("type")||"internal",p.get("page")||"1"));
    return NextResponse.json(result,{headers});
  }catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:"候选暂不可读取，请重试。"},{status:error instanceof BackendError?error.status:503,headers});}
}
