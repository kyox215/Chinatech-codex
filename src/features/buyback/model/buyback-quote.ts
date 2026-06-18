import type {
  CreateInventoryIntakeInput,
  InventoryCheckStatus,
  InventoryCosmeticGrade,
  InventoryFunctionalGrade,
  InventoryListItem,
  InventoryQualityCheckInput,
  UpdateInventoryItemInput,
} from "@/lib/repairdesk/types";

import { estimateAppleMarketPricing, type AppleMarketPricingSuggestion } from "./apple-price-guide";

export const buybackQuoteSteps = [
  { key: "estimate", label: "简易估价" },
  { key: "intent", label: "客户确认" },
  { key: "function", label: "功能检测" },
  { key: "intake", label: "成交资料" },
] as const;

export type BuybackQuoteStep = (typeof buybackQuoteSteps)[number]["key"];
export type BuybackQuoteRiskLevel = "low" | "medium" | "high";
export type BuybackInspectionStatus = "pass" | "fail" | "unchecked" | "not_applicable";
export type BuybackCustomerIntentOutcome = "undecided" | "accepted" | "rejected" | "deferred";
export type BuybackCosmeticGrade = "s" | "a_plus" | "a" | "b" | "c" | "d";
export type BuybackAttachmentKind =
  | "device_photo"
  | "id_front"
  | "id_back"
  | "signature"
  | "invoice_photo"
  | "box_photo";

export interface BuybackQuoteDraft {
  customer_name: string;
  customer_phone: string;
  customer_document_type: "id_card" | "passport" | "residence_permit" | "driver_license" | "other";
  customer_document_no: string;
  customer_signature_status: "pending" | "signed";
  customer_signature_note: string;
  brand: string;
  model: string;
  storage_capacity: string;
  color: string;
  serial_or_imei: string;
  purchase_region: string;
  warranty_status: string;
  market_price: string;
  target_profit: string;
  estimated_repair_cost: string;
  cosmetic_grade: BuybackCosmeticGrade;
  screen_condition: "normal" | "light_scratches" | "deep_scratches" | "cracked" | "display_issue";
  body_condition: "normal" | "light_wear" | "heavy_wear" | "bent";
  battery_health: string;
  imei_check_status: BuybackInspectionStatus;
  face_id_status: BuybackInspectionStatus;
  screen_display_status: BuybackInspectionStatus;
  touch_status: BuybackInspectionStatus;
  front_camera_status: BuybackInspectionStatus;
  back_camera_status: BuybackInspectionStatus;
  camera_status: BuybackInspectionStatus;
  flash_status: BuybackInspectionStatus;
  charging_status: BuybackInspectionStatus;
  wireless_charging_status: BuybackInspectionStatus;
  microphone_status: BuybackInspectionStatus;
  receiver_status: BuybackInspectionStatus;
  speaker_status: BuybackInspectionStatus;
  buttons_status: BuybackInspectionStatus;
  vibration_status: BuybackInspectionStatus;
  wifi_status: BuybackInspectionStatus;
  bluetooth_status: BuybackInspectionStatus;
  cellular_status: BuybackInspectionStatus;
  gps_status: BuybackInspectionStatus;
  nfc_status: BuybackInspectionStatus;
  true_tone_status: BuybackInspectionStatus;
  water_damage_status: BuybackInspectionStatus;
  repair_history_status: BuybackInspectionStatus;
  data_wipe_status: BuybackInspectionStatus;
  account_unlocked: boolean;
  activation_lock_off: boolean;
  purchase_proof: boolean;
  box_included: boolean;
  customer_intent_outcome: BuybackCustomerIntentOutcome;
  customer_intent_confirmed: boolean;
  device_photo_captured: boolean;
  id_front_captured: boolean;
  id_back_captured: boolean;
  signature_captured: boolean;
  invoice_photo_captured: boolean;
  box_photo_captured: boolean;
  manual_offer: string;
  manual_reason: string;
  quote_valid_days: string;
}

export interface BuybackQuoteDeduction {
  key: string;
  label: string;
  amount: number;
}

export interface BuybackCosmeticAssessment {
  grade: BuybackCosmeticGrade;
  label: string;
  score: number;
  summary: string;
  signals: string[];
}

export interface BuybackInspectionSummaryItem {
  label: string;
  value: string;
  tone: "success" | "warn" | "danger" | "neutral";
}

export interface BuybackRepairPlanItem {
  key: string;
  label: string;
  detail: string;
  priority: "low" | "medium" | "high";
}

export interface BuybackRepairPlan {
  issueSummary: string;
  items: BuybackRepairPlanItem[];
  estimatedRepairCost: number;
}

export interface BuybackQuoteResult {
  resaleReference: number;
  marketMin: number;
  marketMax: number;
  suggestedLow: number;
  suggestedHigh: number;
  systemOffer: number;
  finalOffer: number;
  pricingFloor: number;
  pricingCeiling: number;
  estimatedRepairCost: number;
  targetProfit: number;
  expectedProfit: number;
  deductions: BuybackQuoteDeduction[];
  repairPlan: BuybackRepairPlan;
  riskLevel: BuybackQuoteRiskLevel;
  riskNotes: string[];
  approvalReasons: string[];
  hardBlock: boolean;
  validDays: number;
  inspectionItems: BuybackInspectionSummaryItem[];
  cosmeticAssessment: BuybackCosmeticAssessment;
  marketSuggestion?: AppleMarketPricingSuggestion;
}

export interface BuybackIntakeValidation {
  canSave: boolean;
  missing: string[];
  hardBlockReasons: string[];
}

export interface BuybackBatteryBand {
  key: string;
  label: string;
  value: string;
  rangeLabel: string;
  helper: string;
  deduction: number;
  scorePenalty: number;
}

export const buybackBatteryBands: BuybackBatteryBand[] = [
  {
    key: "b100",
    label: "100%",
    value: "100",
    rangeLabel: "满电池健康",
    helper: "接近新机，不扣减",
    deduction: 0,
    scorePenalty: 0,
  },
  {
    key: "b97_99",
    label: "97-99%",
    value: "98",
    rangeLabel: "高健康",
    helper: "轻微折价",
    deduction: 5,
    scorePenalty: 1,
  },
  {
    key: "b94_96",
    label: "94-96%",
    value: "95",
    rangeLabel: "高健康",
    helper: "小幅扣减",
    deduction: 10,
    scorePenalty: 2,
  },
  {
    key: "b91_93",
    label: "91-93%",
    value: "92",
    rangeLabel: "健康良好",
    helper: "开始折价",
    deduction: 15,
    scorePenalty: 4,
  },
  {
    key: "b88_90",
    label: "88-90%",
    value: "89",
    rangeLabel: "正常可售",
    helper: "轻度扣减",
    deduction: 22,
    scorePenalty: 6,
  },
  {
    key: "b85_87",
    label: "85-87%",
    value: "86",
    rangeLabel: "正常可售",
    helper: "中轻度扣减",
    deduction: 30,
    scorePenalty: 9,
  },
  {
    key: "b82_84",
    label: "82-84%",
    value: "83",
    rangeLabel: "临近维护",
    helper: "中等扣减",
    deduction: 40,
    scorePenalty: 12,
  },
  {
    key: "b79_81",
    label: "79-81%",
    value: "80",
    rangeLabel: "电池偏低",
    helper: "明显扣减",
    deduction: 55,
    scorePenalty: 18,
  },
  {
    key: "b76_78",
    label: "76-78%",
    value: "77",
    rangeLabel: "电池偏低",
    helper: "高扣减",
    deduction: 70,
    scorePenalty: 24,
  },
  {
    key: "b73_75",
    label: "73-75%",
    value: "74",
    rangeLabel: "需换电池",
    helper: "按换电风险扣减",
    deduction: 85,
    scorePenalty: 30,
  },
  {
    key: "b70_72",
    label: "70-72%",
    value: "71",
    rangeLabel: "需换电池",
    helper: "强扣减并建议复核",
    deduction: 105,
    scorePenalty: 35,
  },
  {
    key: "b0_69",
    label: "<70%",
    value: "69",
    rangeLabel: "重度老化",
    helper: "极高扣减，谨慎成交",
    deduction: 130,
    scorePenalty: 42,
  },
];

