import {
  aiOrderToolCallSchema,
  type AiAssistantLocale,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import { parseDeviceSearchIntent } from "@/entities/order";

export const AI_ORDER_DETERMINISTIC_POLICY_VERSION = "order-direct-v4" as const;

export type DeterministicOrderPlan = {
  policyVersion: typeof AI_ORDER_DETERMINISTIC_POLICY_VERSION;
  toolCall: AiOrderToolCall;
};

type SearchArguments = Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"];

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

  const reference = message.normalize("NFKC").match(referenceUtterancePattern)?.[1];
  if (reference) {
    return {
      policyVersion: AI_ORDER_DETERMINISTIC_POLICY_VERSION,
      toolCall: aiOrderToolCallSchema.parse({
        name: "get_order_summary",
        arguments: { order_reference: reference.toUpperCase() },
      }),
    };
  }

  const trusted = extractTrustedOrderSearchConstraints(message);
  const hasHighConfidenceNaturalQuery = Boolean(
    trusted.device_search ||
    trusted.date_filter ||
    trusted.service_group ||
    trusted.parts_status ||
    trusted.completed_only,
  );
  if (!hasHighConfidenceNaturalQuery) return null;
  return {
    policyVersion: AI_ORDER_DETERMINISTIC_POLICY_VERSION,
    toolCall: aiOrderToolCallSchema.parse(searchCall(trusted)),
  };
}

/**
 * High-confidence constraints independently extracted from the untrusted raw
 * utterance. They are reconciled over any model plan so the model can narrow a
 * query but cannot silently drop a concrete device/date/business constraint.
 */
export function extractTrustedOrderSearchConstraints(message: string): Partial<SearchArguments> {
  const normalized = message.normalize("NFKC");
  const constraints: Partial<SearchArguments> = {};
  const deviceSearch = parseTrustedDeviceSearch(normalized);
  if (deviceSearch) constraints.device_search = deviceSearch;

  if (/未付|欠款|未付款|unpaid|da\s+pagare|non\s+pagat/i.test(normalized)) {
    constraints.paid = "unpaid";
  } else if (/已付(?:款)?|paid|pagat[oi]/i.test(normalized)) {
    constraints.paid = "paid";
  }

  if (
    /金额.{0,6}(异常|不一致|不对)|amount.{0,12}(anomal|inconsisten)|import[oi].{0,12}(anomal|incoerent)/i.test(
      normalized,
    )
  ) {
    constraints.financial_review = "amount_anomaly";
  }
  if (/超时|逾期|overdue|in\s+ritardo/i.test(normalized)) constraints.overdue = "any";
  if (/正在维修|处理中|in\s+processing|in\s+lavorazione/i.test(normalized)) {
    constraints.queue_group = "processing";
  }

  const partsStatus = trustedPartsStatus(normalized);
  if (partsStatus) constraints.parts_status = partsStatus;

  const serviceGroup = trustedServiceGroup(normalized);
  if (serviceGroup) constraints.service_group = serviceGroup;

  const completedOnly =
    /处理过|处理完|已完成|完成的|修好|修过|换过|更换过|completed|finished|riparat[oaie]|completat[oaie]/i.test(
      normalized,
    );
  if (completedOnly) constraints.completed_only = true;

  const dateExpression = trustedDateExpression(normalized, partsStatus === "needed");
  if (dateExpression) {
    constraints.date_filter = {
      expression: dateExpression,
      field: completedOnly ? "completed_at" : "created_at",
    };
  }

  if (
    constraints.date_filter ||
    constraints.completed_only ||
    constraints.service_group ||
    /历史|归档|所有工单|all\s+orders|archive|storico|archivio/i.test(normalized)
  ) {
    constraints.view = "all";
  }

  return constraints;
}

