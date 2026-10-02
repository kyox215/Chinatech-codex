import { NextResponse } from "next/server";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { withDatabase, BackendError } from "@/lib/backend/database";
import { can } from "@/lib/staff";
import { localIntakeId } from "@/lib/repair-intake-record";
import { isSupabaseMode } from "@/lib/supabase/config";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"};
export async function GET(request:Request) {
  if(!isSupabaseMode()) return NextResponse.json({message:"正式后台未启用。"},{status:404,headers});
  try {
    const url=new URL(request.url);const repairId=url.searchParams.get("order")??"";const photoId=url.searchParams.get("photo")??"";
    if(!localIntakeId(repairId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photoId)) throw new BackendError("照片不存在。",404);
    const access=await getServerAccess();if(!access) throw new BackendError("当前账号尚未获得门店授权。",403);
    const bytes=await withDatabase(access.identity,access.storeId,async tx=>{
      const member=await memberInTransaction(tx,access.storeId,access.identity.userId);
      if(!can(member,"repairs.view")) throw new BackendError("当前账号没有工单查看权限。",403);
      const [row]=await tx`select p.bytes from chinatech_v2_private.intake_photos p join chinatech_v2_private.repair_intakes r on r.store_id=p.store_id and r.id=p.repair_id where p.store_id=${access.storeId} and p.repair_id=${repairId} and p.id=${photoId} and r.data->'photos' @> ${tx.json([{id:photoId}])}`;
      if(!row) throw new BackendError("照片不存在。",404);
      return new Uint8Array(row.bytes).buffer;
    });
    return new NextResponse(bytes,{headers:{...headers,"Content-Type":"image/jpeg","Content-Disposition":"inline"}});
  }catch(error){return NextResponse.json({message:error instanceof BackendError?error.message:"照片暂不可用，请稍后重试。"},{status:error instanceof BackendError?error.status:503,headers});}
}
