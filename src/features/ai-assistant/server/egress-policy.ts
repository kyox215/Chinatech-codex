import type { AiAssistantRequestKind } from "./cost-policy";
import { AiServiceError } from "./errors";
import {
  assertOpenAiRequestDataApproved,
  type AiAssistantFeatureEnvironment,
} from "./feature-flags";

const highRiskOrderPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\d[\s().+-]*){7,}\b/,
  /\b\d{14,16}\b/,
  /\b(?:R\d{7,12}|RD-\d{5,12})\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /[“"'][^”"']{1,120}[”"']/,
  /(?:查找|查询|搜索|查看|find|lookup|show|cerca|trova|mostra)\s+[\p{L}][\p{L}'-]{1,60}\s*(?:的|'s\b)/iu,
];

export function assertAiProviderEgressAllowed({
  requestKind,
  env,
  orderMessage,
}: {
  requestKind: AiAssistantRequestKind;
  env: AiAssistantFeatureEnvironment;
  orderMessage?: string;
}) {
  try {
    assertOpenAiRequestDataApproved(requestKind, env);
  } catch {
    throw new AiServiceError(
      "当前数据类型尚未批准发送至外部 AI，请使用本地或手工方式",
      "AI_MISCONFIGURED",
      503,
      { retryable: false },
    );
  }
  if (
    requestKind === "order_text" &&
    orderMessage &&
    highRiskOrderPatterns.some((pattern) => pattern.test(orderMessage.normalize("NFKC")))
  ) {
    throw new AiServiceError(
      "这条查询可能包含客户或设备敏感信息，请改用订单号直查或手工筛选",
      "AI_SENSITIVE_INPUT",
      400,
      { retryable: false },
    );
  }
}
