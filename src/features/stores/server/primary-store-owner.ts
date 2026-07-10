import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { getSupabaseAdmin } from "@/server/supabase";

export async function isPrimaryStoreOwner(actor: AuditActor) {
  if (
    actor.isSystem ||
    !actor.id ||
    !actor.storeId ||
    actor.storeRole !== "owner" ||
    actor.activeStoreExplicit === false
  ) {
    return false;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("stores")
    .select("id, owner_user_id, status")
    .eq("id", actor.storeId)
    .maybeSingle();

  if (error) throw new Error(`读取店铺所有者失败：${error.message}`);
  return Boolean(
    data && data.status === "active" && data.owner_user_id && data.owner_user_id === actor.id,
  );
}

export async function assertPrimaryStoreOwner(actor: AuditActor) {
  if (!(await isPrimaryStoreOwner(actor))) {
    throw new ForbiddenError("只有当前店铺的创建者账号可以管理工单数据");
  }
  return { actorId: actor.id!, storeId: actor.storeId! };
}
