import type { StoreLifecyclePhase } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { getSupabaseAdmin } from "@/server/supabase";
import { isStoreLifecycleEnforcementEnabled } from "./store-lifecycle-feature-flags";

export async function readStoreLifecyclePhase(storeId: string): Promise<StoreLifecyclePhase> {
  const { data, error } = await getSupabaseAdmin()
    .from("store_lifecycles")
    .select("phase")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) {
    if (isLifecycleTableUnavailable(error) && !isStoreLifecycleEnforcementEnabled()) {
      return "active";
    }
    if (isLifecycleTableUnavailable(error)) {
      throw new ForbiddenError("店铺写入保护尚未准备完成，当前操作不可用");
    }
    throw new Error(`读取店铺生命周期失败：${error.message}`);
  }
  return data?.phase === "active" ||
    data?.phase === "closing" ||
    data?.phase === "archived" ||
    data?.phase === "purge_scheduled" ||
    data?.phase === "purging" ||
    data?.phase === "purge_failed" ||
    data?.phase === "purged"
    ? data.phase
    : "active";
}

export async function assertStoreLifecycleActive(storeId: string) {
  if ((await readStoreLifecyclePhase(storeId)) !== "active") {
    throw new ForbiddenError("店铺已进入关闭流程，当前操作不可用");
  }
}

function isLifecycleTableUnavailable(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  return (
    error.code === "42P01" || (error.code === "PGRST205" && message.includes("store_lifecycles"))
  );
}
