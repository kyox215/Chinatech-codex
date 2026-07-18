export type AiAssistantFeatureEnvironment = {
  AI_ASSISTANT_ENABLED?: string;
  AI_ORDER_READ_TOOLS_ENABLED?: string;
  AI_VISION_INTAKE_ENABLED?: string;
  AI_DRAFT_APPLY_ENABLED?: string;
  AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED?: string;
  AI_ASSISTANT_PROVIDER?: string;
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED?: string;
  AI_ASSISTANT_BUDGET_APPROVED?: string;
  AI_ASSISTANT_REQUESTS_PER_STORE_DAY?: string;
  AI_ASSISTANT_STORE_ALLOWLIST?: string;
  OPENAI_AI_ASSISTANT_MODEL?: string;
  OPENAI_API_BASE_URL?: string;
};

export type AiAssistantProviderName = "fake" | "openai";

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
  return env.AI_ASSISTANT_PROVIDER === "openai" ? "openai" : "fake";
}

export function getAiAssistantModel(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  const configured = env.OPENAI_AI_ASSISTANT_MODEL?.trim();
  if (configured) return configured;
  if (getAiAssistantProviderName(env) === "fake") return "fake-ai-assistant-v1";
  throw new Error("OpenAI AI 小助手模型尚未配置");
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

export function isAiAssistantStoreEnabled(
  storeId: string | null | undefined,
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  if (!storeId || !isAiAssistantEnabled(env)) return false;
  return (env.AI_ASSISTANT_STORE_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(storeId);
}

export function assertOpenAiExternalCallsApproved(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
) {
  if (getAiAssistantProviderName(env) !== "openai") return;
  if (env.AI_ASSISTANT_EXTERNAL_DATA_APPROVED !== "1") {
    throw new Error("OpenAI 外部数据处理尚未批准");
  }
  if (env.AI_ASSISTANT_BUDGET_APPROVED !== "1" || getAiAssistantDailyRequestLimit(env) === 0) {
    throw new Error("OpenAI API 预算与门店日限额尚未批准");
  }
}
