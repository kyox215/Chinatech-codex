import { describe, expect, it, vi } from "vitest";

import { estimateAiUsageMicroUsd } from "./cost-policy";
import {
  SupabaseAiProviderBudgetGateway,
  buildPolicyAttestation,
  type AiBudgetRpcInvoker,
} from "./supabase-provider-budget";

const liveEnv = {
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_BUDGET_APPROVED: "1",
  AI_ASSISTANT_DURABLE_QUOTA_BACKEND: "supabase-v1",
  AI_ASSISTANT_POLICY_VERSION: "ai-runtime-v2",
  AI_ASSISTANT_PRICING_VERSION: "openai-pricing-2026-07-18",
  AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD: "50000000",
  AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY: "20",
  AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY: "10",
  AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY: "300",
  AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "30",
  AI_ASSISTANT_QUOTA_TIMEZONE: "Europe/Rome",
  AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET: "test-only-secret-with-at-least-32-characters",
  AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET:
    "test-only-fingerprint-secret-with-at-least-32-characters",
} as const;

const identity = {
  storeId: "00000000-0000-4000-8000-000000000001",
  actorId: "00000000-0000-4000-8000-000000000002",
  actorRateFingerprintHmac: "b".repeat(43),
  clientRequestId: "00000000-0000-4000-8000-000000000003",
  requestFingerprintHmac: "a".repeat(43),
};

describe("Supabase AI provider budget gateway", () => {
  it("attests policy, sweeps stale rows, reserves and finalizes with authoritative cost", async () => {
    const expectedCost = estimateAiUsageMicroUsd({
      model: "gpt-5-nano-2025-08-07",
      usage: { inputTokens: 100, cachedInputTokens: 10, cacheWriteTokens: 0, outputTokens: 20 },
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "repairdesk_settle_stale_ai_usage") {
        return { data: { ok: true, code: "stale_settled", settled_count: 0 }, error: null };
      }
      if (name === "repairdesk_attest_ai_usage_policy") {
        return { data: { ok: true, code: "policy_ready" }, error: null };
      }
      if (name === "repairdesk_reserve_ai_usage") {
        return {
          data: {
            ok: true,
            code: "reserved",
            reservation_id: "00000000-0000-4000-8000-000000000004",
            reserved_cost_microusd: "308",
            expires_at: "2026-07-18T12:10:00.000Z",
          },
          error: null,
        };
      }
      return {
        data: {
          ok: true,
          code: "succeeded",
          state: "succeeded",
          estimated_cost_microusd: String(expectedCost),
        },
        error: null,
      };
    });
    const gateway = new SupabaseAiProviderBudgetGateway(
      rpc as unknown as AiBudgetRpcInvoker,
      liveEnv,
    );

    const reservation = await gateway.reserve({
      ...identity,
      requestKind: "order_text",
      policyVersion: "ai-runtime-v2",
      pricingVersion: "openai-pricing-2026-07-18",
      model: "gpt-5-nano-2025-08-07",
      reservedMicroUsd: 308n,
    });
    const settlement = await gateway.settle({
      ...identity,
      outcome: "completed",
      usage: { inputTokens: 100, cachedInputTokens: 10, cacheWriteTokens: 0, outputTokens: 20 },
      estimatedMicroUsd: BigInt(expectedCost),
      providerAttemptCount: 1,
    });

    expect(reservation).toMatchObject({ reservedMicroUsd: 308n });
    expect(settlement).toEqual({ state: "succeeded", estimatedMicroUsd: BigInt(expectedCost) });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "repairdesk_settle_stale_ai_usage",
      "repairdesk_attest_ai_usage_policy",
      "repairdesk_reserve_ai_usage",
      "repairdesk_finalize_ai_usage",
    ]);
    expect(rpc).toHaveBeenCalledWith(
      "repairdesk_reserve_ai_usage",
      expect.objectContaining({
        p_actor_fingerprint_hmac: identity.actorRateFingerprintHmac,
        p_reserved_cost_microusd: "308",
      }),
    );
  });

  it("maps hard quota rejection before any provider dispatch", async () => {
    const rpc = rpcForReserve({ ok: false, code: "monthly_budget_reached" });
    const gateway = new SupabaseAiProviderBudgetGateway(rpc, liveEnv);
    await expect(
      gateway.reserve({
        ...identity,
        requestKind: "order_text",
        policyVersion: "ai-runtime-v2",
        pricingVersion: "openai-pricing-2026-07-18",
        model: "gpt-5-nano-2025-08-07",
        reservedMicroUsd: 308n,
      }),
    ).rejects.toMatchObject({
      kind: "quota",
      safeCode: "monthly_budget_reached",
    });
  });

  it("never releases a sent-unknown reservation", async () => {
    const rpc = vi.fn();
    const gateway = new SupabaseAiProviderBudgetGateway(
      rpc as unknown as AiBudgetRpcInvoker,
      liveEnv,
    );
    await expect(gateway.settle({ ...identity, outcome: "sent_unknown" })).resolves.toEqual({
      state: "held_for_stale_settlement",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("releases only a proven pre-dispatch failure", async () => {
    const rpc = vi.fn(async () => ({
      data: { ok: true, code: "released_pre_dispatch", state: "failed_pre_dispatch" },
      error: null,
    }));
    const gateway = new SupabaseAiProviderBudgetGateway(
      rpc as unknown as AiBudgetRpcInvoker,
      liveEnv,
    );
    await expect(gateway.settle({ ...identity, outcome: "not_sent" })).resolves.toEqual({
      state: "failed_pre_dispatch",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("builds the exact deployment-to-database policy attestation", () => {
    expect(buildPolicyAttestation(liveEnv)).toMatchObject({
      policy_version: "ai-runtime-v2",
      pricing_version: "openai-pricing-2026-07-18",
      quota_timezone: "Europe/Rome",
      order_text_max_reservation_microusd: 308,
      inventory_vision_max_reservation_microusd: 8115,
      requests_per_actor_minute: 30,
      monthly_budget_microusd: 50_000_000,
      max_provider_attempts: 1,
      reservation_ttl_seconds: 600,
    });
  });
});

function rpcForReserve(reserveData: Record<string, unknown>): AiBudgetRpcInvoker {
  return async (name) => {
    if (name === "repairdesk_settle_stale_ai_usage") {
      return { data: { ok: true, code: "stale_settled", settled_count: 0 }, error: null };
    }
    if (name === "repairdesk_attest_ai_usage_policy") {
      return { data: { ok: true, code: "policy_ready" }, error: null };
    }
    return { data: reserveData, error: null };
  };
}
