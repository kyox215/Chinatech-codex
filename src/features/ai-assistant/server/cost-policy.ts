export type AiAssistantRequestKind = "order_text" | "inventory_vision";

export const AI_PRICING_VERSION = "openai-pricing-2026-07-18" as const;
export const AI_PROPOSED_MONTHLY_BUDGET_MICRO_USD = 50_000_000 as const;

export type AiBillableUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
};

export type AiModelPricingRates = {
  inputMicroUsdPerMillion: number;
  cachedInputMicroUsdPerMillion: number;
  cacheWriteMicroUsdPerMillion: number;
  outputMicroUsdPerMillion: number;
};

const ratesByExactModel = {
  "gpt-5-nano-2025-08-07": {
    inputMicroUsdPerMillion: 50_000,
    cachedInputMicroUsdPerMillion: 5_000,
    cacheWriteMicroUsdPerMillion: 50_000,
    outputMicroUsdPerMillion: 400_000,
  },
  "gpt-4o-mini-2024-07-18": {
    inputMicroUsdPerMillion: 150_000,
    cachedInputMicroUsdPerMillion: 75_000,
    cacheWriteMicroUsdPerMillion: 150_000,
    outputMicroUsdPerMillion: 600_000,
  },
  "gpt-5-mini-2025-08-07": {
    inputMicroUsdPerMillion: 250_000,
    cachedInputMicroUsdPerMillion: 25_000,
    cacheWriteMicroUsdPerMillion: 250_000,
    outputMicroUsdPerMillion: 2_000_000,
  },
} as const satisfies Record<string, AiModelPricingRates>;

export type AiPricedModel = keyof typeof ratesByExactModel;

export function getAiModelPricingRates(model: string): AiModelPricingRates {
  const rates = ratesByExactModel[model as AiPricedModel];
  if (!rates) throw new AiCostPolicyError("unknown exact model pricing");
  return { ...rates };
}

export class AiCostPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiCostPolicyError";
  }
}

/**
 * Returns a conservative integer estimate in micro-USD. Each billable class is
 * rounded up independently so known usage is never underestimated by decimal
 * truncation. Reasoning tokens are already part of output tokens and must not
 * be passed as a fifth billed class.
 */
export function estimateAiUsageMicroUsd({
  model,
  usage,
}: {
  model: string;
  usage: AiBillableUsage;
}) {
  const rates = ratesByExactModel[model as AiPricedModel];
  if (!rates) throw new AiCostPolicyError("unknown exact model pricing");
  for (const value of Object.values(usage)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new AiCostPolicyError("invalid token usage");
    }
  }
  if (usage.cachedInputTokens + usage.cacheWriteTokens > usage.inputTokens) {
    throw new AiCostPolicyError("cached token classes exceed input tokens");
  }

  const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens;
  const total =
    roundedClassCost(uncachedInputTokens, rates.inputMicroUsdPerMillion) +
    roundedClassCost(usage.cachedInputTokens, rates.cachedInputMicroUsdPerMillion) +
    roundedClassCost(usage.cacheWriteTokens, rates.cacheWriteMicroUsdPerMillion) +
    roundedClassCost(usage.outputTokens, rates.outputMicroUsdPerMillion);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AiCostPolicyError("estimated cost exceeds safe integer range");
  }
  return Number(total);
}

export function estimateAiMaximumReservationMicroUsd({
  model,
  maxInputTokens,
  maxOutputTokens,
}: {
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
}) {
  const rates = ratesByExactModel[model as AiPricedModel];
  if (!rates) throw new AiCostPolicyError("unknown exact model pricing");
  if (
    !Number.isSafeInteger(maxInputTokens) ||
    maxInputTokens <= 0 ||
    !Number.isSafeInteger(maxOutputTokens) ||
    maxOutputTokens <= 0
  ) {
    throw new AiCostPolicyError("invalid maximum token usage");
  }
  const inputRate = Math.max(
    rates.inputMicroUsdPerMillion,
    rates.cachedInputMicroUsdPerMillion,
    rates.cacheWriteMicroUsdPerMillion,
  );
  const total =
    roundedClassCost(maxInputTokens, inputRate) +
    roundedClassCost(maxOutputTokens, rates.outputMicroUsdPerMillion);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AiCostPolicyError("maximum reservation exceeds safe integer range");
  }
  return Number(total);
}

function roundedClassCost(tokens: number, rateMicroUsdPerMillion: number) {
  if (tokens === 0) return 0n;
  const numerator = BigInt(tokens) * BigInt(rateMicroUsdPerMillion);
  return (numerator + 999_999n) / 1_000_000n;
}