const sortedBuybackBatteryBands = buybackBatteryBands
  .map((band) => ({
    band,
    floor: band.label.startsWith("<") ? 1 : Number(band.label.split("-")[0].replace("%", "")),
  }))
  .sort((a, b) => b.floor - a.floor);

const cosmeticDeductions: Record<BuybackCosmeticGrade, number> = {
  s: 0,
  a_plus: 15,
  a: 25,
  b: 55,
  c: 110,
  d: 220,
};

const cosmeticLabels: Record<BuybackCosmeticGrade, string> = {
  s: "S 接近全新",
  a_plus: "A+ 极轻微使用痕迹",
  a: "A 轻微使用痕迹",
  b: "B 明显使用痕迹",
  c: "C 重度使用痕迹",
  d: "D 仅适合拆件",
};

const screenDeductions: Record<BuybackQuoteDraft["screen_condition"], number> = {
  normal: 0,
  light_scratches: 15,
  deep_scratches: 45,
  cracked: 120,
  display_issue: 180,
};

const screenLabels: Record<BuybackQuoteDraft["screen_condition"], string> = {
  normal: "屏幕正常",
  light_scratches: "屏幕轻微划痕",
  deep_scratches: "屏幕明显划痕",
  cracked: "屏幕破裂",
  display_issue: "显示异常",
};

const bodyDeductions: Record<BuybackQuoteDraft["body_condition"], number> = {
  normal: 0,
  light_wear: 15,
  heavy_wear: 45,
  bent: 120,
};

const bodyLabels: Record<BuybackQuoteDraft["body_condition"], string> = {
  normal: "外壳正常",
  light_wear: "外观轻微磨损",
  heavy_wear: "外观明显磨损",
  bent: "机身变形",
};

const inspectionStatusLabels: Record<BuybackInspectionStatus, string> = {
  pass: "正常",
  fail: "异常",
  unchecked: "未检测",
  not_applicable: "不适用",
};

export const buybackFunctionTestItems = [
  { key: "imei_check_status", label: "IMEI / 序列号", required: true },
  { key: "screen_display_status", label: "屏幕显示", required: true },
  { key: "touch_status", label: "触控", required: true },
  { key: "face_id_status", label: "Face ID / Touch ID", required: false },
  { key: "front_camera_status", label: "前摄像头", required: true },
  { key: "back_camera_status", label: "后摄像头", required: true },
  { key: "flash_status", label: "闪光灯", required: false },
  { key: "microphone_status", label: "麦克风", required: true },
  { key: "receiver_status", label: "听筒", required: true },
  { key: "speaker_status", label: "扬声器", required: true },
  { key: "buttons_status", label: "按键 / 静音键", required: true },
  { key: "vibration_status", label: "震动", required: false },
  { key: "charging_status", label: "充电口", required: true },
  { key: "wireless_charging_status", label: "无线充电", required: false },
  { key: "wifi_status", label: "Wi-Fi", required: true },
  { key: "bluetooth_status", label: "蓝牙", required: true },
  { key: "cellular_status", label: "蜂窝 / SIM", required: true },
  { key: "gps_status", label: "GPS", required: false },
  { key: "nfc_status", label: "NFC", required: false },
  { key: "true_tone_status", label: "True Tone", required: false },
  { key: "water_damage_status", label: "进水 / 液体", required: true },
  { key: "repair_history_status", label: "拆修痕迹", required: false },
  { key: "data_wipe_status", label: "数据抹除", required: true },
] as const satisfies readonly {
  key: keyof Pick<
    BuybackQuoteDraft,
    | "imei_check_status"
    | "screen_display_status"
    | "touch_status"
    | "face_id_status"
    | "front_camera_status"
    | "back_camera_status"
    | "flash_status"
    | "microphone_status"
    | "receiver_status"
    | "speaker_status"
    | "buttons_status"
    | "vibration_status"
    | "charging_status"
    | "wireless_charging_status"
    | "wifi_status"
    | "bluetooth_status"
    | "cellular_status"
    | "gps_status"
    | "nfc_status"
    | "true_tone_status"
    | "water_damage_status"
    | "repair_history_status"
    | "data_wipe_status"
  >;
  label: string;
  required: boolean;
}[];

export const buybackFunctionTestGroups = [
  {
    key: "identity",
    label: "身份与安全",
    hint: "先确认 IMEI、账号锁和数据抹除。",
    itemKeys: ["imei_check_status", "data_wipe_status"] as const,
  },
  {
    key: "display",
    label: "屏幕与影像",
    hint: "显示、触控、Face ID 和摄像头。",
    itemKeys: [
      "screen_display_status",
      "touch_status",
      "face_id_status",
      "front_camera_status",
      "back_camera_status",
      "flash_status",
      "true_tone_status",
    ] as const,
  },
  {
    key: "power_audio",
    label: "充电与音频",
    hint: "充电、按键、震动、麦克风和扬声器。",
    itemKeys: [
      "charging_status",
      "wireless_charging_status",
      "microphone_status",
      "receiver_status",
      "speaker_status",
      "buttons_status",
      "vibration_status",
    ] as const,
  },
  {
    key: "network_condition",
    label: "网络与痕迹",
    hint: "蜂窝网络、定位、NFC、进水和拆修。",
    itemKeys: [
      "wifi_status",
      "bluetooth_status",
      "cellular_status",
      "gps_status",
      "nfc_status",
      "water_damage_status",
      "repair_history_status",
    ] as const,
  },
] as const;

export const defaultBuybackQuoteDraft: BuybackQuoteDraft = {
  customer_name: "",
  customer_phone: "",
  customer_document_type: "id_card",
  customer_document_no: "",
  customer_signature_status: "pending",
  customer_signature_note: "",
  brand: "Apple",
  model: "",
  storage_capacity: "",
  color: "",
  serial_or_imei: "",
  purchase_region: "欧盟",
  warranty_status: "已过保",
  market_price: "",
  target_profit: "120",
  estimated_repair_cost: "0",
  cosmetic_grade: "a_plus",
  screen_condition: "normal",
  body_condition: "normal",
  battery_health: "",
  imei_check_status: "unchecked",
  face_id_status: "unchecked",
  screen_display_status: "unchecked",
  touch_status: "unchecked",
  front_camera_status: "unchecked",
  back_camera_status: "unchecked",
  camera_status: "unchecked",
  flash_status: "unchecked",
  charging_status: "unchecked",
  wireless_charging_status: "unchecked",
  microphone_status: "unchecked",
  receiver_status: "unchecked",
  speaker_status: "unchecked",
  buttons_status: "unchecked",
  vibration_status: "unchecked",
  wifi_status: "unchecked",
  bluetooth_status: "unchecked",
  cellular_status: "unchecked",
  gps_status: "unchecked",
  nfc_status: "unchecked",
  true_tone_status: "unchecked",
  water_damage_status: "unchecked",
  repair_history_status: "unchecked",
  data_wipe_status: "unchecked",
  account_unlocked: false,
  activation_lock_off: false,
  purchase_proof: false,
  box_included: false,
  customer_intent_outcome: "undecided",
  customer_intent_confirmed: false,
  device_photo_captured: false,
  id_front_captured: false,
  id_back_captured: false,
  signature_captured: false,
  invoice_photo_captured: false,
  box_photo_captured: false,
  manual_offer: "",
  manual_reason: "",
  quote_valid_days: "7",
};

