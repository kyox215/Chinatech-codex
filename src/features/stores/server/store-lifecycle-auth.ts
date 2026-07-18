import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

export const STORE_LIFECYCLE_RECENT_AUTH_MS = 5 * 60 * 1000;

export function assertRecentLifecycleAal2(
  actor: AuditActor,
  nowMs = Date.now(),
  maxAgeMs = STORE_LIFECYCLE_RECENT_AUTH_MS,
) {
  if (actor.authAssuranceLevel !== "aal2" || !actor.recentAuthAt) {
    throw new ForbiddenError("请先完成双重验证，再执行店铺高风险操作");
  }
  const authenticatedAt = Date.parse(actor.recentAuthAt);
  if (
    !Number.isFinite(authenticatedAt) ||
    authenticatedAt > nowMs ||
    nowMs - authenticatedAt > maxAgeMs
  ) {
    throw new ForbiddenError("双重验证已超过 5 分钟，请重新验证后再继续");
  }
  return { assuranceLevel: "aal2" as const, authenticatedAt: actor.recentAuthAt };
}
