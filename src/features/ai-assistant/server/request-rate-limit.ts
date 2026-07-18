import { aiNotAuthorizedError, aiRequestRateLimitedError } from "./errors";
import {
  getAiAssistantRequestsPerActorMinute,
  type AiAssistantFeatureEnvironment,
} from "./feature-flags";
import type { AuditActor } from "@/lib/repairdesk/types";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

type LocalRateBucket = { minute: number; count: number };

const localRateByActorAndStore = new Map<string, LocalRateBucket>();

export type ConsumeAiAssistantRequestRateLimitInput = {
  actor: AuditActor;
  env?: AiAssistantFeatureEnvironment;
  now?: () => Date;
};

/**
 * Short-window abuse guard for every AI endpoint request, including zero-model
 * paths. This process-local guard is defense in depth for the dormant/fake
 * slice; a distributed guard remains mandatory before a paid multi-instance
 * rollout.
 */
export function consumeAiAssistantRequestRateLimit({
  actor,
  env = process.env as AiAssistantFeatureEnvironment,
  now = () => new Date(),
}: ConsumeAiAssistantRequestRateLimitInput) {
  const isE2eSystemActor =
    actor.isSystem === true &&
    process.env.NODE_ENV !== "production" &&
    isRepairDeskE2eAuthBypassEnabled();
  if ((!actor.id || !actor.storeId) && !isE2eSystemActor) throw aiNotAuthorizedError();
  const limit = getAiAssistantRequestsPerActorMinute(env);
  const minute = Math.floor(now().getTime() / 60_000);
  const key = isE2eSystemActor ? "e2e-system:e2e-store" : `${actor.storeId}:${actor.id}`;
  const current = localRateByActorAndStore.get(key);
  const count = current?.minute === minute ? current.count : 0;
  if (count >= limit) throw aiRequestRateLimitedError();

  const nextCount = count + 1;
  localRateByActorAndStore.set(key, { minute, count: nextCount });
  return { remaining: Math.max(0, limit - nextCount) };
}

export function resetAiAssistantLocalRateLimitForTests() {
  localRateByActorAndStore.clear();
}