export function calculateBuybackQuote(draft: BuybackQuoteDraft): BuybackQuoteResult {
  const marketSuggestion = estimateAppleMarketPricing({
    brand: draft.brand,
    model: draft.model,
    storageCapacity: draft.storage_capacity,
  });
  const resaleReference =
    positiveMoney(draft.market_price, 0) || marketSuggestion?.resaleReference || 0;
  const targetProfit = positiveMoney(draft.target_profit, 120);
  const estimatedRepairCost = positiveMoney(draft.estimated_repair_cost, 0);
  const validDays = Math.max(1, Math.round(positiveMoney(draft.quote_valid_days, 7)));
  const batteryHealth = clamp(Math.round(positiveMoney(draft.battery_health, 0)), 0, 100);
  const cosmeticAssessment = assessBuybackCosmeticGrade(draft);
  const deductions: BuybackQuoteDeduction[] = [];

  pushDeduction(
    deductions,
    "cosmetic",
    `系统成色 ${cosmeticAssessment.label}`,
    cosmeticDeductions[cosmeticAssessment.grade],
  );
  pushDeduction(
    deductions,
    "screen",
    screenLabels[draft.screen_condition],
    screenDeductions[draft.screen_condition],
  );
  pushDeduction(
    deductions,
    "body",
    bodyLabels[draft.body_condition],
    bodyDeductions[draft.body_condition],
  );

  const batteryDeduction = getBatteryDeduction(batteryHealth);
  pushDeduction(deductions, "battery", `电池健康 ${batteryHealth || "-"}%`, batteryDeduction);
  pushDeduction(
    deductions,
    "face_id",
    "Face ID / Touch ID 异常",
    draft.face_id_status === "fail" ? 80 : 0,
  );
  pushDeduction(
    deductions,
    "display",
    "屏幕显示 / 触控异常",
    draft.screen_display_status === "fail" || draft.touch_status === "fail" ? 95 : 0,
  );
  pushDeduction(
    deductions,
    "camera",
    "相机功能异常",
    hasAnyFailed(draft.front_camera_status, draft.back_camera_status, draft.camera_status) ? 45 : 0,
  );
  pushDeduction(deductions, "flash", "闪光灯异常", draft.flash_status === "fail" ? 20 : 0);
  pushDeduction(deductions, "charging", "充电功能异常", draft.charging_status === "fail" ? 35 : 0);
  pushDeduction(
    deductions,
    "audio",
    "声音 / 麦克风异常",
    hasAnyFailed(draft.microphone_status, draft.receiver_status, draft.speaker_status) ? 35 : 0,
  );
  pushDeduction(
    deductions,
    "buttons",
    "按键或震动异常",
    hasAnyFailed(draft.buttons_status, draft.vibration_status) ? 25 : 0,
  );
  pushDeduction(
    deductions,
    "network",
    "网络功能异常",
    hasAnyFailed(draft.wifi_status, draft.bluetooth_status, draft.cellular_status) ? 45 : 0,
  );
  pushDeduction(
    deductions,
    "nfc_gps",
    "定位 / NFC 异常",
    hasAnyFailed(draft.gps_status, draft.nfc_status) ? 20 : 0,
  );
  pushDeduction(
    deductions,
    "true_tone",
    "True Tone 异常",
    draft.true_tone_status === "fail" ? 15 : 0,
  );
  pushDeduction(
    deductions,
    "liquid",
    "进水或液体痕迹",
    draft.water_damage_status === "fail" ? 120 : 0,
  );
  pushDeduction(
    deductions,
    "repair_history",
    "拆修痕迹",
    draft.repair_history_status === "fail" ? 45 : 0,
  );
  pushDeduction(deductions, "proof", "缺少购买凭证", draft.purchase_proof ? 0 : 10);
  pushDeduction(deductions, "box", "缺少盒子/配件", draft.box_included ? 0 : 5);

  const riskNotes: string[] = [];
  if (!draft.customer_intent_confirmed) riskNotes.push("客户尚未确认继续检测");
  if (draft.imei_check_status === "fail") riskNotes.push("IMEI / 序列号存在风险");
  if (draft.customer_intent_confirmed && !draft.account_unlocked) {
    riskNotes.push("客户暂不能解锁设备");
  }
  if (draft.customer_intent_confirmed && !draft.activation_lock_off) {
    riskNotes.push("账号锁 / Find My / FRP 未确认关闭");
  }
  if (draft.data_wipe_status === "fail") riskNotes.push("数据无法完成抹除");
  if (!draft.purchase_proof) riskNotes.push("缺少购买凭证");
  if (!draft.box_included) riskNotes.push("缺少原装盒或主要配件");
  if (batteryHealth > 0 && batteryHealth < 80) riskNotes.push("电池健康偏低");
  if (draft.screen_condition === "cracked" || draft.screen_condition === "display_issue") {
    riskNotes.push("屏幕存在高维修成本风险");
  }
  if (draft.face_id_status === "fail") riskNotes.push("生物识别异常");
  if (
    hasAnyFailed(
      draft.front_camera_status,
      draft.back_camera_status,
      draft.camera_status,
      draft.charging_status,
    )
  ) {
    riskNotes.push("核心功能存在异常");
  }

  const hardBlock =
    (draft.customer_intent_confirmed && !draft.account_unlocked) ||
    (draft.customer_intent_confirmed && !draft.activation_lock_off) ||
    draft.imei_check_status === "fail" ||
    draft.data_wipe_status === "fail";
  const riskLevel: BuybackQuoteRiskLevel = hardBlock
    ? "high"
    : riskNotes.length >= 2
      ? "medium"
      : "low";

  const deductionTotal = deductions.reduce((sum, item) => sum + item.amount, 0);
  const rawSystemOffer = roundToFive(
    Math.max(0, resaleReference - targetProfit - estimatedRepairCost - deductionTotal),
  );
  const pricingFloor = getBuybackPricingFloor({
    resaleReference,
    estimatedRepairCost,
    hardBlock,
    marketSuggestion,
  });
  const rawPricingCeiling = getBuybackPricingCeiling({
    resaleReference,
    targetProfit,
    estimatedRepairCost,
    marketSuggestion,
  });
  const pricingCeiling = hardBlock ? rawPricingCeiling : Math.max(pricingFloor, rawPricingCeiling);
  const systemOffer = roundToFive(
    hardBlock ? rawSystemOffer : Math.min(pricingCeiling, Math.max(pricingFloor, rawSystemOffer)),
  );
  const manualOffer = positiveMoney(draft.manual_offer, 0);
  const finalOffer = manualOffer > 0 ? roundMoney(manualOffer) : systemOffer;
  const suggestedLow = hardBlock
    ? roundToFive(Math.max(0, Math.min(systemOffer, systemOffer - 25)))
    : roundToFive(Math.min(systemOffer, Math.max(pricingFloor, systemOffer - 25)));
  const suggestedHigh = hardBlock
    ? roundToFive(Math.max(systemOffer, suggestedLow))
    : roundToFive(Math.max(suggestedLow, Math.min(pricingCeiling, systemOffer + 20)));
  const marketMin = roundToFive(Math.max(0, resaleReference - 35));
  const marketMax = roundToFive(resaleReference + 45);
  const repairPlan = buildBuybackRepairPlan(draft, estimatedRepairCost, batteryHealth);

  const approvalReasons: string[] = [];
  if (manualOffer > 0 && manualOffer > suggestedHigh * 1.1) {
    approvalReasons.push("人工报价超过系统建议上限 10%");
  }
  if (finalOffer > 500) approvalReasons.push("单台报价超过 €500");
  if (riskLevel === "high") approvalReasons.push("高风险设备需要负责人复核");
  if (resaleReference - finalOffer - estimatedRepairCost < targetProfit * 0.75) {
    approvalReasons.push("预计利润低于目标利润线");
  }

  return {
    resaleReference,
    marketMin,
    marketMax,
    suggestedLow,
    suggestedHigh,
    systemOffer,
    finalOffer,
    pricingFloor,
    pricingCeiling,
    estimatedRepairCost,
    targetProfit,
    expectedProfit: roundMoney(resaleReference - finalOffer - estimatedRepairCost),
    deductions,
    repairPlan,
    riskLevel,
    riskNotes,
    approvalReasons,
    hardBlock,
    validDays,
    inspectionItems: buildInspectionItems(draft, batteryHealth, cosmeticAssessment),
    cosmeticAssessment,
    marketSuggestion,
  };
}

