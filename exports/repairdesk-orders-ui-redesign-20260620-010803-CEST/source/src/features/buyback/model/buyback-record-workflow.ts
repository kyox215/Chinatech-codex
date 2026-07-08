import type { InventoryItemStatus, InventoryListItem } from "@/lib/repairdesk/types";

import {
  buybackFunctionTestItems,
  getBuybackQuoteOffer,
  getBuybackQuotePayload,
  getBuybackRiskLevel,
  type BuybackQuoteRiskLevel,
} from "./buyback-quote";

export const buybackRecordSteps = [
  { key: "estimate", label: "估价" },
  { key: "intent", label: "确认" },
  { key: "inspection", label: "检测" },
  { key: "intake", label: "成交" },
] as const;

export interface BuybackRecordProgressStep {
  key: (typeof buybackRecordSteps)[number]["key"];
  label: string;
  completed: boolean;
  active: boolean;
}

export interface BuybackRecordProgress {
  activeStepIndex: number;
  nextAction: string;
  steps: BuybackRecordProgressStep[];
}

export type BuybackInventoryHandoffTarget =
  | "quote"
  | "inspection"
  | "risk_review"
  | "inventory"
  | "sales"
  | "closed";

export interface BuybackInventoryHandoff {
  target: BuybackInventoryHandoffTarget;
  label: string;
  detail: string;
  actionLabel: string;
  tone: "neutral" | "info" | "warning" | "success";
}

export interface BuybackRecordTaskGuidance {
  title: string;
  detail: string;
  primaryAction: string;
  checklist: string[];
  tone: "neutral" | "info" | "warning" | "success";
}

export interface BuybackRecordReadiness {
  state: "blocked" | "todo" | "ready" | "done";
  label: string;
  detail: string;
  progress: number;
  missing: string[];
}

export interface BuybackRecordPrimaryAction {
  label: string;
  detail: string;
  actionLabel: string;
  tone: "neutral" | "info" | "warning" | "success";
  canResumeQuote: boolean;
  missingCount: number;
}

export interface BuybackListSummary {
  total: number;
  pendingCount: number;
  quotedCount: number;
  purchasedCount: number;
  readyCount: number;
  reviewCount: number;
  soldCount: number;
}

export type BuybackListViewKey =
  | "all"
  | "intake"
  | "inspection"
  | "quote"
  | "review"
  | "purchased"
  | "ready"
  | "done";

export interface BuybackListView {
  key: BuybackListViewKey;
  label: string;
  shortLabel: string;
  count: number;
}

export function buildBuybackListSummary(items: InventoryListItem[]): BuybackListSummary {
  return {
    total: items.length,
    pendingCount: items.filter((item) => item.status === "intake" || item.status === "evaluating")
      .length,
    quotedCount: items.filter((item) => item.status === "offer_made").length,
    purchasedCount: items.filter((item) => item.status === "purchased").length,
    readyCount: items.filter((item) => item.status === "ready_for_sale" || item.status === "listed")
      .length,
    reviewCount: items.filter((item) => getBuybackRiskLevel(item) === "high").length,
    soldCount: items.filter((item) => item.status === "sold").length,
  };
}

export function buildBuybackListViews(items: InventoryListItem[]): BuybackListView[] {
  const summary = buildBuybackListSummary(items);
  return [
    { key: "all", label: "全部", shortLabel: "全", count: summary.total },
    { key: "intake", label: "收机", shortLabel: "收", count: countByStatuses(items, ["intake"]) },
    {
      key: "inspection",
      label: "检测",
      shortLabel: "检",
      count: countByStatuses(items, ["evaluating"]),
    },
    { key: "quote", label: "报价", shortLabel: "报", count: summary.quotedCount },
    { key: "review", label: "复核", shortLabel: "核", count: summary.reviewCount },
    { key: "purchased", label: "回收", shortLabel: "回", count: summary.purchasedCount },
    { key: "ready", label: "可售", shortLabel: "售", count: summary.readyCount },
    { key: "done", label: "完成", shortLabel: "完", count: summary.soldCount },
  ];
}

export function getBuybackListViewLabel(view: BuybackListViewKey) {
  return buybackListViewLabels[view] ?? buybackListViewLabels.all;
}

