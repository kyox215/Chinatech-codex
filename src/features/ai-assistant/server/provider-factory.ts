import type { AiAssistantProvider } from "@/features/ai-assistant/server/provider";
import {
  assertOpenAiExternalCallsApproved,
  getAiAssistantProviderName,
  type AiAssistantFeatureEnvironment,
} from "@/features/ai-assistant/server/feature-flags";
import { AiServiceError } from "@/features/ai-assistant/server/errors";
import { FakeAiAssistantProvider } from "@/features/ai-assistant/testing/fake-provider";

let fakeProvider: AiAssistantProvider | undefined;

export function getAiAssistantProvider(
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
): AiAssistantProvider {
  if (getAiAssistantProviderName(env) === "fake") {
    fakeProvider ??= new FakeAiAssistantProvider();
    return fakeProvider;
  }

  try {
    assertOpenAiExternalCallsApproved(env);
  } catch {
    throw new AiServiceError("AI 服务配置尚未完成，请继续使用手工查询", "AI_MISCONFIGURED", 503, {
      retryable: false,
    });
  }

  throw new AiServiceError(
    "OpenAI provider 尚未通过依赖门禁，请继续使用手工查询",
    "AI_MISCONFIGURED",
    503,
    { retryable: false },
  );
}