export function buildBuybackQuoteCreateInput(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
): CreateInventoryIntakeInput {
  const quoteExpiresAt = new Date(
    Date.now() + result.validDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    customer_name: optional(draft.customer_name),
    customer_phone: optional(draft.customer_phone),
    category: "phone",
    brand: draft.brand.trim() || "Other",
    model: draft.model.trim(),
    storage_capacity: optional(draft.storage_capacity),
    color: optional(draft.color),
    serial_or_imei: optional(draft.serial_or_imei),
    quoted_offer: result.finalOffer,
    quote_expires_at: quoteExpiresAt,
    list_price: result.resaleReference,
    buyback_price: result.finalOffer,
    repair_cost_amount: result.estimatedRepairCost,
    notes: buildBuybackQuoteNotes(draft, result),
    quote_payload: buildBuybackQuotePayload(draft, result, quoteExpiresAt, "accepted"),
  };
}

export function buildBuybackQuoteDraftInput(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
  outcome: Extract<BuybackCustomerIntentOutcome, "deferred"> = "deferred",
): CreateInventoryIntakeInput {
  const quoteExpiresAt = new Date(
    Date.now() + result.validDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    customer_name: optional(draft.customer_name),
    customer_phone: optional(draft.customer_phone),
    category: "phone",
    brand: draft.brand.trim() || "Apple",
    model: draft.model.trim(),
    storage_capacity: optional(draft.storage_capacity),
    color: optional(draft.color),
    serial_or_imei: optional(draft.serial_or_imei),
    quoted_offer: result.finalOffer,
    quote_expires_at: quoteExpiresAt,
    list_price: result.resaleReference,
    buyback_price: 0,
    repair_cost_amount: result.estimatedRepairCost,
    notes: `${buildBuybackQuoteNotes(draft, result)}\n客户意向：${intentOutcomeLabel(outcome)}`,
    quote_payload: buildBuybackQuotePayload(draft, result, quoteExpiresAt, outcome),
  };
}

export function buildBuybackQuoteUpdateInput(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
): UpdateInventoryItemInput {
  const createInput = buildBuybackQuoteCreateInput(draft, result);
  return inventoryUpdateFromIntakeInput(createInput);
}

export function buildBuybackQuoteDraftUpdateInput(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
  outcome: Extract<BuybackCustomerIntentOutcome, "deferred"> = "deferred",
): UpdateInventoryItemInput {
  const draftInput = buildBuybackQuoteDraftInput(draft, result, outcome);
  return inventoryUpdateFromIntakeInput(draftInput);
}

function inventoryUpdateFromIntakeInput(
  createInput: CreateInventoryIntakeInput,
): UpdateInventoryItemInput {
  return {
    category: createInput.category,
    brand: createInput.brand,
    model: createInput.model,
    color: createInput.color,
    storage_capacity: createInput.storage_capacity,
    serial_or_imei: createInput.serial_or_imei,
    buyback_price: createInput.buyback_price,
    list_price: createInput.list_price,
    repair_cost_amount: createInput.repair_cost_amount,
    notes: createInput.notes,
    quote_payload: createInput.quote_payload,
  };
}

function buildBuybackQuotePayload(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
  quoteExpiresAt: string,
  outcome: BuybackCustomerIntentOutcome,
) {
  return {
    buyback_quote: {
      intent_outcome: outcome,
      intent_outcome_label: intentOutcomeLabel(outcome),
      final_offer: result.finalOffer,
      system_offer: result.systemOffer,
      suggested_low: result.suggestedLow,
      suggested_high: result.suggestedHigh,
      market_min: result.marketMin,
      market_max: result.marketMax,
      pricing_floor: result.pricingFloor,
      pricing_ceiling: result.pricingCeiling,
      estimated_repair_cost: result.estimatedRepairCost,
      expected_profit: result.expectedProfit,
      risk_level: result.riskLevel,
      risk_notes: result.riskNotes,
      approval_reasons: result.approvalReasons,
      hard_block: result.hardBlock,
      deductions: result.deductions,
      quote_expires_at: quoteExpiresAt,
      market_source: result.marketSuggestion
        ? {
            model: result.marketSuggestion.matched.model,
            requested_storage_gb: result.marketSuggestion.requestedStorageGb ?? null,
            resale_reference: result.marketSuggestion.resaleReference,
            target_profit: result.marketSuggestion.targetProfit,
            confidence: result.marketSuggestion.confidence,
            source_label: result.marketSuggestion.matched.sourceLabel,
            source_url: result.marketSuggestion.matched.sourceUrl,
            observed_at: result.marketSuggestion.matched.observedAt,
            next_refresh_at: result.marketSuggestion.nextRefreshAt,
          }
        : null,
    },
    buyback_device: {
      purchase_region: draft.purchase_region,
      warranty_status: draft.warranty_status,
      battery_health: positiveMoney(draft.battery_health, 0),
      cosmetic_grade: result.cosmeticAssessment.label,
      cosmetic_grade_score: result.cosmeticAssessment.score,
      cosmetic_grade_basis: result.cosmeticAssessment.signals,
      screen_condition: screenLabels[draft.screen_condition],
      body_condition: bodyLabels[draft.body_condition],
      box_included: draft.box_included,
      purchase_proof: draft.purchase_proof,
    },
    buyback_repair_plan: {
      issue_summary: result.repairPlan.issueSummary,
      estimated_repair_cost: result.repairPlan.estimatedRepairCost,
      items: result.repairPlan.items,
      cost_basis: "pre_purchase_estimate",
    },
    buyback_function_checks: Object.fromEntries(
      buybackFunctionTestItems.map((item) => [item.key, draft[item.key]]),
    ),
    buyback_customer: {
      name: optional(draft.customer_name) ?? null,
      phone: optional(draft.customer_phone) ?? null,
      document_type: draft.customer_document_type,
      document_type_label: documentTypeLabel(draft.customer_document_type),
      document_no_masked: maskSensitiveId(draft.customer_document_no),
      signature_status: draft.customer_signature_status,
      signature_status_label: signatureStatusLabel(draft.customer_signature_status),
      signature_captured: draft.signature_captured,
      id_front_captured: draft.id_front_captured,
      id_back_captured: draft.id_back_captured,
      device_photo_captured: draft.device_photo_captured,
      invoice_photo_captured: draft.invoice_photo_captured,
      box_photo_captured: draft.box_photo_captured,
    },
  };
}

export function getBuybackQuoteOffer(item: InventoryListItem) {
  const finalOffer = getBuybackQuotePayload(item).final_offer;
  return typeof finalOffer === "number" ? finalOffer : (item.buyback_price ?? 0);
}

export function getBuybackRiskLevel(item: InventoryListItem): BuybackQuoteRiskLevel {
  return (getBuybackQuotePayload(item).risk_level as BuybackQuoteRiskLevel | undefined) ?? "low";
}

export function getBuybackQuotePayload(item: InventoryListItem) {
  const payload = item.legacy_payload?.buyback_quote;
  return isRecord(payload) ? payload : {};
}