export function filterBuybackItemsByView(items: InventoryListItem[], view: BuybackListViewKey) {
  if (view === "all") return items;
  if (view === "intake") return items.filter((item) => item.status === "intake");
  if (view === "inspection") return items.filter((item) => item.status === "evaluating");
  if (view === "quote") return items.filter((item) => item.status === "offer_made");
  if (view === "review") return items.filter((item) => getBuybackRiskLevel(item) === "high");
  if (view === "purchased") return items.filter((item) => item.status === "purchased");
  if (view === "ready") {
    return items.filter((item) => item.status === "ready_for_sale" || item.status === "listed");
  }
  if (view === "done") return items.filter((item) => item.status === "sold");
  return items;
}

export function getBuybackRecordProgress(
  status: InventoryItemStatus,
  risk: BuybackQuoteRiskLevel,
): BuybackRecordProgress {
  const activeStepIndex = getBuybackRecordStepIndex(status);

  return {
    activeStepIndex,
    nextAction: getBuybackNextActionLabel(status, risk),
    steps: buybackRecordSteps.map((step, index) => ({
      ...step,
      completed: index < activeStepIndex,
      active: index === activeStepIndex,
    })),
  };
}

export function getBuybackNextActionLabel(
  status: InventoryItemStatus,
  risk: BuybackQuoteRiskLevel,
) {
  if (risk === "high") return "下一步：负责人复核风险后再成交";
  if (status === "intake") return "下一步：补充估价或客户确认";
  if (status === "evaluating") return "下一步：完成功能检测";
  if (status === "offer_made") return "下一步：等待客户确认报价";
  if (status === "purchased") return "下一步：数据抹除并整备";
  if (status === "data_wipe") return "下一步：进入整备/翻新";
  if (status === "refurbishing") return "下一步：准备上架";
  if (status === "ready_for_sale") return "下一步：售卖出库";
  if (status === "listed") return "下一步：跟进销售或预订";
  if (status === "reserved") return "下一步：确认客户取机付款";
  if (status === "sold") return "流程已完成：已售出";
  if (status === "cancelled") return "流程已结束：已取消";
  if (status === "returned") return "下一步：复检退回设备";
  if (status === "recycled") return "流程已结束：回收处理";
  return "下一步：查看库存状态";
}

export function getBuybackInventoryHandoff(
  status: InventoryItemStatus,
  risk: BuybackQuoteRiskLevel,
): BuybackInventoryHandoff {
  if (["sold", "cancelled", "recycled"].includes(status)) {
    return {
      target: "closed",
      label: status === "sold" ? "已完成" : "已结束",
      detail: status === "sold" ? "已售出，可查看记录" : "流程已结束，可保留记录",
      actionLabel: "查看记录",
      tone: status === "sold" ? "success" : "neutral",
    };
  }

  if (risk === "high") {
    return {
      target: "risk_review",
      label: "负责人复核",
      detail: "先处理账号锁、IMEI、抹除或高维修成本风险",
      actionLabel: "复核 / 继续",
      tone: "warning",
    };
  }

  if (status === "intake" || status === "offer_made") {
    return {
      target: "quote",
      label: status === "intake" ? "补全估价" : "客户确认",
      detail: status === "intake" ? "补充价格区间和客户意向" : "等待客户接受或拒绝报价",
      actionLabel: "继续报价",
      tone: status === "intake" ? "info" : "warning",
    };
  }

  if (status === "evaluating") {
    return {
      target: "inspection",
      label: "功能检测",
      detail: "按检测清单补齐功能、成色和凭证",
      actionLabel: "继续检测",
      tone: "info",
    };
  }

  if (["purchased", "data_wipe", "refurbishing", "returned"].includes(status)) {
    return {
      target: "inventory",
      label: status === "returned" ? "退回复检" : "库存整备",
      detail:
        status === "purchased" ? "成交后先资料清除，再整备上架" : "在库存模块继续清除、整备或复检",
      actionLabel: "复估 / 整备",
      tone: status === "returned" ? "warning" : "success",
    };
  }

  if (status === "ready_for_sale" || status === "listed" || status === "reserved") {
    return {
      target: "sales",
      label: "售卖跟进",
      detail: status === "reserved" ? "确认预留客户并完成售出" : "已进入可售库存，跟进挂牌或成交",
      actionLabel: "查看 / 调价",
      tone: "success",
    };
  }

  return {
    target: "inventory",
    label: "库存处理",
    detail: "在库存模块查看当前处理状态",
    actionLabel: "查看记录",
    tone: "neutral",
  };
}

