import { randomUUID } from "node:crypto";

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  AI_INVENTORY_RECOGNITION_PROMPT_VERSION,
  aiInventoryRecognitionSchema,
  aiInventoryVisionResponseSchema,
  type AiInventoryVisionRequest,
  type AiInventoryVisionResponse,
} from "@/features/ai-assistant/model/contracts";
import {
  bucketAiAssistantInputBytes,
  bucketAiAssistantLatency,
  writeAiAssistantAudit,
  type AiAssistantAuditStatus,
  type WriteAiAssistantAuditInput,
} from "./audit";
import { getAiAssistantCapabilities } from "./capabilities";
import { AI_PRICING_VERSION } from "./cost-policy";
import { assertAiProviderEgressAllowed } from "./egress-policy";
import {
  AiServiceError,
  aiAuditUnavailableError,
  aiBudgetUnavailableError,
  aiDisabledError,
  aiNotAuthorizedError,
  aiQuotaExhaustedError,
  aiRequestCancelledError,
  aiRequestRateLimitedError,
} from "./errors";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import { AiProviderRequestError, type AiAssistantProvider } from "./provider";
import { AiProviderBudgetError, type AiProviderBudgetGateway } from "./provider-budget";
import { AiProviderBudgetSession } from "./provider-budget-lifecycle";
import { createAiProviderSignal, isAiProviderTimeoutError } from "./provider-signal";
import { consumeAiAssistantRequestQuota, type ConsumeAiAssistantQuotaInput } from "./quota";
import {
  consumeAiAssistantRequestRateLimit,
  type ConsumeAiAssistantRequestRateLimitInput,
} from "./request-rate-limit";
import { getAiModelRuntimePolicy } from "./runtime-policy";
import { createAiSafetyIdentifierIfConfigured } from "./safety-identifier";
import { AiVisionInputValidationError, validateAiInventoryVisionInput } from "./vision-input";
import type { AuditActor } from "@/lib/repairdesk/types";

type VisionAssistantDependencies = {
  provider: AiAssistantProvider | (() => AiAssistantProvider);
  env?: AiAssistantFeatureEnvironment;
  now?: () => Date;
  requestSignal?: AbortSignal;
  consumeQuota?: (input: ConsumeAiAssistantQuotaInput) => unknown | Promise<unknown>;
  budgetGateway?: AiProviderBudgetGateway | (() => AiProviderBudgetGateway);
  consumeRequestRateLimit?: (
    input: ConsumeAiAssistantRequestRateLimitInput,
  ) => unknown | Promise<unknown>;
};