export function buildBuybackQuoteDraftFromInventoryItem(
  item: InventoryListItem,
): BuybackQuoteDraft {
  const quotePayload = getBuybackQuotePayload(item);
  const legacyPayload = isRecord(item.legacy_payload) ? item.legacy_payload : {};
  const devicePayload = isRecord(legacyPayload.buyback_device) ? legacyPayload.buyback_device : {};
  const customerPayload = isRecord(legacyPayload.buyback_customer)
    ? legacyPayload.buyback_customer
    : {};
  const checksPayload = isRecord(legacyPayload.buyback_function_checks)
    ? legacyPayload.buyback_function_checks
    : {};
  const marketSource = isRecord(quotePayload.market_source) ? quotePayload.market_source : {};
  const intentOutcome = buybackIntentFromPayload(quotePayload.intent_outcome);
  const signatureStatus = stringFromPayload(
    customerPayload.signature_status,
    defaultBuybackQuoteDraft.customer_signature_status,
  );

  return {
    ...defaultBuybackQuoteDraft,
    customer_name: stringFromPayload(customerPayload.name, item.customer_name ?? ""),
    customer_phone: stringFromPayload(customerPayload.phone, item.customer_phone ?? ""),
    customer_signature_status: signatureStatus === "signed" ? "signed" : "pending",
    brand: item.brand || defaultBuybackQuoteDraft.brand,
    model: item.model || "",
    storage_capacity: item.storage_capacity ?? "",
    color: item.color ?? "",
    serial_or_imei: item.serial_or_imei ?? "",
    purchase_region: stringFromPayload(
      devicePayload.purchase_region,
      defaultBuybackQuoteDraft.purchase_region,
    ),
    warranty_status: stringFromPayload(
      devicePayload.warranty_status,
      defaultBuybackQuoteDraft.warranty_status,
    ),
    market_price: moneyDraftValue(
      numberFromPayload(marketSource.resale_reference) ||
        numberFromPayload(quotePayload.market_min) ||
        item.list_price,
    ),
    target_profit: moneyDraftValue(
      numberFromPayload(marketSource.target_profit) ||
        numberFromPayload(quotePayload.target_profit) ||
        Number(defaultBuybackQuoteDraft.target_profit),
    ),
    estimated_repair_cost: moneyDraftValue(item.repair_cost_amount),
    cosmetic_grade: cosmeticGradeFromPayload(devicePayload.cosmetic_grade),
    screen_condition: screenConditionFromPayload(devicePayload.screen_condition),
    body_condition: bodyConditionFromPayload(devicePayload.body_condition),
    battery_health: moneyDraftValue(
      item.battery_health ?? numberFromPayload(devicePayload.battery_health),
    ),
    imei_check_status: inspectionFromPayload(
      checksPayload.imei_check_status,
      item.imei_check_status,
    ),
    face_id_status: inspectionFromPayload(checksPayload.face_id_status),
    screen_display_status: inspectionFromPayload(checksPayload.screen_display_status),
    touch_status: inspectionFromPayload(checksPayload.touch_status),
    front_camera_status: inspectionFromPayload(checksPayload.front_camera_status),
    back_camera_status: inspectionFromPayload(checksPayload.back_camera_status),
    camera_status: inspectionFromPayload(checksPayload.camera_status),
    flash_status: inspectionFromPayload(checksPayload.flash_status),
    charging_status: inspectionFromPayload(checksPayload.charging_status),
    wireless_charging_status: inspectionFromPayload(checksPayload.wireless_charging_status),
    microphone_status: inspectionFromPayload(checksPayload.microphone_status),
    receiver_status: inspectionFromPayload(checksPayload.receiver_status),
    speaker_status: inspectionFromPayload(checksPayload.speaker_status),
    buttons_status: inspectionFromPayload(checksPayload.buttons_status),
    vibration_status: inspectionFromPayload(checksPayload.vibration_status),
    wifi_status: inspectionFromPayload(checksPayload.wifi_status),
    bluetooth_status: inspectionFromPayload(checksPayload.bluetooth_status),
    cellular_status: inspectionFromPayload(checksPayload.cellular_status),
    gps_status: inspectionFromPayload(checksPayload.gps_status),
    nfc_status: inspectionFromPayload(checksPayload.nfc_status),
    true_tone_status: inspectionFromPayload(checksPayload.true_tone_status),
    water_damage_status: inspectionFromPayload(checksPayload.water_damage_status),
    repair_history_status: inspectionFromPayload(checksPayload.repair_history_status),
    data_wipe_status: inspectionFromPayload(checksPayload.data_wipe_status, item.data_wipe_status),
    account_unlocked: item.activation_lock_status === "pass",
    activation_lock_off: item.activation_lock_status === "pass",
    purchase_proof: booleanFromPayload(
      devicePayload.purchase_proof,
      defaultBuybackQuoteDraft.purchase_proof,
    ),
    box_included: booleanFromPayload(
      devicePayload.box_included,
      defaultBuybackQuoteDraft.box_included,
    ),
    customer_intent_outcome: intentOutcome,
    customer_intent_confirmed: intentOutcome === "accepted",
    device_photo_captured: booleanFromPayload(customerPayload.device_photo_captured, false),
    id_front_captured: booleanFromPayload(customerPayload.id_front_captured, false),
    id_back_captured: booleanFromPayload(customerPayload.id_back_captured, false),
    signature_captured: booleanFromPayload(customerPayload.signature_captured, false),
    invoice_photo_captured: booleanFromPayload(customerPayload.invoice_photo_captured, false),
    box_photo_captured: booleanFromPayload(customerPayload.box_photo_captured, false),
    manual_offer: moneyDraftValue(numberFromPayload(quotePayload.final_offer)),
    manual_reason: "",
  };
}

export function buildWhatsappQuoteMessage(draft: BuybackQuoteDraft, result: BuybackQuoteResult) {
  const customer = draft.customer_name.trim() || "Cliente";
  const device = [draft.brand, draft.model, draft.storage_capacity].filter(Boolean).join(" ");
  const summary = result.deductions.length
    ? result.deductions
        .map((item) => item.label)
        .slice(0, 3)
        .join(", ")
    : "condizioni generali buone";

  return [
    `Ciao ${customer}, abbiamo completato la valutazione del tuo ${device}.`,
    "",
    `Offerta di acquisto: €${result.finalOffer.toFixed(2)}`,
    `Condizione: ${result.cosmeticAssessment.label}`,
    `Note principali: ${summary}`,
    `Validità offerta: ${result.validDays} giorni`,
    "",
    "Puoi rispondere a questo messaggio per confermare o passare in negozio.",
    "ChinaTech",
  ].join("\n");
}

export function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("39")) return digits;
  if (digits.length >= 8) return `39${digits}`;
  return "";
}

