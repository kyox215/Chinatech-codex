import {
  aiOrderToolCallSchema,
  type AiAssistantLocale,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import { parseDeviceSearchIntent } from "@/entities/order";

export const AI_ORDER_DETERMINISTIC_POLICY_VERSION = "order-direct-v3" as const;

export type DeterministicOrderPlan = {
  policyVersion: typeof AI_ORDER_DETERMINISTIC_POLICY_VERSION;
  toolCall: AiOrderToolCall;
};

const referenceUtterancePattern = new RegExp(
  [
    "^\\s*",
    "(?:(?:帮我|请|please|per\\s+favore)\\s*)?",
    "(?:(?:查|查询|查看|查找|搜索|find|lookup|show|cerca|trova|mostra)\\s*)?",
    "(?:(?:工单|订单|维修单|order|ordine)\\s*(?:号|number|numero)?\\s*)?",
    "#?\\s*",
    "(R\\d{7,12}|RD-\\d{5,12}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
    "\\s*[?.!。！？]*\\s*$",
  ].join(""),
  "i",
);

const lockedSearchPlans = new Map<string, AiOrderToolCall>([
  ["查找未付款工单", searchCall({ paid: "unpaid" })],
  ["查看逾期工单", searchCall({ overdue: "any" })],
  ["搜索正在维修的订单", searchCall({ queue_group: "processing" })],
  ["有没有什么是金额异常的", searchCall({ financial_review: "amount_anomaly" })],
  ["查看金额异常工单", searchCall({ financial_review: "amount_anomaly" })],
  ["查找金额异常工单", searchCall({ financial_review: "amount_anomaly" })],
  ["有哪些金额不一致的工单", searchCall({ financial_review: "amount_anomaly" })],
  ["find unpaid orders", searchCall({ paid: "unpaid" })],
  ["show overdue orders", searchCall({ overdue: "any" })],
  ["search orders in processing", searchCall({ queue_group: "processing" })],
  ["show orders with amount anomalies", searchCall({ financial_review: "amount_anomaly" })],
  ["find orders with inconsistent amounts", searchCall({ financial_review: "amount_anomaly" })],
  ["trova ordini non pagati", searchCall({ paid: "unpaid" })],
  ["mostra ordini in ritardo", searchCall({ overdue: "any" })],
  ["cerca ordini in lavorazione", searchCall({ queue_group: "processing" })],
  ["mostra ordini con importi anomali", searchCall({ financial_review: "amount_anomaly" })],
  ["trova ordini con importi incoerenti", searchCall({ financial_review: "amount_anomaly" })],
]);

/**
 * Resolves only versioned, unambiguous order intents. Names, phone numbers,
 * IMEIs, partial references and free-form filters intentionally fall through
 * to the provider planner.
 */
export function planDeterministicOrderQuery({
  message,
}: {
  message: string;
  locale: AiAssistantLocale;
}): DeterministicOrderPlan | null {
  const normalized = normalizeUtterance(message);
  const locked = lockedSearchPlans.get(normalized);
  if (locked) {
    return {
      policyVersion: AI_ORDER_DETERMINISTIC_POLICY_VERSION,
      toolCall: aiOrderToolCallSchema.parse(locked),
    };
  }

  const deviceSearch = parseDeviceSearchIntent(message);
  if (deviceSearch) {
    return {
      policyVersion: AI_ORDER_DETERMINISTIC_POLICY_VERSION,
      toolCall: aiOrderToolCallSchema.parse(searchCall({ device_search: deviceSearch })),
    };
  }

  const reference = message.normalize("NFKC").match(referenceUtterancePattern)?.[1];
  if (!reference) return null;
  return {
    policyVersion: AI_ORDER_DETERMINISTIC_POLICY_VERSION,
    toolCall: aiOrderToolCallSchema.parse({
      name: "get_order_summary",
      arguments: { order_reference: reference.toUpperCase() },
    }),
  };
}

function normalizeUtterance(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[?.!。！？]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function searchCall(
  overrides: Partial<Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]>,
): AiOrderToolCall {
  return {
    name: "search_orders",
    arguments: {
      search: null,
      device_search: null,
      view: "active",
      paid: "all",
      overdue: null,
      queue_group: null,
      financial_review: null,
      page_size: 8,
      ...overrides,
    },
  };
}
