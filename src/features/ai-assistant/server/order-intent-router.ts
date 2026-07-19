import {
  aiOrderToolCallSchema,
  type AiAssistantLocale,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import { parseDeviceSearchIntent } from "@/entities/order";
import { hasUnresolvedOrderDateExpression, parseTrustedOrderDateFilter } from "./order-query-date";

export const AI_ORDER_DETERMINISTIC_POLICY_VERSION = "order-direct-v5" as const;

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

  if (hasUnresolvedOrderDateExpression(message)) return null;

  const trusted = extractTrustedOrderSearchConstraints(message);
  const hasHighConfidenceNaturalQuery = Boolean(
    trusted.device_search ||
    trusted.date_filter ||
    trusted.financial_review ||
    trusted.overdue ||
    trusted.queue_group ||
    trusted.parts_status ||
    trusted.service_group ||
    trusted.completed_only ||
    trusted.view,
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

  const dateField = trustedDateField(normalized, completedOnly);
  const dateFilter = parseTrustedOrderDateFilter(normalized, dateField);
  const isCurrentPartsWorkQueue =
    partsStatus === "needed" &&
    dateFilter?.expression === "today" &&
    !/今天(?:新增|创建|建立|开的)|created\s+today|creat[oaie]\s+oggi/i.test(normalized);
  if (dateFilter && !isCurrentPartsWorkQueue) {
    constraints.date_filter = dateFilter;
  }

  if (
    constraints.date_filter ||
    constraints.completed_only ||
    constraints.service_group ||
    hasExplicitAllOrderScope(normalized)
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
      /上(?:个)?(?:星期|周)|本周|这周|这个星期|上月|上个月|本月|这个月|这一个月|今年这个月(?:内)?|上季度|本季度|去年|今年|昨天|今天|last\s+week|this\s+week|last\s+month|this\s+month|last\s+quarter|this\s+quarter|last\s+year|this\s+year|yesterday|today|settimana\s+scorsa|questa\s+settimana|mese\s+scorso|questo\s+mese|trimestre\s+scorso|questo\s+trimestre|anno\s+scorso|quest['’]?anno|ieri|oggi/gi,
      " ",
    )
    .replace(
      /(?:最近|近|过去|過去|前)?\s*(?:半|[零〇一二两兩三四五六七八九十百\d]+)\s*(?:天|日|周|星期|个?月|個?月|年)(?:内|內|以内|以內)?/gi,
      " ",
    )
    .replace(
      /\d{4}年\d{1,2}月\d{1,2}日?|\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g,
      " ",
    )
    .replace(
      /\b(?:19\d{2}|20\d{2}|21\d{2})\s*年(?:\s*(?:1[0-2]|0?[1-9])\s*月|\s*第?\s*[1-4一二三四]\s*(?:季度|季))?|\b(?:19\d{2}|20\d{2}|21\d{2})(?:[-/](?:1[0-2]|0?[1-9])|\s*Q\s*[1-4])/gi,
      " ",
    )
    .replace(
      /从|自|到|至|截至|截止|之前|以前|之后|以后|以来|\b(?:from|to|between|and|before|after|since|through)\b/gi,
      " ",
    )
    .replace(
      /有什么(?:是)?|有哪些(?:是)?|有没有|有沒有|是否有|请列出|請列出|检查|檢查|检索|檢索|筛选|篩選/g,
      " ",
    )
    .replace(/所有(?:的)?|全部(?:的)?|全部日期|所有日期/g, " ")
    .replace(/^\s*的\s*/, "")
    .replace(/的(?=\s*[,，、;；]|\s*$)/g, "")
    .replace(
      /(?:处理过|处理完|已完成|完成的|修好|修过|换过|更换过|completed|finished|riparat[oaie]|completat[oaie]).*$/i,
      "",
    )
    .trim();

  return parseDeviceSearchIntent(withoutNaturalLanguageModifiers);
}

function trustedDateField(
  value: string,
  completedOnly: boolean,
): NonNullable<SearchArguments["date_filter"]>["field"] {
  if (/更新|变更|变化|updated|aggiornat/i.test(value)) return "updated_at";
  if (completedOnly || /完成时间|修好时间|completed\s+at|data\s+di\s+completamento/i.test(value)) {
    return "completed_at";
  }
  return "created_at";
}

export function hasExplicitAllOrderScope(value: string) {
  return /历史|归档|所有(?:的)?(?:工单|工單|订单|訂單|维修单|維修單)?|全部(?:的)?(?:工单|工單|订单|訂單|维修单|維修單|日期|时间)?|从开店到现在|all\s+orders|all\s+time|archive|storico|archivio/i.test(
    value,
  );
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