export function validateBuybackIntake(
  draft: BuybackQuoteDraft,
  result: BuybackQuoteResult,
): BuybackIntakeValidation {
  const missing: string[] = [];
  const hardBlockReasons = [
    ...result.riskNotes.filter((note) => result.hardBlock && /锁|IMEI|抹除|解锁/.test(note)),
  ];

  if (!draft.customer_intent_confirmed) missing.push("客户同意继续回收");
  if (!draft.model.trim()) missing.push("iPhone 型号");
  if (!draft.storage_capacity.trim()) missing.push("容量");
  if (!draft.serial_or_imei.trim()) missing.push("IMEI / 序列号");
  if (!draft.customer_name.trim()) missing.push("客户姓名");
  if (!normalizeWhatsappPhone(draft.customer_phone)) missing.push("客户电话");
  if (!draft.customer_document_no.trim()) missing.push("证件号码");
  if (draft.customer_signature_status !== "signed" || !draft.signature_captured) {
    missing.push("客户签名");
  }
  if (!draft.device_photo_captured) missing.push("设备照片");
  if (!draft.id_front_captured) missing.push("证件正面照片");
  if (!draft.id_back_captured) missing.push("证件反面照片");
  if (!draft.purchase_proof && !draft.invoice_photo_captured)
    missing.push("无发票时的来源确认/证件补充");
  if (!draft.box_included && !draft.box_photo_captured) missing.push("无原装盒时的确认记录");

  for (const item of buybackFunctionTestItems) {
    if (!item.required) continue;
    if (draft[item.key] === "unchecked") missing.push(`${item.label}检测`);
    if (draft[item.key] === "not_applicable") missing.push(`${item.label}不能选择不适用`);
  }
  if (draft.imei_check_status === "fail") hardBlockReasons.push("IMEI / 序列号风险，不能直接成交");
  if (!draft.activation_lock_off) hardBlockReasons.push("Find My / 账号锁未关闭，不能成交");
  if (!draft.account_unlocked) hardBlockReasons.push("客户无法解锁设备，不能成交");
  if (draft.data_wipe_status === "fail") hardBlockReasons.push("数据无法抹除，不能成交");

  return {
    canSave: missing.length === 0 && hardBlockReasons.length === 0,
    missing: Array.from(new Set(missing)),
    hardBlockReasons: Array.from(new Set(hardBlockReasons)),
  };
}

export function buildBuybackQualityCheckInput(
  draft: BuybackQuoteDraft,
): InventoryQualityCheckInput {
  return {
    screen_status: toInventoryCheckStatus(
      draft.screen_display_status === "pass" ? draft.touch_status : draft.screen_display_status,
    ),
    touch_status: toInventoryCheckStatus(draft.touch_status),
    camera_status: toInventoryCheckStatus(getCameraStatus(draft)),
    buttons_status: toInventoryCheckStatus(draft.buttons_status),
    ports_status: toInventoryCheckStatus(draft.charging_status),
    speaker_status: toInventoryCheckStatus(draft.speaker_status),
    microphone_status: toInventoryCheckStatus(draft.microphone_status),
    wifi_status: toInventoryCheckStatus(draft.wifi_status),
    bluetooth_status: toInventoryCheckStatus(draft.bluetooth_status),
    cellular_status: toInventoryCheckStatus(draft.cellular_status),
    battery_health: positiveMoney(draft.battery_health, 0) || undefined,
    cosmetic_grade: inventoryCosmeticGrade(assessBuybackCosmeticGrade(draft).grade),
    functional_grade: getFunctionalGrade(draft),
    imei_check_status: toInventoryCheckStatus(draft.imei_check_status),
    activation_lock_status: draft.activation_lock_off ? "pass" : "fail",
    data_wipe_status: toInventoryCheckStatus(draft.data_wipe_status),
    notes: buybackFunctionTestItems
      .map((item) => `${item.label}:${inspectionStatusLabels[draft[item.key]]}`)
      .join(" / "),
  };
}

function buildBuybackQuoteNotes(draft: BuybackQuoteDraft, result: BuybackQuoteResult) {
  const lines = [
    `回收报价：€${result.finalOffer.toFixed(2)}`,
    `市场参考：€${result.marketMin.toFixed(0)} - €${result.marketMax.toFixed(0)}`,
    `报价下限/上限：€${result.pricingFloor.toFixed(0)} - €${result.pricingCeiling.toFixed(0)}`,
    `风险等级：${riskLabel(result.riskLevel)}`,
    `维修计划：${result.repairPlan.issueSummary}`,
    `预计维修成本：€${result.estimatedRepairCost.toFixed(2)}`,
    `检测摘要：${result.inspectionItems.map((item) => `${item.label} ${item.value}`).join(" / ")}`,
  ];
  if (draft.manual_reason.trim()) lines.push(`人工改价原因：${draft.manual_reason.trim()}`);
  const customerLines = [
    optional(draft.customer_name) ? `客户：${draft.customer_name.trim()}` : "",
    optional(draft.customer_phone) ? `电话：${draft.customer_phone.trim()}` : "",
    optional(draft.customer_document_no)
      ? `证件：${documentTypeLabel(draft.customer_document_type)} ${maskSensitiveId(draft.customer_document_no)}`
      : "",
    `签名：${signatureStatusLabel(draft.customer_signature_status)}`,
    draft.device_photo_captured ? "设备照片：已记录" : "",
  ].filter(Boolean);
  if (customerLines.length) lines.push(`成交资料：${customerLines.join(" / ")}`);
  if (result.marketSuggestion) {
    lines.push(
      `行情参考：${result.marketSuggestion.matched.sourceLabel} ${result.marketSuggestion.matched.observedAt}，建议转售价 €${result.marketSuggestion.resaleReference}`,
    );
  }
  if (result.riskNotes.length) lines.push(`风险提示：${result.riskNotes.join("；")}`);
  return lines.join("\n");
}

function buildInspectionItems(
  draft: BuybackQuoteDraft,
  batteryHealth: number,
  cosmeticAssessment: BuybackCosmeticAssessment,
): BuybackInspectionSummaryItem[] {
  return [
    {
      label: "IMEI",
      value: statusLabel(draft.imei_check_status),
      tone: toneForInspectionStatus(draft.imei_check_status, true),
    },
    {
      label: "账号锁",
      value: draft.activation_lock_off ? "已关闭" : "未关闭",
      tone: draft.activation_lock_off ? "success" : "danger",
    },
    {
      label: "数据抹除",
      value: statusLabel(draft.data_wipe_status),
      tone: toneForInspectionStatus(draft.data_wipe_status, true),
    },
    {
      label: "屏幕",
      value:
        draft.screen_display_status === "fail" || draft.touch_status === "fail"
          ? "显示/触控异常"
          : screenLabels[draft.screen_condition],
      tone:
        draft.screen_display_status === "fail" || draft.touch_status === "fail"
          ? "danger"
          : draft.screen_condition === "normal"
            ? "success"
            : "warn",
    },
    {
      label: "电池健康",
      value: batteryHealth ? `${batteryHealth}%` : "未检测",
      tone: batteryHealth >= 85 ? "success" : batteryHealth >= 80 ? "warn" : "danger",
    },
    {
      label: "外观成色",
      value: cosmeticAssessment.label,
      tone: ["s", "a_plus", "a"].includes(cosmeticAssessment.grade) ? "success" : "warn",
    },
    {
      label: "Face ID",
      value: statusLabel(draft.face_id_status),
      tone: toneForInspectionStatus(draft.face_id_status),
    },
    {
      label: "相机功能",
      value: hasAnyFailed(draft.front_camera_status, draft.back_camera_status, draft.camera_status)
        ? "异常"
        : hasAnyUnchecked(draft.front_camera_status, draft.back_camera_status)
          ? "未检测"
          : "正常",
      tone: hasAnyFailed(draft.front_camera_status, draft.back_camera_status, draft.camera_status)
        ? "danger"
        : hasAnyUnchecked(draft.front_camera_status, draft.back_camera_status)
          ? "neutral"
          : "success",
    },
    {
      label: "充电功能",
      value: statusLabel(draft.charging_status),
      tone: toneForInspectionStatus(draft.charging_status),
    },
    {
      label: "网络",
      value: hasAnyFailed(draft.wifi_status, draft.bluetooth_status, draft.cellular_status)
        ? "异常"
        : hasAnyUnchecked(draft.wifi_status, draft.bluetooth_status, draft.cellular_status)
          ? "未检测"
          : "正常",
      tone: hasAnyFailed(draft.wifi_status, draft.bluetooth_status, draft.cellular_status)
        ? "danger"
        : hasAnyUnchecked(draft.wifi_status, draft.bluetooth_status, draft.cellular_status)
          ? "neutral"
          : "success",
    },
  ];
}

export function getBuybackBatteryBand(health: number) {
  if (health <= 0) return undefined;
  return sortedBuybackBatteryBands.find(({ floor }) => health >= floor)?.band;
}

