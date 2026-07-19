import {
  AI_ASSISTANT_CONTRACT_VERSION,
  aiInventoryRecognitionSchema,
  aiOrderToolCallSchema,
} from "@/features/ai-assistant/model/contracts";
import { parseDeviceSearchIntent } from "@/entities/order";
import type {
  AiAssistantProvider,
  AiInventoryRecognitionInput,
  AiOrderPlannerInput,
} from "@/features/ai-assistant/server/provider";
import { planDeterministicOrderQuery } from "@/features/ai-assistant/server/order-intent-router";

const legacyOrderReferencePattern =
  /(?:#|RD[-\s]?|工单(?:号)?\s*)?([A-Z]{0,4}-?\d{3,}|[0-9a-f]{8}-[0-9a-f-]{27,})/i;

export class FakeAiAssistantProvider implements AiAssistantProvider {
  readonly name = "fake" as const;

  async planOrderQuery(input: AiOrderPlannerInput) {
    const startedAt = Date.now();
    const deterministic = planDeterministicOrderQuery(input);
    const legacyReference = input.message.match(legacyOrderReferencePattern)?.[1]?.trim();
    const amountReviewIntent = hasAmountReviewIntent(input.message);
    const deviceSearchIntent = parseDeviceSearchIntent(input.message);
    const toolCall =
      deterministic?.toolCall ??
      (legacyReference
        ? {
            name: "get_order_summary" as const,
            arguments: { order_reference: legacyReference },
          }
        : {
            name: "search_orders" as const,
            arguments: {
              search:
                amountReviewIntent || deviceSearchIntent ? null : extractSearchTerm(input.message),
              device_search: deviceSearchIntent,
              view: /历史|归档|archive/i.test(input.message)
                ? ("archive" as const)
                : ("active" as const),
              paid: /未付|欠款|unpaid|da pagare/i.test(input.message)
                ? ("unpaid" as const)
                : /已付|paid|pagat/i.test(input.message)
                  ? ("paid" as const)
                  : ("all" as const),
              overdue: /超时|逾期|overdue|ritardo/i.test(input.message) ? ("any" as const) : null,
              queue_group: /正在维修|处理中|processing|in lavorazione/i.test(input.message)
                ? ("processing" as const)
                : null,
              financial_review: amountReviewIntent ? ("amount_anomaly" as const) : null,
              date_filter: null,
              service_group: null,
              completed_only: false,
              parts_status: null,
              page_size: 8,
            },
          });

    return {
      toolCall: aiOrderToolCallSchema.parse(toolCall),
      metadata: {
        provider: "fake" as const,
        model: "fake-order-planner-v1",
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  async recognizeInventoryLabel(input: AiInventoryRecognitionInput) {
    const startedAt = Date.now();
    const recognition =
      input.fixtureKey === "synthetic-redmi-a7-pro-box"
        ? {
            schema_version: AI_ASSISTANT_CONTRACT_VERSION,
            fields: {
              brand: field("Redmi", "high", "包装标签品牌行", "vision"),
              model: field("A7 Pro", "high", "包装标签型号行", "vision"),
              color: field("Black", "high", "包装标签颜色", "vision"),
              ram_capacity: field("4 GB", "high", "包装标签 RAM 声明", "vision"),
              storage_capacity: field("64 GB", "high", "包装标签 ROM 声明", "vision"),
            },
            identifiers: [],
            conflicts: [],
            warnings: ["仅识别包装标签声明，不能证明盒内设备配置、真伪或所有权。"],
            label_claim_only: true,
          }
        : {
            schema_version: AI_ASSISTANT_CONTRACT_VERSION,
            fields: {
              brand: field(null, "unknown", null, "unknown"),
              model: field(null, "unknown", null, "unknown"),
              color: field(null, "unknown", null, "unknown"),
              ram_capacity: field(null, "unknown", null, "unknown"),
              storage_capacity: field(null, "unknown", null, "unknown"),
            },
            identifiers: [],
            conflicts: [],
            warnings: ["Fake provider 没有匹配该脱敏 fixture，请手工录入。"],
            label_claim_only: true,
          };

    return {
      recognition: aiInventoryRecognitionSchema.parse(recognition),
      metadata: {
        provider: "fake" as const,
        model: "fake-inventory-label-v1",
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}

function field(
  value: string | null,
  confidence: "high" | "review" | "unknown",
  evidence: string | null,
  source: "vision" | "unknown",
) {
  return { value, confidence, evidence, source };
}

function extractSearchTerm(message: string) {
  const quoted = message.match(/[“"']([^”"']{1,120})[”"']/)?.[1]?.trim();
  if (quoted) return quoted;
  const cleaned = message
    .replace(
      /帮我|请|查询|查找|查看|搜索|工单|订单|维修单|历史|归档|未付款|已付款|正在维修|处理中|超时|逾期|金额异常|金额不一致/gi,
      " ",
    )
    .replace(/(^|\s)的(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || null;
}

function hasAmountReviewIntent(message: string) {
  return /金额.{0,6}(异常|不一致|不对)|amount.{0,12}(anomal|inconsisten)|import[oi].{0,12}(anomal|incoerent)/i.test(
    message,
  );
}
