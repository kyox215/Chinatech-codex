import { aiNotAuthorizedError, aiQuotaExhaustedError } from "./errors";
import {
  getAiAssistantDailyRequestLimit,
  type AiAssistantFeatureEnvironment,
} from "./feature-flags";
import type { AuditActor } from "@/lib/repairdesk/types";

type DailyQuotaBucket = { day: string; count: number };

const localDailyQuotaByStore = new Map<string, DailyQuotaBucket>();

export type ConsumeAiAssistantQuotaInput = {
  actor: AuditActor;
  env?: AiAssistantFeatureEnvironment;
  now?: () => Date;
};

/**
 * Enforces configured limits for the fake/default-off slice in one server process.
 * A durable atomic quota backend remains a hard gate before the OpenAI provider can be enabled.
 */
export function consumeAiAssistantRequestQuota({
  actor,
  env = process.env as AiAssistantFeatureEnvironment,
  now = () => new Date(),
}: ConsumeAiAssistantQuotaInput) {
  const limit = getAiAssistantDailyRequestLimit(env);
  if (limit === 0) return { limited: false as const };
  if (!actor.storeId) throw aiNotAuthorizedError();

  const day = now().toISOString().slice(0, 10);
  const current = localDailyQuotaByStore.get(actor.storeId);
  const count = current?.day === day ? current.count : 0;
  if (count >= limit) throw aiQuotaExhaustedError();

  const nextCount = count + 1;
  localDailyQuotaByStore.set(actor.storeId, { day, count: nextCount });
  return { limited: true as const, remaining: Math.max(0, limit - nextCount) };
}

export function resetAiAssistantLocalQuotaForTests() {
  localDailyQuotaByStore.clear();
}