function getBatteryDeduction(health: number) {
  return getBuybackBatteryBand(health)?.deduction ?? 0;
}

function getBuybackPricingFloor({
  resaleReference,
  estimatedRepairCost,
  hardBlock,
  marketSuggestion,
}: {
  resaleReference: number;
  estimatedRepairCost: number;
  hardBlock: boolean;
  marketSuggestion?: AppleMarketPricingSuggestion;
}) {
  if (hardBlock || resaleReference <= 0) return 0;
  const guideFloor = marketSuggestion
    ? marketSuggestion.matched.buybackFloorEur + marketSuggestion.storagePremium * 0.45
    : resaleReference * 0.28;
  const repairPressure = Math.min(estimatedRepairCost * 0.35, guideFloor * 0.45);
  return roundToFive(Math.max(20, guideFloor - repairPressure));
}

function getBuybackPricingCeiling({
  resaleReference,
  targetProfit,
  estimatedRepairCost,
  marketSuggestion,
}: {
  resaleReference: number;
  targetProfit: number;
  estimatedRepairCost: number;
  marketSuggestion?: AppleMarketPricingSuggestion;
}) {
  if (resaleReference <= 0) return 0;
  const marketCeiling =
    marketSuggestion?.preInspectionCeiling ?? resaleReference - Math.max(75, targetProfit * 0.65);
  return roundToFive(Math.max(0, marketCeiling - estimatedRepairCost * 0.25));
}

function buildBuybackRepairPlan(
  draft: BuybackQuoteDraft,
  estimatedRepairCost: number,
  batteryHealth: number,
): BuybackRepairPlan {
  const items: BuybackRepairPlanItem[] = [];
  const add = (
    key: string,
    label: string,
    detail: string,
    priority: BuybackRepairPlanItem["priority"] = "medium",
  ) => {
    if (items.some((item) => item.key === key)) return;
    items.push({ key, label, detail, priority });
  };

  if (draft.screen_condition === "deep_scratches") {
    add("screen_cosmetic", "屏幕明显划痕", "检查是否需要换屏或作为售价折扣说明", "low");
  }
  if (draft.screen_condition === "cracked") {
    add("screen_cracked", "屏幕破裂", "订购屏幕总成并记录实际换屏成本", "high");
  }
  if (draft.screen_condition === "display_issue" || draft.screen_display_status === "fail") {
    add("display_issue", "显示异常", "复测显示排线/屏幕总成，维修后再上架", "high");
  }
  if (draft.touch_status === "fail") {
    add("touch_issue", "触控异常", "检测触控层或屏幕总成，维修后复测", "high");
  }
  if (batteryHealth > 0 && batteryHealth < 82) {
    add("battery_service", "电池健康偏低", "订购电池并把实际电池成本记入维修成本", "medium");
  }
  if (draft.face_id_status === "fail") {
    add(
      "biometric_issue",
      "Face ID / Touch ID 异常",
      "标记生物识别风险，通常不建议承诺修复",
      "high",
    );
  }
  if (hasAnyFailed(draft.front_camera_status, draft.back_camera_status, draft.camera_status)) {
    add("camera_issue", "相机异常", "检测前后摄像头并记录配件成本", "medium");
  }
  if (draft.flash_status === "fail") {
    add("flash_issue", "闪光灯异常", "复测闪光灯/后摄排线", "low");
  }
  if (draft.charging_status === "fail") {
    add("charging_issue", "充电异常", "检测尾插、排线或无线充电模块", "medium");
  }
  if (hasAnyFailed(draft.microphone_status, draft.receiver_status, draft.speaker_status)) {
    add("audio_issue", "音频异常", "检测麦克风、听筒或扬声器并记录配件成本", "medium");
  }
  if (hasAnyFailed(draft.buttons_status, draft.vibration_status)) {
    add("button_vibration_issue", "按键/震动异常", "检测按键排线、静音键或震动马达", "medium");
  }
  if (hasAnyFailed(draft.wifi_status, draft.bluetooth_status, draft.cellular_status)) {
    add("network_issue", "网络功能异常", "复测 Wi-Fi/蓝牙/蜂窝网络，必要时转主板维修", "high");
  }
  if (hasAnyFailed(draft.gps_status, draft.nfc_status)) {
    add("gps_nfc_issue", "定位 / NFC 异常", "复测定位、NFC 与相关天线模块", "medium");
  }
  if (draft.water_damage_status === "fail") {
    add("liquid_damage", "进水/液体痕迹", "先做主板风险复核，必要时只按拆件处理", "high");
  }
  if (draft.repair_history_status === "fail") {
    add("repair_history", "有拆修痕迹", "记录拆修风险，维修前复查屏幕、电池和主板", "medium");
  }
  if (draft.body_condition === "heavy_wear" || draft.body_condition === "bent") {
    add(
      "housing_condition",
      draft.body_condition === "bent" ? "机身变形" : "外观重度磨损",
      "评估是否更换外壳或作为售价折扣说明",
      draft.body_condition === "bent" ? "high" : "low",
    );
  }
  if (estimatedRepairCost > 0 && items.length === 0) {
    add(
      "manual_repair_cost",
      "人工整备成本",
      "已预留维修/订货成本，维修后用实际成本覆盖",
      "medium",
    );
  }

  return {
    issueSummary: items.length
      ? items.map((item) => item.label).join(" / ")
      : "未记录明确故障，按常规清洁整备",
    items,
    estimatedRepairCost,
  };
}

function pushDeduction(items: BuybackQuoteDeduction[], key: string, label: string, amount: number) {
  if (amount <= 0) return;
  items.push({ key, label, amount: roundMoney(amount) });
}

