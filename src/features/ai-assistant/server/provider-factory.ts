import type { AiAssistantProvider } from "@/features/ai-assistant/server/provider";
import {
  assertOpenAiExternalCallsApproved,
  getAiAssistantApiBaseUrl,
  getAiAssistantModel,
  getAiAssistantProviderName,
  type AiAssistantFeatureEnvironment,
} from "@/features/ai-assistant/server/feature-flags";
import { AiServiceError } from "@/features/ai-assistant/server/errors";
import { OpenAiResponsesProvider } from "@/features/ai-assistant/server/openai-responses-provider";
import { getAiModelRuntimePolicy } from "@/features/ai-assistant/server/runtime-policy";
import { FakeAiAssistantProvider } from "@/features/ai-assistant/testing/fake-provider";

let fakeProvider: AiAssistantProvider | undefined;

export function getAiAssistantProvider(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
  options: { fetch?: typeof fetch; now?: () => number } = {},
): AiAssistantProvider {
  try {
    if (getAiAssistantProviderName(env) === "fake") {
      fakeProvider ??= new FakeAiAssistantProvider();
      return fakeProvider;
    }
    assertOpenAiExternalCallsApproved(env);
    const orderModel = getAiAssistantModel("order_text", env);
    const visionModel = getAiAssistantModel("inventory_vision", env);
    if (
      orderModel !== getAiModelRuntimePolicy("order_text").model ||
      visionModel !== getAiModelRuntimePolicy("inventory_vision").model
    ) {
      throw new Error("OpenAI exact model policy mismatch");
    }
    return new OpenAiResponsesProvider({
      apiKey: env.OPENAI_API_KEY!.trim(),
      apiBaseUrl: getAiAssistantApiBaseUrl(env),
      orderModel,
      visionModel,
      ...options,
    });
  } catch {
    throw new AiServiceError("AI 服务配置尚未完成，请继续使用手工查询", "AI_MISCONFIGURED", 503, {
      retryable: false,
    });
  }
}
