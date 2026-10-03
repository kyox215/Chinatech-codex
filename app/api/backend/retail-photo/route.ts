import { NextResponse } from "next/server";
import { getServerAccess, memberInTransaction } from "@/lib/backend/context";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { can } from "@/lib/staff";
import { retailPhotoHash } from "@/lib/backend/retail-photos";
import { isSupabaseMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" };
export async function GET(request: Request) {
  try {
    if (!isSupabaseMode()) throw new BackendError("正式后台未启用。", 404);
    const params = new URL(request.url).searchParams; const unit = params.get("unit") || ""; const sale = params.get("sale") || ""; const hash = params.get("hash") || ""; const index = Number(params.get("index"));
    if (!unit || unit.length > 100 || sale.length > 100 || !/^[a-f0-9]{64}$/.test(hash) || !Number.isInteger(index) || index < 0 || index > 5 || params.get("index") === null) throw new BackendError("照片查询无效。");
    const access = await getServerAccess(); if (!access) throw new BackendError("当前账号尚未获得门店授权。", 403);
    const photo = await withDatabase(access.identity, access.storeId, async tx => {
      const fresh = await memberInTransaction(tx, access.storeId, access.identity.userId); if (!can(fresh, "retail.view")) throw new BackendError("当前账号没有照片查看权限。", 403);
      const [row] = sale ? await tx`select (select item->'product'->'photos'->>(${index}::int) from jsonb_array_elements(data->'sales') item where item->>'id'=${sale}) as photo from chinatech_v2_private.retail_units where store_id=${access.storeId} and id::text=${unit}`
        : await tx`select data->'photos'->>(${index}::int) as photo from chinatech_v2_private.retail_units where store_id=${access.storeId} and id::text=${unit}`;
      if (typeof row?.photo !== "string" || retailPhotoHash(row.photo) !== hash) throw new BackendError("照片不存在或已变化。", 404);
      return row.photo;
    });
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo); if (!match) throw new BackendError("照片格式暂不可读取。", 503);
    return new NextResponse(Buffer.from(match[2], "base64"), { headers: { ...headers, "Content-Type": match[1] } });
  } catch (error) { return NextResponse.json({ message: error instanceof BackendError ? error.message : "照片暂不可读取。" }, { status: error instanceof BackendError ? error.status : 503, headers }); }
}
