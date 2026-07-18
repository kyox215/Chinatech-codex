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
import { AI_PRICING_VERSION, estimateAiUsageMicroUsd } from "./cost-policy";
import {
  AiServiceError,
  aiAuditUnavailableError,
  aiDisabledError,
  aiNotAuthorizedError,
} from "./errors";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import type { AiAssistantProvider } from "./provider";
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
  const requestId = randomUUID();
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
  let stage: "authorization" | "input" | "provider" | "protocol" = "authorization";

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

    await (dependencies.consumeQuota ?? consumeAiAssistantRequestQuota)({
      actor,
      env: dependencies.env,
      now: dependencies.now,
    });

    stage = "provider";
    const provider =
      typeof dependencies.provider === "function" ? dependencies.provider() : dependencies.provider;
    if (provider.name !== "fake") throw visionMisconfiguredError();
    auditContext.provider = provider.name;
    const runtimePolicy = getAiModelRuntimePolicy("inventory_vision");
    const safetyIdentifier = createAiSafetyIdentifierIfConfigured(actor, dependencies.env);
    auditContext.policyVersion = runtimePolicy.policyVersion;
    auditContext.safetyIdentifierPresent = Boolean(safetyIdentifier);
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
      const usage = result.metadata.usage;
      if (usage?.inputTokens === undefined || usage.outputTokens === undefined) {
        throw visionProtocolError();
      }
      auditContext.pricingVersion = AI_PRICING_VERSION;
      auditContext.estimatedMicroUsd = estimateAiUsageMicroUsd({
        model: result.metadata.model,
        usage: {
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens ?? 0,
          cacheWriteTokens: usage.cacheWriteTokens ?? 0,
          outputTokens: usage.outputTokens,
        },
      });
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
    const error = normalizeVisionAssistantError(caught, stage);
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
  stage: "authorization" | "input" | "provider" | "protocol",
) {
  if (error instanceof AiServiceError) return error;
  if (stage === "input" || error instanceof AiVisionInputValidationError) {
    return visionInvalidInputError();
  }
  if (stage === "provider") {
    if (isRateLimitedError(error)) return visionProviderRateLimitedError();
    if (isAiProviderTimeoutError(error)) return visionProviderTimeoutError();
    return visionProviderUnavailableError();
  }
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