export function getBuybackRecordTaskGuidance(
  status: InventoryItemStatus,
  risk: BuybackQuoteRiskLevel,
): BuybackRecordTaskGuidance {
  if (risk === "high") {
    return {
      title: "先做负责人复核",
      detail: "这台设备存在高风险，先确认账号锁、IMEI、数据抹除或维修成本，再决定是否成交。",
      primaryAction: "复核风险",
      checklist: [
        "核对账号锁 / Find My",
        "复查 IMEI 与来源风险",
        "确认数据可清除",
        "店长确认最终收购价",
      ],
      tone: "warning",
    };
  }

  if (status === "intake") {
    return {
      title: "补全简易估价",
      detail: "先选择型号、容量、电池和关键外观条件，给客户一个口头区间。",
      primaryAction: "继续估价",
      checklist: ["选择 iPhone 型号", "选择容量", "填写电池健康", "生成建议报价区间"],
      tone: "info",
    };
  }

  if (status === "offer_made") {
    return {
      title: "等待客户确认",
      detail: "客户接受后再进入完整检测和实名资料采集；客户拒绝则保留报价记录。",
      primaryAction: "客户确认",
      checklist: ["解释报价有效期", "确认客户是否接受", "接受后进入功能检测", "拒绝则关闭本次跟进"],
      tone: "warning",
    };
  }

  if (status === "evaluating") {
    return {
      title: "完成功能检测",
      detail: "逐项检测关键功能，不要跳过账号锁、IMEI、数据抹除和电池健康。",
      primaryAction: "继续检测",
      checklist: [
        "检查账号锁 / Find My",
        "核对 IMEI / 序列号",
        "测试屏幕触控与 Face ID",
        "补齐设备照片和异常说明",
      ],
      tone: "info",
    };
  }

  if (["purchased", "data_wipe", "refurbishing", "returned"].includes(status)) {
    return {
      title: status === "returned" ? "退回复检" : "进入库存整备",
      detail:
        status === "purchased"
          ? "成交后先完成数据清除和凭证归档，再进入整备或上架。"
          : "继续在库存模块完成清除、翻新、复检或整备。",
      primaryAction: status === "returned" ? "复检设备" : "库存整备",
      checklist: ["确认客户签名和证件照", "执行数据抹除", "记录翻新/维修成本", "准备上架资料"],
      tone: status === "returned" ? "warning" : "success",
    };
  }

  if (status === "ready_for_sale" || status === "listed" || status === "reserved") {
    return {
      title: "售卖跟进",
      detail:
        status === "reserved"
          ? "已有预留客户，确认付款和交付。"
          : "设备已可售，继续调价、挂牌或成交。",
      primaryAction: status === "reserved" ? "确认售出" : "查看销售",
      checklist: ["确认售价和成本", "检查挂牌资料", "跟进预留/询价客户", "成交后记录售出"],
      tone: "success",
    };
  }

  if (["sold", "cancelled", "recycled"].includes(status)) {
    return {
      title: status === "sold" ? "流程已完成" : "流程已结束",
      detail:
        status === "sold"
          ? "这台设备已售出，可查看成交记录。"
          : "这条回收记录已关闭，保留历史追溯。",
      primaryAction: "查看记录",
      checklist: ["查看价格记录", "查看凭证状态", "查看库存事件"],
      tone: status === "sold" ? "success" : "neutral",
    };
  }

  return {
    title: "查看库存状态",
    detail: "当前状态需要在库存模块继续处理。",
    primaryAction: "查看记录",
    checklist: ["核对库存状态", "查看价格和凭证", "决定下一步处理人"],
    tone: "neutral",
  };
}

