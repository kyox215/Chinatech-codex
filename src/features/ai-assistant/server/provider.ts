import type {
  AiAssistantLocale,
  AiInventoryRecognition,
  AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";

export type AiAssistantUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

export type AiAssistantProviderMetadata =
  | {
      provider: "fake";
      model: string;
      requestId?: string;
      usage?: AiAssistantUsage;
      attempts?: number;
      latencyMs: number;
    }
  | {
      provider: "openai";
      model: string;
      requestId: string;
      usage: AiAssistantUsage;
      attempts: 1;
      latencyMs: number;
    };

export type AiProviderDispatchState = "not_sent" | "sent_unknown";

/**
 * Safe provider failure metadata. The error never carries the upstream body,
 * request headers, API key, prompt, image, or provider error message.
 */
export class AiProviderRequestError extends Error {
  constructor(
    readonly category:
      | "configuration"
      | "transport"
      | "timeout"
      | "cancelled"
      | "http"
      | "protocol",
    readonly dispatchState: AiProviderDispatchState,
    options: {
      status?: number;
      metadata?: Extract<AiAssistantProviderMetadata, { provider: "openai" }>;
    } = {},
  ) {
    super(`OpenAI request failed: ${category}`);
    this.name = "AiProviderRequestError";
    this.status = options.status;
    this.metadata = options.metadata;
  }

  readonly status: number | undefined;
  readonly metadata: Extract<AiAssistantProviderMetadata, { provider: "openai" }> | undefined;
}

export type AiOrderPlannerInput = {
  message: string;
  locale: AiAssistantLocale;
  safetyIdentifier?: string;
  signal?: AbortSignal;
};

export type AiInventoryRecognitionInput = {
  clientRequestId: string;
  imageDataUrl: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  locale: AiAssistantLocale;
  safetyIdentifier?: string;
  signal?: AbortSignal;
  fixtureKey?: string;
};

export interface AiAssistantProvider {
  readonly name: "fake" | "openai";
  planOrderQuery(input: AiOrderPlannerInput): Promise<{
    toolCall: AiOrderToolCall;
    metadata: AiAssistantProviderMetadata;
  }>;
  recognizeInventoryLabel(input: AiInventoryRecognitionInput): Promise<{
    recognition: AiInventoryRecognition;
    metadata: AiAssistantProviderMetadata;
  }>;
}