export async function runAiInventoryVisionRecognition({
  actor,
  input,
  dependencies,
}: {
  actor: AuditActor;
  input: AiInventoryVisionRequest;
  dependencies: VisionAssistantDependencies;
}): Promise<AiInventoryVisionResponse> {
  const requestId = input.client_request_id ?? randomUUID();
  const auditContext: Pick<
    WriteAiAssistantAuditInput,
    | "event"
    | "provider"
    | "modelVersion"
    | "inputImageCount"
    | "inputBytesBucket"
    | "inputTokens"
    | "outputTokens"
    | "latencyBucket"
    | "requestKind"
    | "resolutionPath"
    | "cachedInputTokens"
    | "cacheWriteTokens"
    | "providerAttemptCount"
    | "policyVersion"
    | "pricingVersion"
    | "estimatedMicroUsd"
    | "reservedMicroUsd"
    | "budgetOutcome"
    | "safetyIdentifierPresent"
  > = {
    event: "vision_recognition",
    provider: "none",
    modelVersion: "not_started",
    inputImageCount: 1,
    inputBytesBucket: bucketAiAssistantInputBytes(input.byte_length),
    requestKind: "inventory_vision",
    resolutionPath: "provider",
  };
  let stage: "authorization" | "input" | "budget" | "provider" | "protocol" = "authorization";
  let budgetSession: AiProviderBudgetSession | undefined;

  let response: AiInventoryVisionResponse;
  try {
    const capabilities = getAiAssistantCapabilities(actor, dependencies.env);
    if (!capabilities.canUseVisionIntake) {
      if (capabilities.reason === "feature_off" || capabilities.reason === "rollout_not_enabled") {
        throw aiDisabledError();
      }
      throw aiNotAuthorizedError();
    }

    await (dependencies.consumeRequestRateLimit ?? consumeAiAssistantRequestRateLimit)({
      actor,
      env: dependencies.env,
      now: dependencies.now,
    });

    stage = "input";
    validateAiInventoryVisionInput(input);

    const provider =
      typeof dependencies.provider === "function" ? dependencies.provider() : dependencies.provider;
    auditContext.provider = provider.name;
    const runtimePolicy = getAiModelRuntimePolicy("inventory_vision");
    const safetyIdentifier = createAiSafetyIdentifierIfConfigured(actor, dependencies.env);
    auditContext.policyVersion = runtimePolicy.policyVersion;
    auditContext.safetyIdentifierPresent = Boolean(safetyIdentifier);
    if (provider.name === "fake") {
      await (dependencies.consumeQuota ?? consumeAiAssistantRequestQuota)({
        actor,
        env: dependencies.env,
        now: dependencies.now,
      });
      auditContext.budgetOutcome = "not_required";
    } else {
      assertAiProviderEgressAllowed({
        requestKind: "inventory_vision",
        env: dependencies.env ?? (process.env as AiAssistantFeatureEnvironment),
      });
      stage = "budget";
      auditContext.budgetOutcome = "blocked";
      const gateway =
        typeof dependencies.budgetGateway === "function"
          ? dependencies.budgetGateway()
          : dependencies.budgetGateway;
      budgetSession = await AiProviderBudgetSession.reserve({
        gateway,
        actor,
        clientRequestId: requestId,
        requestKind: "inventory_vision",
        locale: input.locale,
        content: input.image_data_url,
        env: dependencies.env ?? (process.env as AiAssistantFeatureEnvironment),
      });
      auditContext.reservedMicroUsd = budgetSession.reservedMicroUsd;
      auditContext.budgetOutcome = budgetSession.outcome;
    }

    stage = "provider";
    const result = await provider.recognizeInventoryLabel({
      imageDataUrl: input.image_data_url,
      mimeType: input.mime_type,
      locale: input.locale,
      safetyIdentifier,
      signal: createAiProviderSignal(dependencies.requestSignal, runtimePolicy.providerDeadlineMs),
      fixtureKey: process.env.NODE_ENV === "production" ? undefined : input.fixture_key,
    });
    auditContext.provider = result.metadata.provider;
    auditContext.modelVersion = result.metadata.model;
    auditContext.inputTokens = result.metadata.usage?.inputTokens;
    auditContext.cachedInputTokens = result.metadata.usage?.cachedInputTokens;
    auditContext.cacheWriteTokens = result.metadata.usage?.cacheWriteTokens;
    auditContext.outputTokens = result.metadata.usage?.outputTokens;
    auditContext.providerAttemptCount = result.metadata.attempts;
    auditContext.latencyBucket = bucketAiAssistantLatency(result.metadata.latencyMs);

    stage = "protocol";
    if (result.metadata.provider === "openai") {
      if (!budgetSession) throw aiBudgetUnavailableError();
      auditContext.pricingVersion = AI_PRICING_VERSION;
      await budgetSession.settleCompleted(result.metadata);
      auditContext.estimatedMicroUsd = budgetSession.estimatedMicroUsd;
      auditContext.budgetOutcome = budgetSession.outcome;
    } else {
      auditContext.budgetOutcome = "not_required";
    }
    const recognition = aiInventoryRecognitionSchema.safeParse(result.recognition);
    if (!recognition.success) throw visionProtocolError();
    response = aiInventoryVisionResponseSchema.parse({
      request_id: requestId,
      contract_version: AI_ASSISTANT_CONTRACT_VERSION,
      recognition: recognition.data,
      provider: result.metadata.provider,
      model_version: result.metadata.model,
      generated_at: (dependencies.now ?? (() => new Date()))().toISOString(),
    });
  } catch (caught) {
    if (budgetSession) {
      await budgetSession.settleAfterFailure(caught);
      auditContext.estimatedMicroUsd = budgetSession.estimatedMicroUsd;
      auditContext.budgetOutcome = budgetSession.outcome;
    }
    const error = normalizeVisionAssistantError(
      budgetSession?.settlementError ?? caught,
      stage,
      dependencies.requestSignal,
    );
    await writeRequiredAudit({
      actor,
      requestId,
      status: auditStatusFor(error),
      errorCode: error.code,
      promptVersion: AI_INVENTORY_RECOGNITION_PROMPT_VERSION,
      schemaVersion: AI_ASSISTANT_CONTRACT_VERSION,
      ...auditContext,
    });
    throw error;
  }

  await writeRequiredAudit({
    actor,
    requestId,
    status: "succeeded",
    promptVersion: AI_INVENTORY_RECOGNITION_PROMPT_VERSION,
    schemaVersion: AI_ASSISTANT_CONTRACT_VERSION,
    resultCount:
      Object.values(response.recognition.fields).filter((candidate) => candidate.value).length +
      response.recognition.identifiers.length,
    ...auditContext,
  });
  return response;
}