export function getBuybackRecordReadiness(
  item: InventoryListItem,
  risk: BuybackQuoteRiskLevel,
): BuybackRecordReadiness {
  const quotePayload = getBuybackQuotePayload(item);
  const legacyPayload = asRecord(item.legacy_payload);
  const customerPayload = asRecord(legacyPayload.buyback_customer);
  const checksPayload = asRecord(legacyPayload.buyback_function_checks);
  const riskNotes = stringArray(quotePayload.risk_notes);
  const hardBlock = quotePayload.hard_block === true;
  const requiredCheckMissing = getRequiredCheckMissing(item, checksPayload);
  const proofMissing = getProofMissing(item, customerPayload);
  const offer = getBuybackQuoteOffer(item);
  const estimateReady = Boolean(item.model?.trim()) && offer > 0;
  const intentOutcome =
    typeof quotePayload.intent_outcome === "string" ? quotePayload.intent_outcome : "";
  const customerAccepted = intentOutcome === "accepted" || item.buyback_price > 0;

  const milestones = [
    estimateReady,
    customerAccepted || item.status === "offer_made" || isAfterQuote(item.status),
    requiredCheckMissing.length === 0 &&
      (item.status === "evaluating" || isAfterInspection(item.status)),
    proofMissing.length === 0 && isAfterPurchase(item.status),
  ];
  const progress = Math.round((milestones.filter(Boolean).length / milestones.length) * 100);

  if (["sold", "cancelled", "recycled"].includes(item.status)) {
    return {
      state: "done",
      label: item.status === "sold" ? "已完成" : "已归档",
      detail: item.status === "sold" ? "已售出，可追溯报价和凭证" : "流程已关闭，保留历史记录",
      progress: 100,
      missing: [],
    };
  }

  if (risk === "high" || hardBlock) {
    return {
      state: "blocked",
      label: "先复核风险",
      detail: riskNotes[0] ?? "存在账号锁、IMEI、抹除或高成本风险",
      progress: Math.max(progress, estimateReady ? 35 : 15),
      missing: riskNotes.length ? riskNotes.slice(0, 3) : ["负责人确认最终收购价"],
    };
  }

  if (!estimateReady || item.status === "intake") {
    const missing = [
      !item.model?.trim() ? "选择 iPhone 型号" : "",
      offer <= 0 ? "生成口头报价区间" : "",
      !item.storage_capacity ? "确认容量" : "",
    ].filter(Boolean);
    return {
      state: missing.length ? "todo" : "ready",
      label: missing.length ? "补全估价" : "等待客户意向",
      detail: missing.length ? missing[0] : "可向客户说明口头区间，确认是否继续检测",
      progress: Math.max(progress, missing.length ? 10 : 35),
      missing,
    };
  }

  if (item.status === "offer_made") {
    return {
      state: customerAccepted ? "ready" : "todo",
      label: customerAccepted ? "可进入检测" : "客户确认报价",
      detail: customerAccepted
        ? "客户已接受报价，下一步逐项检测功能"
        : "等待客户接受、拒绝或稍后再决定",
      progress: Math.max(progress, customerAccepted ? 55 : 45),
      missing: customerAccepted ? [] : ["记录客户是否接受报价"],
    };
  }

  if (item.status === "evaluating") {
    return {
      state: requiredCheckMissing.length ? "todo" : "ready",
      label: requiredCheckMissing.length ? "补齐功能检测" : "检测完成",
      detail: requiredCheckMissing.length
        ? `还缺 ${requiredCheckMissing[0]}`
        : "关键检测已处理，可登记成交资料",
      progress: Math.max(progress, requiredCheckMissing.length ? 60 : 75),
      missing: requiredCheckMissing.slice(0, 4),
    };
  }

  if (["purchased", "data_wipe", "refurbishing", "returned"].includes(item.status)) {
    const missing = [
      ...proofMissing,
      item.data_wipe_status !== "pass" ? "数据抹除记录" : "",
    ].filter(Boolean);
    return {
      state: missing.length ? "todo" : "ready",
      label: item.status === "returned" ? "退回复检" : missing.length ? "补齐成交凭证" : "库存整备",
      detail: missing.length ? `还缺 ${missing[0]}` : "资料齐全，继续清除、整备或上架",
      progress: Math.max(progress, missing.length ? 80 : 90),
      missing: missing.slice(0, 4),
    };
  }

  if (item.status === "ready_for_sale" || item.status === "listed" || item.status === "reserved") {
    return {
      state: "ready",
      label: item.status === "reserved" ? "确认售出" : "可售跟进",
      detail:
        item.status === "reserved"
          ? "已有预留客户，确认交付与收款"
          : "已进入可售库存，跟进挂牌或调价",
      progress: Math.max(progress, 92),
      missing: [],
    };
  }

  return {
    state: "todo",
    label: "查看库存状态",
    detail: "当前状态需要进入库存记录确认下一步",
    progress,
    missing: ["核对库存状态"],
  };
}

