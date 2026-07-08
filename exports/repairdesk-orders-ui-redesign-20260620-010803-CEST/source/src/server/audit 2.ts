import { getSupabaseAdmin, hasSupabaseConfig } from "@/server/supabase";
import type { AuditActor } from "@/lib/repairdesk/types";

export interface WriteAuditLogInput {
  actor?: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

const defaultAuditActor: AuditActor = {
  displayName: "系统",
  isSystem: true,
};

export async function writeAuditLog({
  actor = defaultAuditActor,
  action,
  entityType,
  entityId,
  before,
  after,
  metadata = {},
}: WriteAuditLogInput) {
  if (!hasSupabaseConfig()) return { ok: true };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("audit_logs").insert({
    id: crypto.randomUUID(),
    actor_id: actor.id ?? null,
    actor_email: actor.email ?? null,
    actor_name: actor.displayName,
    store_id: actor.storeId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_data: before ?? null,
    after_data: after ?? null,
    metadata,
  });

  if (error) throw new Error(`写入审计日志失败：${error.message}`);
  return { ok: true };
}
