import {
  AI_PRICING_VERSION,
  estimateAiMaximumReservationMicroUsd,
  getAiModelPricingRates,
} from "./cost-policy";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import {
  AiProviderBudgetError,
  type AiProviderBudgetGateway,
  type AiProviderBudgetSettlement,
} from "./provider-budget";
import {
  AI_RUNTIME_POLICY_VERSION,
  assertAiLiveBudgetConfiguration,
  getAiModelRuntimePolicy,
} from "./runtime-policy";
import { getSupabaseAdmin } from "@/server/supabase";

type RpcResult = { data: unknown; error: unknown };
export type AiBudgetRpcInvoker = (
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>;

type JsonRecord = Record<string, unknown>;

export class SupabaseAiProviderBudgetGateway implements AiProviderBudgetGateway {
  readonly durability = "durable" as const;
  private attested = false;

  constructor(
    private readonly rpc: AiBudgetRpcInvoker,
    private readonly env: AiAssistantFeatureEnvironment,
  ) {
    assertAiLiveBudgetConfiguration(env);
  }

  async reserve(input: Parameters<AiProviderBudgetGateway["reserve"]>[0]) {
    await this.settleExpiredReservations();
    await this.attestPolicy();
    const result = await this.call("repairdesk_reserve_ai_usage", {
      p_store_id: input.storeId,
      p_actor_id: input.actorId,
      p_actor_fingerprint_hmac: input.actorRateFingerprintHmac,
      p_client_request_id: input.clientRequestId,
      p_request_fingerprint_hmac: input.requestFingerprintHmac,
      p_request_kind: input.requestKind,
      p_policy_version: input.policyVersion,
      p_pricing_version: input.pricingVersion,
      p_model: input.model,
      p_reserved_cost_microusd: input.reservedMicroUsd.toString(),
    });
    if (result.ok !== true) throw budgetResultError(result);
    if (result.code !== "reserved") {
      throw new AiProviderBudgetError("configuration", "unexpected_reservation_replay");
    }
    const reservationId = requireUuid(result.reservation_id);
    const reservedMicroUsd = requirePositiveBigInt(result.reserved_cost_microusd);
    const expiresAt = requireDateTime(result.expires_at);
    if (reservedMicroUsd !== input.reservedMicroUsd) {
      throw new AiProviderBudgetError("configuration", "reservation_value_mismatch");
    }
    return {
      reservationId,
      clientRequestId: input.clientRequestId,
      policyVersion: input.policyVersion,
      reservedMicroUsd,
      expiresAt,
    };
  }

  async settle(
    input: Parameters<AiProviderBudgetGateway["settle"]>[0],
  ): Promise<AiProviderBudgetSettlement> {
    if (input.outcome === "sent_unknown") {
      return { state: "held_for_stale_settlement" };
    }
    if (input.outcome === "not_sent") {
      const result = await this.call("repairdesk_release_ai_usage_pre_dispatch", {
        p_store_id: input.storeId,
        p_actor_id: input.actorId,
        p_client_request_id: input.clientRequestId,
        p_request_fingerprint_hmac: input.requestFingerprintHmac,
      });
      if (result.ok !== true) throw budgetResultError(result);
      if (result.code === "released_pre_dispatch") return { state: "failed_pre_dispatch" };
      if (result.code === "idempotent_replay" && result.state === "failed_pre_dispatch") {
        return { state: "idempotent_replay", estimatedMicroUsd: 0n };
      }
      throw new AiProviderBudgetError("protocol", "unexpected_release_result");
    }

    if (!input.usage || input.providerAttemptCount !== 1) {
      throw new AiProviderBudgetError("protocol", "completed_usage_required");
    }
    const result = await this.call("repairdesk_finalize_ai_usage", {
      p_store_id: input.storeId,
      p_actor_id: input.actorId,
      p_client_request_id: input.clientRequestId,
      p_request_fingerprint_hmac: input.requestFingerprintHmac,
      p_input_token_count: input.usage.inputTokens,
      p_cached_input_token_count: input.usage.cachedInputTokens,
      p_cache_write_token_count: input.usage.cacheWriteTokens,
      p_output_token_count: input.usage.outputTokens,
      p_provider_attempt_count: input.providerAttemptCount,
    });
    if (result.ok !== true) throw budgetResultError(result);
    const estimatedMicroUsd = requireNonNegativeBigInt(result.estimated_cost_microusd);
    if (result.code === "overrun" || result.state === "overrun") {
      throw new AiProviderBudgetError("overrun", "reservation_overrun", true);
    }
    if (result.code !== "succeeded" && result.code !== "idempotent_replay") {
      throw new AiProviderBudgetError("protocol", "unexpected_finalize_result");
    }
    if (input.estimatedMicroUsd !== undefined && input.estimatedMicroUsd !== estimatedMicroUsd) {
      throw new AiProviderBudgetError("configuration", "pricing_attestation_mismatch", true);
    }
    return {
      state: result.code === "succeeded" ? "succeeded" : "idempotent_replay",
      estimatedMicroUsd,
    };
  }

  private async attestPolicy() {
    if (this.attested) return;
    const result = await this.call("repairdesk_attest_ai_usage_policy", {
      p_expected: buildPolicyAttestation(this.env),
    });
    if (result.ok !== true || result.code !== "policy_ready") throw budgetResultError(result);
    this.attested = true;
  }

  private async settleExpiredReservations() {
    const result = await this.call("repairdesk_settle_stale_ai_usage", { p_limit: 25 });
    if (result.ok !== true || result.code !== "stale_settled") {
      throw budgetResultError(result);
    }
  }

  private async call(functionName: string, args: Record<string, unknown>) {
    let response: RpcResult;
    try {
      response = await this.rpc(functionName, args);
    } catch {
      throw new AiProviderBudgetError("dependency", "rpc_unavailable");
    }
    if (response.error) throw new AiProviderBudgetError("dependency", "rpc_unavailable");
    if (!isRecord(response.data)) {
      throw new AiProviderBudgetError("protocol", "invalid_rpc_response");
    }
    return response.data;
  }
}

let productionGateway: AiProviderBudgetGateway | undefined;

export function getAiProviderBudgetGateway() {
  if (productionGateway) return productionGateway;
  const client = getSupabaseAdmin();
  productionGateway = new SupabaseAiProviderBudgetGateway(
    (functionName, args) => client.rpc(functionName, args),
    process.env as AiAssistantFeatureEnvironment,
  );
  return productionGateway;
}

export function buildPolicyAttestation(env: AiAssistantFeatureEnvironment) {
  assertAiLiveBudgetConfiguration(env);
  const order = getAiModelRuntimePolicy("order_text");
  const vision = getAiModelRuntimePolicy("inventory_vision");
  const orderRates = getAiModelPricingRates(order.model);
  const visionRates = getAiModelPricingRates(vision.model);
  return {
    policy_version: AI_RUNTIME_POLICY_VERSION,
    pricing_version: AI_PRICING_VERSION,
    quota_timezone: env.AI_ASSISTANT_QUOTA_TIMEZONE!,
    order_text_model: order.model,
    inventory_vision_model: vision.model,
    order_text_max_input_tokens: order.maxEstimatedInputTokens,
    order_text_max_output_tokens: order.maxOutputTokens,
    inventory_vision_max_input_tokens: vision.maxEstimatedInputTokens,
    inventory_vision_max_output_tokens: vision.maxOutputTokens,
    order_text_per_store_day: parsePositiveInteger(env.AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY),
    inventory_vision_per_store_day: parsePositiveInteger(
      env.AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY,
    ),
    requests_per_actor_minute: parsePositiveInteger(env.AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE),
    provider_requests_global_day: parsePositiveInteger(
      env.AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY,
    ),
    monthly_budget_microusd: parsePositiveInteger(env.AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD),
    order_text_max_reservation_microusd: estimateAiMaximumReservationMicroUsd({
      model: order.model,
      maxInputTokens: order.maxEstimatedInputTokens,
      maxOutputTokens: order.maxOutputTokens,
    }),
    inventory_vision_max_reservation_microusd: estimateAiMaximumReservationMicroUsd({
      model: vision.model,
      maxInputTokens: vision.maxEstimatedInputTokens,
      maxOutputTokens: vision.maxOutputTokens,
    }),
    order_text_input_rate_microusd_per_million: orderRates.inputMicroUsdPerMillion,
    order_text_cached_input_rate_microusd_per_million: orderRates.cachedInputMicroUsdPerMillion,
    order_text_cache_write_rate_microusd_per_million: orderRates.cacheWriteMicroUsdPerMillion,
    order_text_output_rate_microusd_per_million: orderRates.outputMicroUsdPerMillion,
    inventory_vision_input_rate_microusd_per_million: visionRates.inputMicroUsdPerMillion,
    inventory_vision_cached_input_rate_microusd_per_million:
      visionRates.cachedInputMicroUsdPerMillion,
    inventory_vision_cache_write_rate_microusd_per_million:
      visionRates.cacheWriteMicroUsdPerMillion,
    inventory_vision_output_rate_microusd_per_million: visionRates.outputMicroUsdPerMillion,
    max_provider_attempts: 1,
    reservation_ttl_seconds: 600,
  };
}

function budgetResultError(result: JsonRecord) {
  const code = typeof result.code === "string" ? result.code : "invalid_rpc_response";
  if (
    [
      "actor_minute_limit_reached",
      "store_daily_limit_reached",
      "global_daily_limit_reached",
      "monthly_budget_reached",
    ].includes(code)
  ) {
    return new AiProviderBudgetError("quota", code);
  }
  if (code === "actor_forbidden") return new AiProviderBudgetError("authorization", code);
  if (
    code === "budget_not_configured" ||
    code.endsWith("_mismatch") ||
    code.startsWith("invalid_") ||
    code === "quota_timezone_rotation_forbidden" ||
    code === "policy_not_found"
  ) {
    return new AiProviderBudgetError("configuration", code);
  }
  return new AiProviderBudgetError("protocol", "unexpected_rpc_result");
}

function requireUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new AiProviderBudgetError("protocol", "invalid_reservation_id");
  }
  return value;
}

function requireDateTime(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new AiProviderBudgetError("protocol", "invalid_reservation_expiry");
  }
  return value;
}

function requirePositiveBigInt(value: unknown) {
  const parsed = requireNonNegativeBigInt(value);
  if (parsed <= 0n) throw new AiProviderBudgetError("protocol", "invalid_rpc_integer");
  return parsed;
}

function requireNonNegativeBigInt(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new AiProviderBudgetError("protocol", "invalid_rpc_integer");
  }
  return BigInt(value);
}

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AiProviderBudgetError("configuration", "invalid_environment_integer");
  }
  return parsed;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
