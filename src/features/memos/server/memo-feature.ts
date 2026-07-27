import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

const enabledValue = "1";

export function isMemosEnabledForStore(
  storeId: string | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  if (!storeId || env.REPAIRDESK_MEMOS_ENABLED !== enabledValue) return false;
  const allowlist = new Set(
    (env.REPAIRDESK_MEMOS_STORE_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => Boolean(value) && value !== "*"),
  );
  return allowlist.has(storeId);
}

export function assertMemosFeature(actor: AuditActor) {
  if (actor.isSystem) throw new ForbiddenError();
  if (!actor.storeId || !actor.activeMembershipId || !actor.id) throw new ForbiddenError();
  if (!isMemosEnabledForStore(actor.storeId)) {
    const error = new Error("备忘录功能尚未对当前店铺开放") as Error & {
      status: number;
      code: string;
    };
    error.name = "MemosFeatureDisabledError";
    error.status = 403;
    error.code = "MEMOS_FEATURE_DISABLED";
    throw error;
  }
}