function positiveMoney(text: string, fallback: number) {
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function roundToFive(value: number) {
  return Math.floor(roundMoney(value) / 5) * 5;
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function optional(value: string) {
  const text = value.trim();
  return text ? text : undefined;
}

function statusLabel(status: "pass" | "fail" | "unchecked" | "not_applicable") {
  return inspectionStatusLabels[status];
}

function toneForInspectionStatus(
  status: BuybackInspectionStatus,
  failIsDanger = false,
): BuybackInspectionSummaryItem["tone"] {
  if (status === "pass" || status === "not_applicable") return "success";
  if (status === "fail") return failIsDanger ? "danger" : "warn";
  return "neutral";
}

function hasAnyFailed(...statuses: BuybackInspectionStatus[]) {
  return statuses.some((status) => status === "fail");
}

function hasAnyUnchecked(...statuses: BuybackInspectionStatus[]) {
  return statuses.some((status) => status === "unchecked");
}

function aggregateStatus(...statuses: BuybackInspectionStatus[]): BuybackInspectionStatus {
  if (hasAnyFailed(...statuses)) return "fail";
  if (hasAnyUnchecked(...statuses)) return "unchecked";
  if (statuses.every((status) => status === "not_applicable")) return "not_applicable";
  return "pass";
}

function getCameraStatus(draft: BuybackQuoteDraft): BuybackInspectionStatus {
  if (draft.camera_status === "fail") return "fail";
  return aggregateStatus(draft.front_camera_status, draft.back_camera_status);
}

function toInventoryCheckStatus(status: BuybackInspectionStatus): InventoryCheckStatus {
  if (status === "not_applicable") return "unknown";
  return status;
}

export function assessBuybackCosmeticGrade(draft: BuybackQuoteDraft): BuybackCosmeticAssessment {
  const batteryHealth = clamp(Math.round(positiveMoney(draft.battery_health, 0)), 0, 100);
  const signals: string[] = [];
  let score = 100;

  const applySignal = (condition: boolean, label: string, points: number) => {
    if (!condition) return;
    score -= points;
    signals.push(label);
  };

  applySignal(draft.screen_condition === "light_scratches", "屏幕轻微划痕", 8);
  applySignal(draft.screen_condition === "deep_scratches", "屏幕明显划痕", 18);
  applySignal(draft.screen_condition === "cracked", "屏幕破裂", 40);
  applySignal(draft.screen_condition === "display_issue", "显示异常", 55);
  applySignal(draft.body_condition === "light_wear", "机身轻微磨损", 8);
  applySignal(draft.body_condition === "heavy_wear", "机身明显磨损", 22);
  applySignal(draft.body_condition === "bent", "机身变形", 45);
  applySignal(
    batteryHealth > 0 && batteryHealth < 90,
    `电池健康 ${batteryHealth}%`,
    getBatteryScorePenalty(batteryHealth),
  );
  applySignal(draft.screen_display_status === "fail", "屏幕显示功能异常", 28);
  applySignal(draft.touch_status === "fail", "触控异常", 28);
  applySignal(draft.face_id_status === "fail", "Face ID / Touch ID 异常", 16);
  applySignal(
    hasAnyFailed(draft.front_camera_status, draft.back_camera_status, draft.camera_status),
    "相机异常",
    14,
  );
  applySignal(draft.flash_status === "fail", "闪光灯异常", 8);
  applySignal(draft.charging_status === "fail", "充电口异常", 16);
  applySignal(
    hasAnyFailed(draft.microphone_status, draft.receiver_status, draft.speaker_status),
    "音频异常",
    12,
  );
  applySignal(hasAnyFailed(draft.buttons_status, draft.vibration_status), "按键/震动异常", 10);
  applySignal(
    hasAnyFailed(draft.wifi_status, draft.bluetooth_status, draft.cellular_status),
    "网络功能异常",
    14,
  );
  applySignal(
    hasAnyFailed(draft.gps_status, draft.nfc_status, draft.true_tone_status),
    "辅助功能异常",
    6,
  );
  applySignal(draft.repair_history_status === "fail", "拆修痕迹", 18);
  applySignal(draft.water_damage_status === "fail", "进水/液体痕迹", 45);

  score = clamp(score, 0, 100);
  let grade: BuybackCosmeticGrade =
    score >= 96
      ? "s"
      : score >= 90
        ? "a_plus"
        : score >= 76
          ? "a"
          : score >= 60
            ? "b"
            : score >= 45
              ? "c"
              : "d";

  if (draft.body_condition === "heavy_wear") {
    grade = capCosmeticGrade(grade, "b");
  }
  if (draft.screen_condition === "cracked") {
    grade = capCosmeticGrade(grade, "c");
  }
  if (
    draft.screen_condition === "display_issue" ||
    draft.body_condition === "bent" ||
    draft.water_damage_status === "fail"
  ) {
    grade = capCosmeticGrade(grade, "c");
  }
  if (
    hasAnyFailed(
      draft.screen_display_status,
      draft.touch_status,
      draft.charging_status,
      draft.wifi_status,
      draft.cellular_status,
    ) &&
    (draft.screen_condition === "display_issue" || draft.body_condition === "bent")
  ) {
    grade = "d";
  }

  return {
    grade,
    label: cosmeticLabels[grade],
    score,
    summary: signals.length ? signals.slice(0, 3).join("、") : "外观和核心功能暂无明显扣分",
    signals,
  };
}

function getBatteryScorePenalty(health: number) {
  return getBuybackBatteryBand(health)?.scorePenalty ?? 0;
}

function capCosmeticGrade(current: BuybackCosmeticGrade, maxGrade: BuybackCosmeticGrade) {
  const order: BuybackCosmeticGrade[] = ["s", "a_plus", "a", "b", "c", "d"];
  return order.indexOf(current) > order.indexOf(maxGrade) ? current : maxGrade;
}

function inventoryCosmeticGrade(grade: BuybackCosmeticGrade): InventoryCosmeticGrade {
  if (grade === "s") return "mint";
  if (grade === "a_plus") return "mint";
  if (grade === "a") return "good";
  if (grade === "b") return "fair";
  if (grade === "c") return "poor";
  return "for_parts";
}

function getFunctionalGrade(draft: BuybackQuoteDraft): InventoryFunctionalGrade {
  if (draft.imei_check_status === "fail" || !draft.activation_lock_off) return "failed";
  if (draft.water_damage_status === "fail" || draft.screen_condition === "display_issue") {
    return "for_parts";
  }
  if (
    buybackFunctionTestItems.some((item) => {
      const status = draft[item.key];
      return item.required && status === "fail";
    })
  ) {
    return "needs_repair";
  }
  if (
    buybackFunctionTestItems.some((item) => {
      const status = draft[item.key];
      return item.required && status === "unchecked";
    })
  ) {
    return "untested";
  }
  return "passed";
}

function maskSensitiveId(value: string) {
  const text = value.trim();
  if (!text) return null;
  if (text.length <= 4) return "*".repeat(text.length);
  return `${text.slice(0, 2)}${"*".repeat(Math.max(2, text.length - 4))}${text.slice(-2)}`;
}

function documentTypeLabel(type: BuybackQuoteDraft["customer_document_type"]) {
  if (type === "passport") return "护照";
  if (type === "residence_permit") return "居留卡";
  if (type === "driver_license") return "驾照";
  if (type === "other") return "其他证件";
  return "身份证";
}

function signatureStatusLabel(status: BuybackQuoteDraft["customer_signature_status"]) {
  return status === "signed" ? "已签名" : "待签名";
}

function intentOutcomeLabel(outcome: BuybackCustomerIntentOutcome) {
  if (outcome === "accepted") return "客户接受，继续检测";
  if (outcome === "deferred") return "客户考虑中";
  if (outcome === "rejected") return "客户不接受";
  return "未确认";
}

function riskLabel(risk: BuybackQuoteRiskLevel) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  return "低风险";
}

function stringFromPayload(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberFromPayload(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function moneyDraftValue(value: unknown) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (numberValue <= 0) return "";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

function booleanFromPayload(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function inspectionFromPayload(
  value: unknown,
  fallback?: InventoryCheckStatus,
): BuybackInspectionStatus {
  if (value === "pass" || value === "fail" || value === "unchecked" || value === "not_applicable") {
    return value;
  }
  if (fallback === "pass" || fallback === "fail" || fallback === "unchecked") return fallback;
  return "unchecked";
}

function buybackIntentFromPayload(value: unknown): BuybackCustomerIntentOutcome {
  if (value === "accepted" || value === "rejected" || value === "deferred") return value;
  return "undecided";
}

function cosmeticGradeFromPayload(value: unknown): BuybackCosmeticGrade {
  if (typeof value !== "string") return defaultBuybackQuoteDraft.cosmetic_grade;
  const entry = Object.entries(cosmeticLabels).find(([, label]) => label === value);
  return (
    (entry?.[0] as BuybackCosmeticGrade | undefined) ?? defaultBuybackQuoteDraft.cosmetic_grade
  );
}

function screenConditionFromPayload(value: unknown): BuybackQuoteDraft["screen_condition"] {
  if (typeof value !== "string") return defaultBuybackQuoteDraft.screen_condition;
  const entry = Object.entries(screenLabels).find(([, label]) => label === value);
  return (
    (entry?.[0] as BuybackQuoteDraft["screen_condition"] | undefined) ??
    defaultBuybackQuoteDraft.screen_condition
  );
}

function bodyConditionFromPayload(value: unknown): BuybackQuoteDraft["body_condition"] {
  if (typeof value !== "string") return defaultBuybackQuoteDraft.body_condition;
  const entry = Object.entries(bodyLabels).find(([, label]) => label === value);
  return (
    (entry?.[0] as BuybackQuoteDraft["body_condition"] | undefined) ??
    defaultBuybackQuoteDraft.body_condition
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