function parseTrustedDeviceSearch(value: string) {
  const direct = parseDeviceSearchIntent(value);
  if (direct) return direct;

  const withoutNaturalLanguageModifiers = value
    .replace(
      /上(?:个)?(?:星期|周)|本周|这周|这个星期|上月|上个月|本月|这个月|这一个月|今年这个月(?:内)?|今年|今天|last\s+week|this\s+week|last\s+month|this\s+month|this\s+year|today|settimana\s+scorsa|questa\s+settimana|mese\s+scorso|questo\s+mese|quest['’]?anno|oggi/gi,
      " ",
    )
    .replace(/有什么(?:是)?|有哪些(?:是)?|有没有|有沒有|是否有|请列出|請列出/g, " ")
    .replace(/的(?=\s*[,，、;；]|\s*$)/g, "")
    .replace(
      /(?:处理过|处理完|已完成|完成的|修好|修过|换过|更换过|completed|finished|riparat[oaie]|completat[oaie]).*$/i,
      "",
    )
    .trim();

  return parseDeviceSearchIntent(withoutNaturalLanguageModifiers);
}

function trustedDateExpression(
  value: string,
  isCurrentPartsWorkQueue: boolean,
): NonNullable<SearchArguments["date_filter"]>["expression"] | null {
  if (/上(?:个)?(?:星期|周)|last\s+week|settimana\s+scorsa/i.test(value)) {
    return "previous_calendar_week";
  }
  if (/本周|这周|这个星期|this\s+week|questa\s+settimana/i.test(value)) {
    return "current_calendar_week";
  }
  if (/上月|上个月|last\s+month|mese\s+scorso/i.test(value)) {
    return "previous_calendar_month";
  }
  if (/本月|这个月|这一个月|今年这个月|this\s+month|questo\s+mese/i.test(value)) {
    return "current_calendar_month";
  }
  if (/今年|this\s+year|quest['’]?anno/i.test(value)) return "current_calendar_year";
  if (/今天|today|oggi/i.test(value)) {
    // “今天需要我下单的” describes the current work queue, not orders
    // created today. Only an explicit “今天新增/创建” should add a date.
    if (
      isCurrentPartsWorkQueue &&
      !/今天(?:新增|创建|开的)|created\s+today|creat[oaie]\s+oggi/i.test(value)
    ) {
      return null;
    }
    return "today";
  }
  return null;
}

function trustedPartsStatus(value: string): SearchArguments["parts_status"] {
  if (
    /未订配件|还没订配件|待订(?:件|配件)|待下单|需要(?:我)?下单|ricambi\s+da\s+ordinare|parts\s+to\s+order/i.test(
      value,
    )
  ) {
    return "needed";
  }
  if (/配件已订|已经下单|parts\s+ordered|ricambi\s+ordinati/i.test(value)) return "ordered";
  if (/配件(?:已)?到|到货|parts\s+arrived|ricambi\s+arrivati/i.test(value)) return "arrived";
  if (/缺货|无货|out\s+of\s+stock|esaurit[oi]/i.test(value)) return "out_of_stock";
  return null;
}

function trustedServiceGroup(value: string): SearchArguments["service_group"] {
  const patterns: Array<[NonNullable<SearchArguments["service_group"]>, RegExp]> = [
    ["display", /屏幕|换屏|显示屏|display|schermo/i],
    ["battery", /电池|battery|batteria/i],
    ["charging", /尾插|充电口|charging\s+port|connettore\s+di\s+ricarica/i],
    ["camera", /摄像头|相机|camera|fotocamera/i],
    ["liquid", /进水|液体|liquid|liquido/i],
    ["mainboard", /主板|mainboard|motherboard|scheda\s+madre/i],
    ["system", /系统|刷机|software|sistema/i],
    ["back-cover", /后盖|后壳|back\s+cover|cover\s+posteriore/i],
    ["face", /面容|指纹|face\s*id|fingerprint|impronta/i],
    ["speaker", /扬声器|听筒|speaker|altoparlante/i],
    ["microphone", /麦克风|microphone|microfono/i],
    ["button", /按键|电源键|音量键|button|tasto/i],
  ];
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
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
      date_filter: null,
      service_group: null,
      completed_only: false,
      parts_status: null,
      page_size: 8,
      ...overrides,
    },
  };
}
