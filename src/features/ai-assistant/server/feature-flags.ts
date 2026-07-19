import { assertAiLiveBudgetConfiguration } from "./runtime-policy";
import type { AiAssistantRequestKind } from "./cost-policy";

export type AiAssistantFeatureEnvironment = {
  AI_ASSISTANT_ENABLED?: string;
  AI_ORDER_READ_TOOLS_ENABLED?: string;
  AI_VISION_INTAKE_ENABLED?: string;
  AI_DRAFT_APPLY_ENABLED?: string;
  AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED?: string;
  AI_ASSISTANT_PROVIDER?: string;
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED?: string;
  AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED?: string;
  AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED?: string;
  AI_ASSISTANT_BUDGET_APPROVED?: string;
  AI_ASSISTANT_REQUESTS_PER_STORE_DAY?: string;
  AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE?: string;
  AI_ASSISTANT_DURABLE_QUOTA_BACKEND?: string;
  AI_ASSISTANT_POLICY_VERSION?: string;
  AI_ASSISTANT_PRICING_VERSION?: string;
  AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD?: string;
  AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY?: string;
  AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY?: string;
  AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY?: string;
  AI_ASSISTANT_QUOTA_TIMEZONE?: string;
  AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET?: string;
  AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET?: string;
  AI_ASSISTANT_STORE_ALLOWLIST?: string;
  OPENAI_API_KEY?: string;
  OPENAI_AI_ASSISTANT_MODEL?: string;
  OPENAI_AI_ASSISTANT_ORDER_MODEL?: string;
  OPENAI_AI_ASSISTANT_VISION_MODEL?: string;
  OPENAI_API_BASE_URL?: string;
};

export type AiAssistantProviderName = "fake" | "openai";
export const AI_CHINATECH_PILOT_STORE_ID = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

export function isAiAssistantEnabled(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  return env.AI_ASSISTANT_ENABLED === "1";
}

export function isAiOrderReadToolsEnabled(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  return isAiAssistantEnabled(env) && env.AI_ORDER_READ_TOOLS_ENABLED === "1";
}

export function isAiVisionIntakeEnabled(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  return isAiAssistantEnabled(env) && env.AI_VISION_INTAKE_ENABLED === "1";
}

export function isAiDraftApplyEnabled(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  return isAiVisionIntakeEnabled(env) && env.AI_DRAFT_APPLY_ENABLED === "1";
}

export function isAiPublicCustomerAssistantEnabled(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  return isAiAssistantEnabled(env) && env.AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED === "1";
}

export function getAiAssistantProviderName(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
): AiAssistantProviderName {
  const configured = env.AI_ASSISTANT_PROVIDER?.trim();
  if (!configured || configured === "fake") return "fake";
  if (configured === "openai") return "openai";
  throw new Error("AI provider 配置无效");
}

export function getAiAssistantModel(
  kind: AiAssistantRequestKind,
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  if (getAiAssistantProviderName(env) === "fake") return "fake-ai-assistant-v1";
  const configured =
    kind === "order_text"
      ? env.OPENAI_AI_ASSISTANT_ORDER_MODEL?.trim()
      : env.OPENAI_AI_ASSISTANT_VISION_MODEL?.trim();
  if (configured) return configured;
  throw new Error(`OpenAI ${kind} 模型尚未配置`);
}

export function getAiAssistantApiBaseUrl(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  const value = env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1";
  const url = new URL(value);
  const allowedHosts = new Set(["api.openai.com", "eu.api.openai.com"]);
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname) ||
    !["/v1", "/v1/"].includes(url.pathname) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("OpenAI API 地址不在允许列表中");
  }
  return url.toString().replace(/\/$/, "");
}

export function getAiAssistantDailyRequestLimit(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  const value = Number(env.AI_ASSISTANT_REQUESTS_PER_STORE_DAY ?? 0);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function getAiAssistantRequestsPerActorMinute(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  const configured = env.AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE;
  if (configured === undefined || configured.trim() === "") return 30;
  const value = Number(configured);
  return Number.isSafeInteger(value) && value >= 1 && value <= 300 ? value : 30;
}

export function isAiAssistantStoreEnabled(
  storeId: string | null | undefined,
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  if (!storeId || !isAiAssistantEnabled(env)) return false;
  return getAiAssistantStoreAllowlist(env).includes(storeId);
}

export function getAiAssistantStoreAllowlist(env: AiAssistantFeatureEnvironment) {
  return (env.AI_ASSISTANT_STORE_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function assertOpenAiExternalCallsApproved(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  if (getAiAssistantProviderName(env) !== "openai") return;
  assertAiLiveBudgetConfiguration(env);
  if ((env.OPENAI_API_KEY?.trim().length ?? 0) < 20) {
    throw new Error("OpenAI API key 尚未安全配置");
  }
  const secrets = [
    env.OPENAI_API_KEY?.trim(),
    env.AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET?.trim(),
    env.AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET?.trim(),
  ];
  if (new Set(secrets).size !== secrets.length) {
    throw new Error("OpenAI API 与 HMAC secrets 必须相互独立");
  }
  getAiAssistantModel("order_text", env);
  getAiAssistantModel("inventory_vision", env);
  getAiAssistantApiBaseUrl(env);
}

export function assertOpenAiRequestDataApproved(
  kind: AiAssistantRequestKind,
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  if (getAiAssistantProviderName(env) !== "openai") return;
  if (env.AI_ASSISTANT_EXTERNAL_DATA_APPROVED !== "1") {
    throw new Error("OpenAI 外部数据处理尚未批准");
  }
  const approved =
    kind === "order_text"
      ? env.AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED
      : env.AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED;
  if (approved !== "1") {
    throw new Error(`OpenAI ${kind} 数据类别尚未单独批准`);
  }
}