export function getBuybackRecordPrimaryAction(
  item: InventoryListItem,
  risk: BuybackQuoteRiskLevel,
): BuybackRecordPrimaryAction {
  const readiness = getBuybackRecordReadiness(item, risk);
  const handoff = getBuybackInventoryHandoff(item.status, risk);
  const guidance = getBuybackRecordTaskGuidance(item.status, risk);
  const canResumeQuote =
    handoff.target === "quote" ||
    handoff.target === "inspection" ||
    handoff.target === "risk_review";

  if (readiness.state === "blocked") {
    return {
      label: readiness.label,
      detail: readiness.detail,
      actionLabel: "复核风险",
      tone: "warning",
      canResumeQuote,
      missingCount: readiness.missing.length,
    };
  }

  if (readiness.state === "done") {
    return {
      label: readiness.label,
      detail: readiness.detail,
      actionLabel: "查看记录",
      tone: "success",
      canResumeQuote: false,
      missingCount: 0,
    };
  }

  if (readiness.state === "todo") {
    const firstMissing = readiness.missing[0];
    return {
      label: readiness.label,
      detail: firstMissing ? `先补：${firstMissing}` : readiness.detail,
      actionLabel: guidance.primaryAction,
      tone: guidance.tone,
      canResumeQuote,
      missingCount: readiness.missing.length,
    };
  }

  return {
    label: handoff.label,
    detail: handoff.detail,
    actionLabel: handoff.actionLabel,
    tone: handoff.tone,
    canResumeQuote,
    missingCount: readiness.missing.length,
  };
}

export function getBuybackRecordStepIndex(status: InventoryItemStatus) {
  if (status === "intake") return 0;
  if (status === "offer_made") return 1;
  if (status === "evaluating") return 2;
  if (
    status === "purchased" ||
    status === "data_wipe" ||
    status === "refurbishing" ||
    status === "ready_for_sale" ||
    status === "listed" ||
    status === "reserved" ||
    status === "sold"
  ) {
    return 3;
  }
  return 0;
}

const buybackListViewLabels: Record<BuybackListViewKey, string> = {
  all: "全部",
  intake: "收机",
  inspection: "检测",
  quote: "报价",
  review: "复核",
  purchased: "回收",
  ready: "可售",
  done: "完成",
};

function countByStatuses(items: InventoryListItem[], statuses: InventoryItemStatus[]) {
  const set = new Set<InventoryItemStatus>(statuses);
  return items.filter((item) => set.has(item.status)).length;
}

function getRequiredCheckMissing(item: InventoryListItem, checksPayload: Record<string, unknown>) {
  return buybackFunctionTestItems
    .filter((check) => check.required)
    .filter((check) =>
      isMissingInspectionStatus(checksPayload[check.key] ?? fallbackCheck(item, check.key)),
    )
    .map((check) => check.label);
}

function getProofMissing(item: InventoryListItem, customerPayload: Record<string, unknown>) {
  const missing = [
    !customerPayload.name && !item.customer_name ? "客户姓名" : "",
    !customerPayload.phone && !item.customer_phone ? "客户电话" : "",
    !customerPayload.document_no_masked ? "证件号码" : "",
    customerPayload.signature_captured !== true ? "客户签名" : "",
    customerPayload.id_front_captured !== true ? "证件正面照片" : "",
    customerPayload.id_back_captured !== true ? "证件反面照片" : "",
    customerPayload.device_photo_captured !== true ? "设备照片" : "",
  ].filter(Boolean);

  const legacyPayload = asRecord(item.legacy_payload);
  const devicePayload = asRecord(legacyPayload.buyback_device);
  if (devicePayload.purchase_proof === false && customerPayload.invoice_photo_captured !== true) {
    missing.push("无发票确认");
  }
  if (devicePayload.box_included === false && customerPayload.box_photo_captured !== true) {
    missing.push("无原装盒确认");
  }
  return missing;
}

function fallbackCheck(item: InventoryListItem, key: string) {
  if (key === "imei_check_status") return item.imei_check_status;
  if (key === "data_wipe_status") return item.data_wipe_status;
  return undefined;
}

function isMissingInspectionStatus(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "unchecked" ||
    value === "unknown" ||
    value === "not_applicable"
  );
}

function isAfterQuote(status: InventoryItemStatus) {
  return [
    "evaluating",
    "purchased",
    "data_wipe",
    "refurbishing",
    "ready_for_sale",
    "listed",
    "reserved",
    "sold",
  ].includes(status);
}

function isAfterInspection(status: InventoryItemStatus) {
  return [
    "purchased",
    "data_wipe",
    "refurbishing",
    "ready_for_sale",
    "listed",
    "reserved",
    "sold",
  ].includes(status);
}

function isAfterPurchase(status: InventoryItemStatus) {
  return [
    "purchased",
    "data_wipe",
    "refurbishing",
    "ready_for_sale",
    "listed",
    "reserved",
    "sold",
  ].includes(status);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
