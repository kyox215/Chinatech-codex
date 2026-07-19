import type { AiAssistantLocale } from "@/features/ai-assistant/model/contracts";
import {
  estimateAiMaximumReservationMicroUsd,
  estimateAiUsageMicroUsd,
  type AiAssistantRequestKind,
} from "./cost-policy";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import {
  AiProviderBudgetError,
  assertDurableAiProviderBudgetGateway,
  type AiProviderBudgetGateway,
  type AiProviderBudgetRequestIdentity,
} from "./provider-budget";
import { AiProviderRequestError, type AiAssistantProviderMetadata } from "./provider";
import { createAiActorRateFingerprint, createAiRequestFingerprint } from "./request-fingerprint";
import { getAiModelRuntimePolicy } from "./runtime-policy";
import type { AuditActor } from "@/lib/repairdesk/types";

type OpenAiMetadata = Extract<AiAssistantProviderMetadata, { provider: "openai" }>;
type BudgetOutcome = "reserved" | "settled" | "blocked" | "conservative_hold";

export class AiProviderBudgetSession {
  readonly reservedMicroUsd: number;
  estimatedMicroUsd: number | undefined;
  outcome: BudgetOutcome = "reserved";
  settlementError: AiProviderBudgetError | undefined;
  private settlementState: "reserved" | "settled" | "released" | "held" = "reserved";

  private constructor(
    private readonly gateway: AiProviderBudgetGateway,
    private readonly identity: AiProviderBudgetRequestIdentity,
    reservedMicroUsd: number,
  ) {
    this.reservedMicroUsd = reservedMicroUsd;
  }

  static async reserve({
    gateway,
    actor,
    clientRequestId,
    requestKind,
    locale,
    content,
    env,
  }: {
    gateway: AiProviderBudgetGateway | undefined;
    actor: AuditActor;
    clientRequestId: string;
    requestKind: AiAssistantRequestKind;
    locale: AiAssistantLocale;
    content: string;
    env: AiAssistantFeatureEnvironment;
  }) {
    try {
      assertDurableAiProviderBudgetGateway(gateway);
    } catch {
      throw new AiProviderBudgetError("configuration", "durable_gateway_required");
    }
    if (!actor.id || !actor.storeId) {
      throw new AiProviderBudgetError("authorization", "missing_actor_identity");
    }
    const secret = env.AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET ?? "";
    const policy = getAiModelRuntimePolicy(requestKind);
    const reservedMicroUsd = estimateAiMaximumReservationMicroUsd({
      model: policy.model,
      maxInputTokens: policy.maxEstimatedInputTokens,
      maxOutputTokens: policy.maxOutputTokens,
    });
    const identity: AiProviderBudgetRequestIdentity = {
      storeId: actor.storeId,
      actorId: actor.id,
      actorRateFingerprintHmac: createAiActorRateFingerprint(actor, secret),
      clientRequestId,
      requestFingerprintHmac: createAiRequestFingerprint({
        actor,
        clientRequestId,
        requestKind,
        model: policy.model,
        locale,
        content,
        secret,
      }),
    };
    await gateway.reserve({
      ...identity,
      requestKind,
      policyVersion: policy.policyVersion,
      pricingVersion: policy.pricingVersion,
      model: policy.model,
      reservedMicroUsd: BigInt(reservedMicroUsd),
    });
    return new AiProviderBudgetSession(gateway, identity, reservedMicroUsd);
  }

  async settleCompleted(metadata: OpenAiMetadata) {
    if (this.settlementState !== "reserved") return;
    const estimate = estimateAiUsageMicroUsd({
      model: metadata.model,
      usage: {
        inputTokens: metadata.usage.inputTokens,
        cachedInputTokens: metadata.usage.cachedInputTokens,
        cacheWriteTokens: metadata.usage.cacheWriteTokens,
        outputTokens: metadata.usage.outputTokens,
      },
    });
    this.estimatedMicroUsd = estimate;
    try {
      await this.gateway.settle({
        ...this.identity,
        outcome: "completed",
        usage: metadata.usage,
        estimatedMicroUsd: BigInt(estimate),
        providerAttemptCount: 1,
      });
      this.settlementState = "settled";
      this.outcome = "settled";
    } catch (error) {
      const budgetError = asBudgetError(error);
      this.settlementError = budgetError;
      if (budgetError.settlementCommitted) {
        this.settlementState = "settled";
        this.outcome = "settled";
      } else {
        this.settlementState = "held";
        this.outcome = "conservative_hold";
      }
      throw budgetError;
    }
  }

  async settleAfterFailure(error: unknown) {
    if (this.settlementState !== "reserved") return;
    if (error instanceof AiProviderRequestError && error.metadata) {
      try {
        await this.settleCompleted(error.metadata);
      } catch {
        // The caller reads settlementError and fails closed. The session has
        // already selected settled vs conservative hold.
      }
      return;
    }

    const outcome =
      error instanceof AiProviderRequestError && error.dispatchState === "not_sent"
        ? "not_sent"
        : "sent_unknown";
    try {
      const result = await this.gateway.settle({ ...this.identity, outcome });
      if (result.state === "failed_pre_dispatch" || result.state === "idempotent_replay") {
        this.settlementState = "released";
        this.outcome = "blocked";
      } else {
        this.settlementState = "held";
        this.outcome = "conservative_hold";
      }
    } catch (settlementError) {
      this.settlementError = asBudgetError(settlementError);
      this.settlementState = "held";
      this.outcome = "conservative_hold";
    }
  }
}

function asBudgetError(error: unknown) {
  return error instanceof AiProviderBudgetError
    ? error
    : new AiProviderBudgetError("dependency", "budget_settlement_unavailable");
}
