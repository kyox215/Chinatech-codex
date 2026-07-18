import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { getSupabaseAdmin } from "@/server/supabase";

export type PrimaryStoreOwnerAccess =
  | { allowed: true; actorId: string; storeId: string }
  | {
      allowed: false;
      reason:
        | "store_context_required"
        | "owner_role_required"
        | "primary_owner_required"
        | "store_unavailable";
    };

export async function evaluatePrimaryStoreOwner(
  actor: AuditActor,
): Promise<PrimaryStoreOwnerAccess> {
  if (actor.isSystem || !actor.id || !actor.storeId || actor.activeStoreExplicit === false) {
    return { allowed: false, reason: "store_context_required" };
  }
  if (actor.storeRole !== "owner") {
    return { allowed: false, reason: "owner_role_required" };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("stores")
    .select("id, owner_user_id, status")
    .eq("id", actor.storeId)
    .maybeSingle();

  if (error) throw new Error(`读取店铺所有者失败：${error.message}`);
  if (!data || data.status !== "active") {
    return { allowed: false, reason: "store_unavailable" };
  }
  if (!data.owner_user_id || data.owner_user_id !== actor.id) {
    return { allowed: false, reason: "primary_owner_required" };
  }
  return { allowed: true, actorId: actor.id, storeId: actor.storeId };
}

export async function isPrimaryStoreOwner(actor: AuditActor) {
  return (await evaluatePrimaryStoreOwner(actor)).allowed;
}

export async function assertPrimaryStoreOwner(actor: AuditActor) {
  const access = await evaluatePrimaryStoreOwner(actor);
  if (!access.allowed) {
    throw new ForbiddenError("只有当前店铺的创建者账号可以管理工单数据");
  }
  return { actorId: access.actorId, storeId: access.storeId };
}
