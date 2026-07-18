import type {
  AiAssistantLocale,
  AiInventoryRecognition,
  AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";

export type AiAssistantUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiAssistantProviderMetadata = {
  provider: "fake" | "openai";
  model: string;
  requestId?: string;
  usage?: AiAssistantUsage;
  latencyMs: number;
};

export type AiOrderPlannerInput = {
  message: string;
  locale: AiAssistantLocale;
  safetyIdentifier?: string;
};

export type AiInventoryRecognitionInput = {
  imageDataUrl: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  locale: AiAssistantLocale;
  safetyIdentifier?: string;
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
