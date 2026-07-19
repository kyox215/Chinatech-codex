import { AI_PRICING_VERSION, type AiAssistantRequestKind, type AiPricedModel } from "./cost-policy";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";

export const AI_RUNTIME_POLICY_VERSION = "ai-runtime-v2" as const;
export const AI_DURABLE_QUOTA_BACKEND = "supabase-v1" as const;
export const AI_PILOT_MAX_MONTHLY_BUDGET_MICRO_USD = 50_000_000;
export const AI_PILOT_MAX_ORDER_TEXT_PER_STORE_DAY = 20;
export const AI_PILOT_MAX_INVENTORY_VISION_PER_STORE_DAY = 10;
export const AI_PILOT_MAX_PROVIDER_REQUESTS_GLOBAL_DAY = 300;
export const AI_PILOT_MAX_REQUESTS_PER_ACTOR_MINUTE = 30;

export type AiModelRuntimePolicy = {
  policyVersion: typeof AI_RUNTIME_POLICY_VERSION;
  pricingVersion: typeof AI_PRICING_VERSION;
  requestKind: AiAssistantRequestKind;
  model: AiPricedModel;
  maxEstimatedInputTokens: number;
  maxOutputTokens: number;
  providerDeadlineMs: number;
  maxAttempts: 1;
  fallbackEnabled: false;
  reasoningEffort: "minimal" | null;
  imageDetail?: "high";
};

const policies = {
  order_text: {
    policyVersion: AI_RUNTIME_POLICY_VERSION,
    pricingVersion: AI_PRICING_VERSION,
    requestKind: "order_text",
    model: "gpt-5-nano-2025-08-07",
    maxEstimatedInputTokens: 4_096,
    maxOutputTokens: 256,
    providerDeadlineMs: 8_000,
    maxAttempts: 1,
    fallbackEnabled: false,
    reasoningEffort: "minimal",
  },
  inventory_vision: {
    policyVersion: AI_RUNTIME_POLICY_VERSION,
    pricingVersion: AI_PRICING_VERSION,
    requestKind: "inventory_vision",
    model: "gpt-4o-mini-2024-07-18",
    maxEstimatedInputTokens: 50_000,
    maxOutputTokens: 1_024,
    providerDeadlineMs: 25_000,
    maxAttempts: 1,
    fallbackEnabled: false,
    imageDetail: "high",
    reasoningEffort: null,
  },
} as const satisfies Record<AiAssistantRequestKind, AiModelRuntimePolicy>;

export function getAiModelRuntimePolicy(kind: AiAssistantRequestKind): AiModelRuntimePolicy {
  return policies[kind];
}

export function assertAiLiveBudgetConfiguration(env: AiAssistantFeatureEnvironment) {
  if (env.AI_ASSISTANT_EXTERNAL_DATA_APPROVED !== "1") {
    throw new Error("OpenAI 外部数据处理尚未批准");
  }
  if (env.AI_ASSISTANT_BUDGET_APPROVED !== "1") {
    throw new Error("OpenAI API 预算尚未批准");
  }
  if (env.AI_ASSISTANT_DURABLE_QUOTA_BACKEND !== AI_DURABLE_QUOTA_BACKEND) {
    throw new Error("OpenAI durable quota backend 尚未配置");
  }
  if (env.AI_ASSISTANT_POLICY_VERSION !== AI_RUNTIME_POLICY_VERSION) {
    throw new Error("OpenAI runtime policy 版本不匹配");
  }
  if (env.AI_ASSISTANT_PRICING_VERSION !== AI_PRICING_VERSION) {
    throw new Error("OpenAI pricing 版本不匹配");
  }
  requireAtMost(
    env.AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD,
    "月度预算",
    AI_PILOT_MAX_MONTHLY_BUDGET_MICRO_USD,
  );
  requireAtMost(
    env.AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY,
    "文字日额度",
    AI_PILOT_MAX_ORDER_TEXT_PER_STORE_DAY,
  );
  requireAtMost(
    env.AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY,
    "图片日额度",
    AI_PILOT_MAX_INVENTORY_VISION_PER_STORE_DAY,
  );
  requireAtMost(
    env.AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY,
    "全局日额度",
    AI_PILOT_MAX_PROVIDER_REQUESTS_GLOBAL_DAY,
  );
  requireAtMost(
    env.AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE,
    "请求短窗额度",
    AI_PILOT_MAX_REQUESTS_PER_ACTOR_MINUTE,
  );
  requireIanaTimeZone(env.AI_ASSISTANT_QUOTA_TIMEZONE);
  if ((env.AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("OpenAI safety identifier secret 尚未安全配置");
  }
  if ((env.AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("OpenAI request fingerprint secret 尚未安全配置");
  }
  if (
    env.AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET?.trim() ===
    env.AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET?.trim()
  ) {
    throw new Error("OpenAI HMAC secrets 必须相互独立");
  }
}

function requireAtMost(value: string | undefined, label: string, maximum: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label}配置无效`);
  if (parsed > maximum) throw new Error(`${label}超过试点硬上限`);
}

function requireIanaTimeZone(value: string | undefined) {
  if (!value?.trim()) throw new Error("额度时区尚未配置");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error("额度时区配置无效");
  }
}