function normalizeVisionAssistantError(
  error: unknown,
  stage: "authorization" | "input" | "budget" | "provider" | "protocol",
  requestSignal?: AbortSignal,
) {
  if (error instanceof AiServiceError) return error;
  if (error instanceof AiProviderBudgetError) {
    if (error.kind === "quota") {
      return error.safeCode === "actor_minute_limit_reached"
        ? aiRequestRateLimitedError()
        : aiQuotaExhaustedError();
    }
    if (error.kind === "authorization") return aiNotAuthorizedError();
    if (error.kind === "configuration") return visionMisconfiguredError();
    return aiBudgetUnavailableError();
  }
  if (stage === "input" || error instanceof AiVisionInputValidationError) {
    return visionInvalidInputError();
  }
  if (requestSignal?.aborted && stage === "provider") return aiRequestCancelledError();
  if (stage === "provider") {
    if (error instanceof AiProviderRequestError && error.category === "cancelled") {
      return aiRequestCancelledError();
    }
    if (error instanceof AiProviderRequestError && error.category === "timeout") {
      return visionProviderTimeoutError();
    }
    if (isRateLimitedError(error)) return visionProviderRateLimitedError();
    if (isAiProviderTimeoutError(error)) return visionProviderTimeoutError();
    if (error instanceof AiProviderRequestError && error.category === "protocol") {
      return visionProtocolError();
    }
    return visionProviderUnavailableError();
  }
  if (stage === "budget") return aiBudgetUnavailableError();
  return visionProtocolError();
}

function isRateLimitedError(error: unknown) {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status === 429
  );
}

function auditStatusFor(error: AiServiceError): AiAssistantAuditStatus {
  if (error.code === "AI_NOT_AUTHORIZED" || error.code === "AI_DISABLED") return "rejected";
  if (
    error.code === "AI_PROVIDER_RATE_LIMITED" ||
    error.code === "AI_QUOTA_EXHAUSTED" ||
    error.code === "AI_RATE_LIMITED"
  ) {
    return "rate_limited";
  }
  if (error.code === "AI_REQUEST_CANCELLED") return "cancelled";
  return "failed";
}

async function writeRequiredAudit(input: WriteAiAssistantAuditInput) {
  try {
    await writeAiAssistantAudit(input);
  } catch {
    console.error("[ai-assistant] audit write unavailable", {
      requestId: input.requestId,
      event: input.event,
      status: input.status,
      errorCode: "AI_AUDIT_UNAVAILABLE",
    });
    throw aiAuditUnavailableError();
  }
}

function visionInvalidInputError() {
  return new AiServiceError("图片内容无效，请重新拍摄或使用手工录入", "AI_INVALID_INPUT", 400, {
    retryable: false,
  });
}

function visionProtocolError() {
  return new AiServiceError(
    "AI 图片识别结果无效，请使用手工录入",
    "AI_PROVIDER_PROTOCOL_ERROR",
    502,
    { retryable: true },
  );
}

function visionProviderRateLimitedError() {
  return new AiServiceError(
    "AI 图片识别当前繁忙，请稍后重试或使用手工录入",
    "AI_PROVIDER_RATE_LIMITED",
    429,
    { retryable: true },
  );
}

function visionProviderTimeoutError() {
  return new AiServiceError("AI 图片识别超时，请重试或使用手工录入", "AI_PROVIDER_TIMEOUT", 504, {
    retryable: true,
  });
}

function visionProviderUnavailableError() {
  return new AiServiceError(
    "AI 图片识别暂时不可用，请使用手工录入",
    "AI_PROVIDER_UNAVAILABLE",
    503,
    { retryable: true },
  );
}

function visionMisconfiguredError() {
  return new AiServiceError(
    "AI 图片识别尚未完成上线配置，请使用手工录入",
    "AI_MISCONFIGURED",
    503,
    { retryable: false },
  );
}
